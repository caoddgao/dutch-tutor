// @vitest-environment node
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { ContentBundle } from "../src/content/ownTypes";
import type { PackData } from "../src/content/validate";
import { validateContent, type Issue } from "../src/content/validate";
import { loadContent, loadPack, REPO_ROOT } from "./lib/contentFiles";
import { runValidation } from "./validate-content";
import { normalizeRegion, ssml, ttsKey } from "./tts";

const FIXTURE_PACK = join(REPO_ROOT, "fixtures/nn-pack");
const FIXTURE_CONTENT = join(REPO_ROOT, "fixtures/content");

const errors = (issues: Issue[]) => issues.filter((i) => i.level === "error");

function fixture(): { content: ContentBundle; pack: PackData; ttsDir: string } {
  const c = loadContent(FIXTURE_CONTENT);
  const p = loadPack(FIXTURE_PACK);
  if (!c.bundle || !p.pack) throw new Error("fixture failed to load");
  const { fileExists, ...packData } = p.pack;
  return { content: structuredClone(c.bundle), pack: { ...structuredClone(packData), fileExists }, ttsDir: c.ttsDir };
}

function check(mutate: (f: ReturnType<typeof fixture>) => void) {
  const f = fixture();
  mutate(f);
  return validateContent({
    content: f.content,
    pack: f.pack,
    ttsFileExists: (h) => existsSync(join(f.ttsDir, `${h}.mp3`)),
  });
}

const has = (issues: Issue[], rule: Issue["rule"], text: string) =>
  errors(issues).some((i) => i.rule === rule && (i.msg.includes(text) || i.where.includes(text)));

describe("content check on the real repo content and fixtures", () => {
  it("repo content passes without errors", () => {
    expect(errors(runValidation(join(REPO_ROOT, "content")).issues)).toEqual([]);
  });

  it("repo content passes together with the fixture pack", () => {
    expect(errors(runValidation(join(REPO_ROOT, "content"), FIXTURE_PACK).issues)).toEqual([]);
  });

  it("fixture content + fixture pack pass, and the report has per-lesson stats", () => {
    const report = runValidation(FIXTURE_CONTENT, FIXTURE_PACK);
    expect(errors(report.issues)).toEqual([]);
    expect(report.lessons.map((l) => l.id)).toEqual(["P01", "NN21", "NN22"]);
    const nn21 = report.lessons.find((l) => l.id === "NN21")!;
    expect(nn21.overFiveSeconds).toEqual(["NN21-S06"]);
    // rule 5 counts words that are not new, not taught earlier and not function words
    expect(nn21.unknownWords).toEqual(["graag"]);
  });
});

describe("fixture pack covers the whole pack format", () => {
  const { pack } = fixture();
  const lessons = Object.values(pack.lessons);

  it("has a dialogue, a text and a phonics lesson", () => {
    expect(lessons.map((l) => l.text_type ?? l.kind).sort()).toEqual(["dialogue", "phonics", "text"]);
  });

  it("uses every exercise type, example / extra marks and skips", () => {
    const exercises = lessons.flatMap((l) => l.exercises);
    expect(new Set(exercises.map((e) => e.type))).toEqual(
      new Set(["true_false", "choose_one", "match", "fill_choice", "answer_oral", "order", "listen_choose", "other"]),
    );
    expect(exercises.some((e) => e.extra)).toBe(true);
    expect(exercises.some((e) => e.items.some((i) => i.extra))).toBe(true);
    expect(exercises.some((e) => e.items.some((i) => i.example))).toBe(true);
    expect(new Set(exercises.filter((e) => e.skip).map((e) => e.skip_reason))).toEqual(
      new Set(["needs_image", "unsupported"]),
    );
    expect(exercises.some((e) => e.items.some((i) => i.answer_by === "DS"))).toBe(true);
  });

  it("has extras, sentence roles, flags and every part of speech", () => {
    expect(lessons.some((l) => (l.extras ?? []).length > 0)).toBe(true);
    const sentences = lessons.flatMap((l) => l.sentences);
    expect(new Set(sentences.map((s) => s.role))).toEqual(new Set(["title", "line", "extra"]));
    expect(new Set(sentences.flatMap((s) => s.flags))).toEqual(
      new Set(["over_5s", "low_align", "manual_fixed", "no_audio"]),
    );
    expect(new Set(pack.words.map((w) => w.pos))).toEqual(
      new Set(["zn", "ww", "bn", "bw", "vnw", "lidw", "vz", "vw", "telw", "tw", "eigen", "uitdr"]),
    );
    expect(pack.words.some((w) => w.separable)).toBe(true);
    expect(pack.words.some((w) => w.audio_source?.startsWith("nn:"))).toBe(true);
    expect(new Set(pack.words.map((w) => w.article))).toEqual(new Set([null, "de", "het"]));
  });
});

describe("rules", () => {
  it("rule 1: duplicate ids and broken references", () => {
    expect(has(check((f) => (f.pack.lessons.NN22.sentences[1].id = "NN21-S01")).issues, 1, "id 重复")).toBe(true);
    expect(
      has(check((f) => (f.pack.lessons.NN21.sentences[1].tokens![0].word_id = "w_nope")).issues, 1, "w_nope"),
    ).toBe(true);
    expect(has(check((f) => (f.content.lessons.NN21.tips = ["G99"])).issues, 1, "G99")).toBe(true);
    expect(
      has(check((f) => (f.pack.lessons.NN21.sentences[2].audio = "audio/NN21/missing.mp3")).issues, 1, "missing.mp3"),
    ).toBe(true);
    expect(
      has(
        check((f) => (f.content.lessons.NN21.exercises![2].items[0] = { id: "x", sentence_id: "NN21-S99" })).issues,
        1,
        "NN21-S99",
      ),
    ).toBe(true);
  });

  it("rule 2: trilingual text, word fields, noun articles", () => {
    expect(has(check((f) => (f.pack.lessons.NN21.sentences[1].en = "")).issues, 2, "英文")).toBe(true);
    expect(has(check((f) => (f.pack.words.find((w) => w.id === "w_brood")!.article = null)).issues, 2, "冠词")).toBe(
      true,
    );
    expect(has(check((f) => (f.content.words[0].zh = " ")).issues, 2, "中文释义")).toBe(true);
  });

  it("rule 3: own sentences over 5 s (4 s in phonics lessons) are errors", () => {
    const report = check((f) => {
      for (const e of Object.values(f.content.tts.entries)) if (e.text === "De vis is in de pan.") e.duration = 4.2;
    });
    expect(has(report.issues, 3, "4.20")).toBe(true);
  });

  it("rule 4: every word of a sentence maps to an entry", () => {
    expect(has(check((f) => (f.content.lessons.P01.sentences![0].nl = "De vis is in de zee.")).issues, 4, "zee")).toBe(
      true,
    );
    expect(has(check((f) => f.pack.lessons.NN22.sentences[2].tokens!.pop()).issues, 4, "Utrecht")).toBe(true);
  });

  it("rule 5: reports unknown words per lesson as warnings", () => {
    const report = check((f) => (f.content.functionWords.lemmas = []));
    expect(report.lessons.find((l) => l.id === "P01")!.unknownWords).toEqual(["de", "zijn", "in"]);
    expect(report.issues.some((i) => i.rule === 5 && i.level === "warn")).toBe(true);
  });

  it("rule 6: one correct answer, no duplicate options", () => {
    expect(
      has(check((f) => (f.pack.lessons.NN21.exercises[1].items[1].answer = "willen")).issues, 6, "不在选项里"),
    ).toBe(true);
    expect(
      has(
        check((f) => (f.pack.lessons.NN22.exercises[1].items[1].options = ["aardig", "aardig", "bank"])).issues,
        6,
        "重复",
      ),
    ).toBe(true);
    expect(
      has(
        check(
          (f) =>
            (f.pack.lessons.NN21.exercises[2].items[0].pairs = [
              [0, 1],
              [1, 1],
              [2, 0],
            ]),
        ).issues,
        6,
        "一一对应",
      ),
    ).toBe(true);
    expect(has(check((f) => (f.pack.lessons.NN21.exercises[3].items[1].answer = "kost")).issues, 6, "词库")).toBe(true);
    expect(has(check((f) => (f.pack.lessons.NN21.exercises[6].skip = false)).issues, 6, "other")).toBe(true);
    expect(
      has(
        check(
          (f) =>
            (f.content.lessons.P01.exercises![0] = {
              ...f.content.lessons.P01.exercises![0],
              items: [{ id: "q", word_id: "w_tas", options: ["tas", "tas"], answer: "tas" }],
            } as never),
        ).issues,
        6,
        "重复",
      ),
    ).toBe(true);
  });

  it("rule 7: too many sentences or new words suggests a split", () => {
    const report = check((f) => (f.content.course.limits = { max_sentences: 5, max_new_words: 10 }));
    const warns = report.issues.filter((i) => i.rule === 7).map((i) => i.where);
    expect(warns).toContain("NN21");
    expect(warns).toContain("NN22");
  });

  it("rejects an unknown pack format version", () => {
    expect(has(check((f) => (f.pack.manifest.format_version = 2)).issues, 1, "格式版本")).toBe(true);
  });

  it("JSON Schema errors are reported", () => {
    const loader = loadPack(join(REPO_ROOT, "fixtures"));
    expect(loader.loader.issues.some((i) => i.msg === "文件不存在")).toBe(true);
  });
});

describe("tts helpers", () => {
  it("uses the pack cache key rule and escapes SSML", () => {
    expect(ttsKey("nl-NL-FennaNeural", "Wat wilt u?")).toMatch(/^[0-9a-f]{16}$/);
    expect(ssml("v", "a < b & c")).toContain("a &lt; b &amp; c");
    expect(ssml("v", "x")).toContain('xml:lang="nl-NL"');
    expect(normalizeRegion(" East US\n")).toBe("eastus");
    expect(normalizeRegion("westeurope.api.cognitive.microsoft.com")).toBe("westeurope");
    expect(normalizeRegion("  ")).toBeUndefined();
  });
});
