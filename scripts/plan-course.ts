// Split suggestions for the main lessons (design §2.1), computed from content/a1/nn-index.json and the
// limits in course.json: new words > max_new_words or sentences > max_sentences → split into parts.
//   npx tsx scripts/plan-course.ts           print the plan (markdown table)
//   npx tsx scripts/plan-course.ts --write   also rewrite the main section of course.json
//                                            (keeps a part's "from" when the same part is planned again)
import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { CourseDef, CourseLessonRef } from "../src/content/ownTypes";
import type { PackIndex } from "../src/content/packTypes";
import { partLetter, partSize, suggestedParts } from "../src/content/split";

export function planMainSection(index: PackIndex, course: CourseDef): CourseLessonRef[] {
  const old = new Map(course.sections.flatMap((s) => s.lessons).map((r) => [r.id, r]));
  return index.lessons
    .filter((l) => l.kind === "main")
    .sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }))
    .flatMap((l) => {
      const of = suggestedParts(l, course.limits);
      if (of === 1) return [{ id: l.id, source: "pack" as const }];
      return Array.from({ length: of }, (_, i) => {
        const id = `${l.id}${partLetter(i + 1)}`;
        const from = old.get(id)?.part?.of === of ? old.get(id)?.part?.from : undefined;
        return { id, source: "pack" as const, pack_id: l.id, part: { n: i + 1, of, ...(from ? { from } : {}) } };
      });
    });
}

export function planTable(index: PackIndex, course: CourseDef): string {
  const { max_sentences, max_new_words } = course.limits;
  const rows = index.lessons
    .filter((l) => l.kind === "main")
    .map((l) => {
      const of = suggestedParts(l, course.limits);
      const why = [
        l.sentence_count > max_sentences ? `句子 > ${max_sentences}` : "",
        l.new_word_count > max_new_words ? `新词 > ${max_new_words}` : "",
      ].filter(Boolean);
      const sizes = Array.from({ length: of }, (_, i) => partSize(l.sentence_count, i + 1, of)).join(" + ");
      const zh = l.title.zh.replace(/^第 \d+ 课。/, "").replace(/。$/, "");
      return `| ${l.id.slice(2)} | ${l.title.nl} / ${zh} | ${l.sentence_count} | ${l.new_word_count} | ${
        l.max_sentence_seconds
      } 秒 | ${of === 1 ? "—" : `${of} 部分（${sizes} 句）`} | ${why.join("，")} |`;
    });
  const total = index.lessons
    .filter((l) => l.kind === "main")
    .reduce((n, l) => n + suggestedParts(l, course.limits), 0);
  return [
    `正课 ${rows.length} 课 → ${total} 节（规则：新词 > ${max_new_words} 或句子 > ${max_sentences} 就拆）`,
    "",
    "| 课 | 标题（荷 / 中） | 句数 | 新词 | 最长句 | 拆分 | 原因 |",
    "|---|---|---|---|---|---|---|",
    ...rows,
  ].join("\n");
}

function main() {
  const root = join(import.meta.dirname, "..");
  const coursePath = join(root, "content/a1/course.json");
  const index = JSON.parse(readFileSync(join(root, "content/a1/nn-index.json"), "utf8")) as PackIndex;
  const course = JSON.parse(readFileSync(coursePath, "utf8")) as CourseDef;
  console.log(planTable(index, course));
  if (process.argv.includes("--write")) {
    const main = course.sections.find((s) => s.id === "main");
    if (!main) throw new Error("course.json has no main section");
    main.lessons = planMainSection(index, course);
    writeFileSync(coursePath, JSON.stringify(course, null, 2) + "\n");
    console.log(`\n已写入 ${coursePath}（再运行 npx prettier --write 整理格式）`);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) main();
