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

  it("repo content with the fixture pack: no rule-5 words in P01–P10, though the pack has two entries for dag", () => {
    const report = runValidation(join(REPO_ROOT, "content"), FIXTURE_PACK);
    const phonics = report.lessons.filter((l) => /^P\d+$/.test(l.id));
    expect(phonics).toHaveLength(10);
    expect(phonics.filter((l) => l.unknownWords.length > 0)).toEqual([]);
    expect(report.issues.filter((i) => i.rule === 5 && /^P\d+$/.test(i.where))).toEqual([]);
  });

  it("fixture content + fixture pack pass, and the report has per-lesson stats", () => {
    const report = runValidation(FIXTURE_CONTENT, FIXTURE_PACK);
    expect(errors(report.issues)).toEqual([]);
    expect(report.lessons.map((l) => l.id)).toEqual(["P01", "P02", "NN21", "NN22"]);
    const nn21 = report.lessons.find((l) => l.id === "NN21")!;
    expect(nn21.overFiveSeconds).toEqual(["NN21-S06"]);
    // rule 5 counts words that are not new, not taught earlier and not function words
    expect(nn21.unknownWords).toEqual(["graag"]);
    expect(report.lessons.find((l) => l.id === "NN22")!.exercises?.auto).toBe(5);
  });
});

describe("fixture pack covers the whole pack format", () => {
  const { pack } = fixture();
  const lessons = Object.values(pack.lessons);

  it("has a dialogue, a text, a phonics lesson and a reading text", () => {
    expect(lessons.map((l) => (l.kind === "reading" ? "reading" : (l.text_type ?? l.kind))).sort()).toEqual([
      "dialogue",
      "phonics",
      "reading",
      "text",
    ]);
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
    expect(exercises.some((e) => e.type === "fill_choice" && e.items.some((i) => i.bank))).toBe(true);
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
    // the official word lists may lack a word: zh_nn / en_nn are null (03 §7)
    expect(pack.words.some((w) => w.zh_nn === null && w.en_nn === null)).toBe(true);
    expect(pack.words.some((w) => w.zh_nn && w.en_nn === null)).toBe(true);
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

  it("rule 5 / 7 with a pack: an own id is the pack entry it merges into; new where first taught", () => {
    const nn21 = (r: ReturnType<typeof check>) => r.lessons.find((l) => l.id === "NN21")!;
    const base = check(() => {});
    const report = check((f) => {
      // own word with its own id for the pack's greeting dag (same lemma and part of speech → merged)
      f.content.words.push({ id: "o_dag", lemma: "dag", pos: "tw", zh: "你好", en: "hello" });
      f.content.lessons.P01.word_ids!.push("o_dag");
      f.content.lessons.P01.sentences![0].nl = "Dag! De vis is in de pan.";
    });
    // dag is not a rule-5 word (zijn is not a fixture function word, it is reported either way)
    const p01 = (r: ReturnType<typeof check>) => r.lessons.find((l) => l.id === "P01")!.unknownWords;
    expect(p01(report)).toEqual(p01(base));
    expect(p01(report)).not.toContain("dag");
    // taught in P01, so not new again in NN21, the pack's first_lesson
    expect(nn21(base).newWords! - nn21(report).newWords!).toBe(1);
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
    // fill_choice with two word banks: an item uses its own bank, the others the exercise bank
    expect(errors(check(() => {}).issues).filter((i) => i.where.includes("NN22-E3"))).toEqual([]);
    expect(
      has(check((f) => (f.pack.lessons.NN22.exercises[2].items[2].answer = "woont")).issues, 6, "这一小题的词库"),
    ).toBe(true);
    expect(has(check((f) => (f.pack.lessons.NN22.exercises[2].items[0].answer = "vaak")).issues, 6, "词库")).toBe(true);
    expect(has(check((f) => delete f.pack.lessons.NN22.exercises[2].bank).issues, 6, "缺少词库")).toBe(true);
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

  it("split lessons: parts must be complete; `from` must name a text sentence; boundaries are reported", () => {
    const split = (f: ReturnType<typeof fixture>, parts: object[]) => {
      const main = f.content.course.sections.find((x) => x.id === "main")!;
      main.lessons = [...parts, { id: "NN22", source: "pack" }] as never;
      delete f.content.lessons.NN21;
      // G01 is taught in NN21's own half, which these splits leave out
      delete f.content.lessons.NN22.tip_links;
    };
    const ok = check((f) =>
      split(f, [
        { id: "NN21a", source: "pack", pack_id: "NN21", part: { n: 1, of: 2 } },
        { id: "NN21b", source: "pack", pack_id: "NN21", part: { n: 2, of: 2, from: "NN21-S08" } },
      ]),
    );
    expect(errors(ok.issues)).toEqual([]);
    expect(ok.splits).toEqual([{ id: "NN21b", before: "Alstublieft.", after: "Dank u. Tot ziens!" }]);
    expect(ok.lessons.find((l) => l.id === "NN21b")).toMatchObject({ sentences: 2, newWords: 13 });
    // words of part a are known in part b: no rule-5 noise from the split
    expect(ok.lessons.find((l) => l.id === "NN21b")!.unknownWords).toEqual([]);
    expect(
      has(
        check((f) =>
          split(f, [
            { id: "NN21a", source: "pack", pack_id: "NN21", part: { n: 1, of: 3 } },
            { id: "NN21b", source: "pack", pack_id: "NN21", part: { n: 2, of: 3 } },
          ]),
        ).issues,
        1,
        "拆分不完整",
      ),
    ).toBe(true);
    expect(
      has(
        check((f) =>
          split(f, [
            { id: "NN21a", source: "pack", pack_id: "NN21", part: { n: 1, of: 2 } },
            { id: "NN21b", source: "pack", pack_id: "NN21", part: { n: 2, of: 2, from: "NN21-S99" } },
          ]),
        ).issues,
        1,
        "NN21-S99",
      ),
    ).toBe(true);
    // the word-list reading is not a split point
    expect(
      has(
        check((f) =>
          split(f, [
            { id: "NN21a", source: "pack", pack_id: "NN21", part: { n: 1, of: 2 } },
            { id: "NN21b", source: "pack", pack_id: "NN21", part: { n: 2, of: 2, from: "NN21-S10" } },
          ]),
        ).issues,
        1,
        "NN21 里没有课文句 NN21-S10",
      ),
    ).toBe(true);
    // a part without a single text sentence (more parts than text sentences)
    const tooMany = check((f) =>
      split(f, [
        { id: "NN05a", source: "pack", pack_id: "NN05", part: { n: 1, of: 2 } },
        { id: "NN05b", source: "pack", pack_id: "NN05", part: { n: 2, of: 2 } },
      ]),
    );
    expect(errors(tooMany.issues)).toContainEqual(
      expect.objectContaining({ where: "NN05b", msg: "这一部分没有课文句（NN05 的课文句比部分少）" }),
    );
    expect(errors(tooMany.issues).some((i) => i.where === "NN05a")).toBe(false);
  });

  it("without a pack, course.json is checked against nn-index.json", () => {
    const f = fixture();
    const nnIndex = structuredClone(f.pack.index);
    const run = (mutate: () => void) => {
      mutate();
      return validateContent({ content: f.content, nnIndex, ttsFileExists: () => true });
    };
    expect(errors(run(() => {}).issues).filter((i) => i.where === "course.json")).toEqual([
      expect.objectContaining({ msg: "NN23：nn-index.json 里没有 NN23" }),
    ]);
    const nn21 = nnIndex.lessons.find((l) => l.id === "NN21")!;
    const split = (r: ReturnType<typeof run>) => r.issues.filter((i) => i.rule === 7 && i.where === "NN21");
    // only text sentences count: many sentences but few text sentences → no split suggested
    expect(split(run(() => (nn21.sentence_count = 40)))).toEqual([]);
    expect(split(run(() => (nn21.line_count = 40)))).toEqual([
      expect.objectContaining({ level: "warn", msg: "课文 40 句、新词 30 个，建议拆成 2 部分（现在 1）" }),
    ]);
    // an index without line_count falls back to sentence_count
    expect(split(run(() => delete nn21.line_count))).toHaveLength(1);
  });

  it("reading texts: a reading lesson of the pack; its sentences and words count for rules 5 and 7", () => {
    const report = check(() => {});
    const p02 = report.lessons.find((l) => l.id === "P02")!;
    // the six text sentences of NN14 (title not counted); ik is neither taught nor a fixture function word
    expect(p02.sentences).toBe(6);
    expect(p02.unknownWords).toContain("ik");
    expect(p02.unknownWords).not.toContain("markt");
    expect(has(check((f) => (f.content.lessons.P02.reading = "NN21")).issues, 1, "NN21 不是认读小文")).toBe(true);
    expect(
      check((f) => (f.content.lessons.P02.reading = "NN19")).issues.some(
        (i) => i.level === "warn" && i.msg === "资料包里没有认读小文 NN19",
      ),
    ).toBe(true);
    expect(has(check((f) => (f.content.lessons.P01.reading = "NN14")).issues, 1, "已经用在 P01")).toBe(true);
    // without a pack the reference is checked against nn-index.json
    const f = fixture();
    f.content.lessons.P02.reading = "NN05";
    const r = validateContent({ content: f.content, nnIndex: f.pack.index, ttsFileExists: () => true });
    expect(has(r.issues, 1, "NN05 不是认读小文（kind 是 phonics）")).toBe(true);
  });

  it("tips: taught once, linked back only after they are taught, cited EXTRA boxes must exist", () => {
    expect(errors(check(() => {}).issues)).toEqual([]);
    expect(has(check((f) => (f.content.lessons.NN22.tips = ["G01"])).issues, 1, "G01 已经在 NN21 讲过")).toBe(true);
    expect(
      has(
        check((f) => {
          f.content.lessons.NN21.tip_links = ["G02"];
        }).issues,
        1,
        "G02 前面的课还没有讲过",
      ),
    ).toBe(true);
    expect(has(check((f) => (f.content.lessons.NN22.tip_links = ["G09"])).issues, 1, "找不到小贴士 G09")).toBe(true);
    expect(has(check((f) => (f.content.tips.G02.pack_examples = ["NN22-X7"])).issues, 1, "NN22-X7")).toBe(true);
    expect(errors(check((f) => (f.content.tips.G02.pack_examples = ["NN22-X1-2"])).issues)).toEqual([]);
    expect(
      check((f) => delete f.content.lessons.NN22.tips).issues.some(
        (i) => i.level === "warn" && i.where === "tips/G02.json" && i.msg === "还没有挂在任何一课",
      ),
    ).toBe(true);
    // without a pack: the cited lesson must be in nn-index.json
    const f = fixture();
    f.content.tips.G02.pack_examples = ["NN30-X1"];
    const r = validateContent({ content: f.content, nnIndex: f.pack.index, ttsFileExists: () => true });
    expect(has(r.issues, 1, "nn-index.json 里没有 NN30")).toBe(true);
  });

  it("main lessons: generated questions + our exercises stay ≤ 9; the report has the exercise counts", () => {
    const base = check(() => {});
    expect(base.lessons.find((l) => l.id === "NN21")!.exercises).toEqual({ auto: 9, book: 10 });
    expect(base.lessons.find((l) => l.id === "NN22")!.exercises).toEqual({ auto: 5, book: 8 });
    expect(base.issues).toContainEqual(
      expect.objectContaining({
        level: "warn",
        rule: 7,
        where: "NN22",
        msg: "练习共 13 小题（自动 5 + 课本 8），建议 15–25",
      }),
    );
    expect(has(check((f) => (f.content.lessons.NN21.auto_exercises!.E1 = 2)).issues, 7, "自动题 10 道")).toBe(true);
    expect(has(check((f) => delete f.content.lessons.NN21.auto_exercises).issues, 7, "自动题 13 道")).toBe(true);
  });

  it("E9 checks its passage, choices and the nine-question limit without requesting audio", () => {
    const base = check(() => {});
    expect(base.missingTts).toBe(0);
    expect(
      has(
        check((f) => {
          const ex = f.content.lessons.NN22.exercises![0];
          if (ex.type === "read_passage") ex.items[0].answer = "Geen antwoord.";
        }).issues,
        6,
        "不在选项里",
      ),
    ).toBe(true);
    expect(
      has(
        check((f) => {
          const ex = f.content.lessons.NN22.exercises![0];
          if (ex.type === "read_passage") ex.passage[0].nl = "Een ongekend woord.";
        }).issues,
        4,
        "ongekend",
      ),
    ).toBe(true);
    expect(
      has(
        check((f) => {
          f.content.lessons.NN22.auto_exercises!.E1 = 3;
          f.content.lessons.NN22.auto_exercises!.E2 = 3;
        }).issues,
        7,
        "自动题 10 道",
      ),
    ).toBe(true);
  });

  it("rule 3 covers our E5 / E6 questions and tip examples", () => {
    const report = check((f) => {
      for (const e of Object.values(f.content.tts.entries)) if (e.text === "Wat wilt u?") e.duration = 5.4;
    });
    expect(has(report.issues, 3, "5.40")).toBe(true);
  });

  it("rules 4 and 5 cover our E5 / E6 questions and the examples of the lesson's tips", () => {
    const nn21 = (r: ReturnType<typeof check>) => r.lessons.find((l) => l.id === "NN21")!.unknownWords;
    // kopen is first taught in NN14 (P02's reading text): known in NN21; Utrecht is a name
    expect(
      nn21(
        check(
          (f) =>
            (f.content.lessons.NN21.exercises![1].items[0] = {
              id: "NN21-O2-1",
              question: { nl: "Wat koopt u?", zh: "您买什么？", en: "What do you buy?" },
              sample_answers: [
                { nl: "Ik koop brood in Utrecht.", zh: "我在乌得勒支买面包。", en: "I buy bread in Utrecht." },
              ],
            } as never),
        ),
      ),
    ).not.toContain("kopen");
    // werken is first taught in NN22: not yet known in NN21
    expect(nn21(check((f) => (f.content.tips.G01.examples[0].nl = "Hij werkt.")))).toContain("werken");
    expect(
      has(
        check(
          (f) =>
            ((f.content.lessons.NN21.exercises![0].items[0] as { start: { nl: string } }).start.nl = "Een zak ..."),
        ).issues,
        4,
        "zak",
      ),
    ).toBe(true);
    // a name inside a spoken answer is not a dictionary word
    expect(
      errors(
        check(
          (f) =>
            ((
              f.content.lessons.NN21.exercises![1].items[0] as { sample_answers: { nl: string }[] }
            ).sample_answers[0].nl = "Dag, Chen."),
        ).issues,
      ),
    ).toEqual([]);
  });

  it("without a pack, our text in pack lessons is checked against nn-index.json's lemmas", () => {
    const f = fixture();
    const run = () => validateContent({ content: f.content, nnIndex: f.pack.index, ttsFileExists: () => true });
    const nn21 = () => run().lessons.find((l) => l.id === "NN21")!;
    // (the fixture's phonics lessons use the fixture pack's word ids)
    expect(errors(run().issues).filter((i) => i.where.startsWith("lessons/NN"))).toEqual([]);
    // nn-index.json only lists a lesson's new lemmas: zijn (first in NN05, which P01 only links) is in NN21's word
    // list in the pack, but not in the index, so without a pack it is reported too
    expect(nn21().unknownWords).toEqual(["graag", "zijn"]);
    // a form the index does not list is found through its lemma (fietst → fietsen); fietsen is new in NN22
    f.content.lessons.NN21.sentences![0].nl = "Hij fietst.";
    expect(nn21().unknownWords).toContain("fietsen");
    f.content.lessons.NN21.sentences![0].nl = "Een zak.";
    expect(has(run().issues, 4, "zak")).toBe(true);
  });

  it("rejects an unknown pack format version", () => {
    expect(has(check((f) => (f.pack.manifest.format_version = 2)).issues, 1, "格式版本")).toBe(true);
  });

  it("file checks are case-exact (Android is case-sensitive)", () => {
    const { pack } = loadPack(FIXTURE_PACK);
    expect(pack!.fileExists("audio/NN21/S01.mp3")).toBe(true);
    expect(pack!.fileExists("audio/nn21/S01.mp3")).toBe(false);
    expect(pack!.fileExists("audio/NN21")).toBe(false);
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
