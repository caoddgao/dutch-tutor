// Content check (docs/01_DESIGN.md §11 rules 1–7).
//   npm run validate                         repo content only (CI)
//   npm run validate -- --pack <nn-pack dir>  full check with a resource pack
//   options: --content <dir> (default content/), --report <file.md>
//   With --pack the report is also written to validate-report.md in the current folder unless --report says
//   otherwise (Windows: npm run validate -- --pack "F:\\...\\nn-pack", then open validate-report.md).
import { existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { validateContent, type Issue, type Report } from "../src/content/validate";
import { loadContent, loadPack, REPO_ROOT } from "./lib/contentFiles";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

export function runValidation(contentDir: string, packDir?: string): Report {
  const content = loadContent(contentDir);
  const issues: Issue[] = [...content.loader.issues];
  let pack;
  if (packDir) {
    const loaded = loadPack(packDir);
    issues.push(...loaded.loader.issues.map((i) => ({ ...i, where: `资料包 ${i.where}` })));
    pack = loaded.pack;
  }
  if (!content.bundle) return { issues, lessons: [], missingTts: 0 };
  const report = validateContent({
    content: content.bundle,
    pack,
    nnIndex: content.nnIndex,
    ttsFileExists: (hash) => existsSync(join(content.ttsDir, `${hash}.mp3`)),
  });
  return { ...report, issues: [...issues, ...report.issues] };
}

const RULE_NAMES: Record<string, string> = {
  schema: "格式（JSON Schema）",
  1: "规则 1 · id 唯一、引用都能找到",
  2: "规则 2 · 三语齐全、词条字段",
  3: "规则 3 · 录音时长",
  4: "规则 4 · 句中的词都有词条",
  5: "规则 5 · 生词规则",
  6: "规则 6 · 练习答案",
  7: "规则 7 · 句数和新词数",
};

export function formatReport(report: Report, title: string): string {
  const errors = report.issues.filter((i) => i.level === "error");
  const warns = report.issues.filter((i) => i.level === "warn");
  const lines = [`# ${title}`, "", `错误 ${errors.length} 条 · 提示 ${warns.length} 条`, ""];
  if (report.lessons.length > 0) {
    lines.push("| 课 | 句数 | 新词 | 生词规则违规 | 超过 5 秒 |", "|---|---|---|---|---|");
    for (const l of report.lessons) {
      const unknown = l.unknownWords.length
        ? `${l.unknownWords.length}（${l.unknownWords.slice(0, 8).join(", ")}）`
        : "0";
      lines.push(`| ${l.id} | ${l.sentences} | ${l.newWords} | ${unknown} | ${l.overFiveSeconds.length} |`);
    }
    lines.push("");
  }
  if (report.splits && report.splits.length > 0) {
    lines.push(
      "## 拆分处",
      "",
      "拆分课每一部分从哪里开始（上一句 ‖ 这一部分的第一句），看看有没有把一问一答拆开：",
      "",
    );
    for (const b of report.splits) lines.push(`- ${b.id}：${b.before} ‖ ${b.after}`);
    lines.push("");
  }
  for (const [level, list] of [
    ["错误", errors],
    ["提示", warns],
  ] as const) {
    if (list.length === 0) continue;
    lines.push(`## ${level}`, "");
    const byRule = new Map<string, Issue[]>();
    for (const i of list) byRule.set(String(i.rule), [...(byRule.get(String(i.rule)) ?? []), i]);
    for (const [rule, items] of byRule) {
      lines.push(`### ${RULE_NAMES[rule] ?? rule}（${items.length}）`, "");
      for (const i of items) lines.push(`- ${i.where}：${i.msg}`);
      lines.push("");
    }
  }
  return lines.join("\n");
}

function main() {
  const contentDir = resolve(arg("--content") ?? join(REPO_ROOT, "content"));
  const packArg = arg("--pack");
  const packDir = packArg ? resolve(packArg) : undefined;
  const report = runValidation(contentDir, packDir);
  const text = formatReport(report, packDir ? `内容校验（含资料包 ${packDir}）` : "内容校验（仓库内容）");
  console.log(text);
  const out = arg("--report") ?? (packDir ? "validate-report.md" : undefined);
  if (out) {
    writeFileSync(out, text + "\n", "utf8");
    console.log(`\n报告已写入 ${resolve(out)}`);
  }
  const errors = report.issues.filter((i) => i.level === "error").length;
  process.exitCode = errors > 0 ? 1 : 0;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
