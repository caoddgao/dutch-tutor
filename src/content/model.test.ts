// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { CONTENT } from "./bundle";
import { buildCourseView, buildDictionary, buildLesson } from "./model";
import type { PackIndex, PackLesson, PackWord } from "./packTypes";
import { fixtureContent, FIXTURE_PACK_DIR } from "../test/services";

const read = <T>(rel: string): T => JSON.parse(readFileSync(join(FIXTURE_PACK_DIR, rel), "utf8")) as T;
const words = read<PackWord[]>("words.json");
const index = read<PackIndex>("index.json");
const lesson = (id: string) => read<PackLesson>(`lessons/${id}.json`);

describe("course view", () => {
  it("without a pack shows own lessons only and lists main lessons as missing", () => {
    const view = buildCourseView(CONTENT, null);
    expect(view.find((s) => s.id === "phonics")!.lessons.map((l) => l.id)).toEqual([
      "P01",
      "P02",
      "P03",
      "P04",
      "P05",
      "P06",
      "P07",
      "P08",
      "P09",
      "P10",
    ]);
    const main = view.find((s) => s.id === "main")!;
    expect(main.lessons).toEqual([]);
    expect(main.missing).toHaveLength(52);
    expect(main.missing.slice(0, 3).map((l) => [l.id, l.code, l.packId])).toEqual([
      ["NN21", "第 21 课", "NN21"],
      ["NN22a", "第 22 课 a", "NN22"],
      ["NN22b", "第 22 课 b", "NN22"],
    ]);
  });

  it("with a pack takes titles from its index and keeps course order", () => {
    const main = buildCourseView(CONTENT, index).find((s) => s.id === "main")!;
    expect(main.lessons.map((l) => [l.id, l.code, l.title?.nl])).toEqual([
      ["NN21", "第 21 课", "Bij de bakker"],
      ["NN22a", "第 22 课 a", "Mijn buurman"],
      ["NN22b", "第 22 课 b", "Mijn buurman"],
    ]);
    expect(main.missing[0].id).toBe("NN23");
  });
});

describe("dictionary", () => {
  it("merges own words into the pack's: same id or same lemma + part of speech → the pack entry", () => {
    const content = structuredClone(fixtureContent());
    content.words.push(
      { id: "o_brood", lemma: "Brood", pos: "zn", article: "het", forms_seen: ["broodje"], zh: "面包", en: "bread" },
      { id: "o_brood_ww", lemma: "brood", pos: "ww", zh: "（测试）", en: "(test)" },
    );
    const dict = buildDictionary(content, words);
    const entry = dict.words.get("o_brood")!;
    expect(entry.id).toBe("w_brood");
    expect(entry.zhNn).toBeDefined();
    // own synthesized audio stays as a fallback for the pack entry
    expect(entry.audio.tts?.text).toBe("Brood");
    // forms of the own word point to the pack entry
    expect(dict.formIndex.get("broodje")).toBe("w_brood");
    expect(dict.formIndex.get("woont")).toBe("w_wonen");
    // a different part of speech is a different word
    expect(dict.words.get("o_brood_ww")!.id).toBe("o_brood_ww");
  });

  it("letters of the alphabet are entries for their sound, never words of a sentence", () => {
    const dict = buildDictionary(CONTENT, words);
    expect(dict.words.get("w_letter_u")!.letter).toBe(true);
    // "u" in a sentence is the pronoun, not the letter
    expect(dict.formIndex.get("u")).toBe("w_u");
    expect([...dict.formIndex.values()].some((id) => id.startsWith("w_letter_"))).toBe(false);
  });
});

describe("lesson model", () => {
  const content = fixtureContent();
  const dict = buildDictionary(content, words);

  it("merges a pack lesson with our half: taught sentences, added sentence, tips, exercises", () => {
    const l = buildLesson(content, dict, "NN21", { own: content.lessons.NN21, pack: lesson("NN21") })!;
    expect(l.kind).toBe("main");
    expect(l.code).toBe("第 21 课");
    expect(l.textType).toBe("dialogue");
    expect(l.fullAudio?.nn).toBe("audio/NN21/full.mp3");
    // title is in the full recording but not taught; lines + extras + our added sentence are
    expect(l.fullSentences[0].kind).toBe("title");
    expect(l.sentences.map((s) => s.id)).toEqual([
      "NN21-S01",
      "NN21-S02",
      "NN21-S03",
      "NN21-S04",
      "NN21-S05",
      "NN21-S06",
      "NN21-S07",
      "NN21-S08",
      "NN21-S09",
      "NN21-S10",
      "NN21-S11",
      "NN21-A01",
    ]);
    const added = l.sentences.at(-1)!;
    expect(added.kind).toBe("added");
    expect(added.audio.tts?.voice).toBe("nl-NL-FennaNeural");
    expect(added.tokens.map((t) => t.word_id)).toEqual(["w_een", "w_brood", "w_graag"]);
    expect(l.tips.map((t) => t.id)).toEqual(["G01"]);
    // skipped and "other" exercises are not shown
    expect(l.packExercises.map((e) => e.exercise.id)).toEqual([
      "NN21-E1",
      "NN21-E2",
      "NN21-E3",
      "NN21-E4",
      "NN21-E5",
      "NN21-E6",
    ]);
    expect(l.ownExercises).toHaveLength(3);
    expect(l.newWordIds).not.toContain("w_de");
    expect(l.words[0].id).toBe("w_goedemorgen");
    expect(l.showPastParticiple).toBe(false);
  });

  it("text lessons have extras as example boxes", () => {
    const l = buildLesson(content, dict, "NN22", { pack: lesson("NN22") })!;
    expect(l.textType).toBe("text");
    expect(l.sentences.every((s) => s.speaker === null)).toBe(true);
    expect(l.extras[0].sentences[0].audio.packTts).toMatch(/^audio\/tts\//);
  });

  it("phonics lessons reuse keyword recordings and exercises from linked NN lessons", () => {
    const l = buildLesson(content, dict, "P01", { own: content.lessons.P01, linked: [lesson("NN05")] })!;
    expect(l.kind).toBe("phonics");
    expect(l.sounds.map((s) => s.grapheme)).toEqual(["a", "i"]);
    expect(l.words.find((w) => w.id === "w_tas")!.audio.nn).toBe("audio/NN05/K01.mp3");
    expect(l.packExercises.map((e) => e.exercise.id)).toEqual(["NN05-E1"]);
    expect(l.sentences[0].audio.tts?.text).toBe("De vis is in de pan.");
  });

  it("split lessons: each part teaches its stretch; the book's exercises and EXTRA boxes come last", () => {
    const split = structuredClone(content);
    const main = split.course.sections.find((x) => x.id === "main")!;
    main.lessons = [
      { id: "NN21a", source: "pack", pack_id: "NN21", part: { n: 1, of: 2 } },
      { id: "NN21b", source: "pack", pack_id: "NN21", part: { n: 2, of: 2 } },
      { id: "NN22", source: "pack" },
    ];
    split.lessons = { P01: split.lessons.P01 };
    const d = buildDictionary(split, words);
    const a = buildLesson(split, d, "NN21a", { pack: lesson("NN21") })!;
    const b = buildLesson(split, d, "NN21b", { pack: lesson("NN21") })!;
    expect([a.code, b.code]).toEqual(["第 21 课 a", "第 21 课 b"]);
    expect([a.part, b.part]).toEqual([
      { n: 1, of: 2 },
      { n: 2, of: 2 },
    ]);
    // only the text sentences are divided; the word-list reading (S10, S11) is in the last part
    expect(a.sentences.map((x) => x.id)).toEqual(["NN21-S01", "NN21-S02", "NN21-S03", "NN21-S04", "NN21-S05"]);
    expect(b.sentences.map((x) => x.id)).toEqual([
      "NN21-S06",
      "NN21-S07",
      "NN21-S08",
      "NN21-S09",
      "NN21-S10",
      "NN21-S11",
    ]);
    expect(a.fullSentences[0].kind).toBe("title");
    expect(b.fullSentences.map((x) => x.id)).toEqual(b.sentences.map((x) => x.id));
    expect(a.fullSegment).toEqual({ start: 0, end: 15.71 });
    expect(a.fullAudio).toEqual(b.fullAudio);
    expect(a.packExercises).toEqual([]);
    expect(b.packExercises.map((e) => e.exercise.id)).toContain("NN21-E1");
    // each word is taught once, in the part where it first occurs
    expect(a.words.map((w) => w.id)).toContain("w_brood");
    expect(a.words.map((w) => w.id)).toContain("w_dank_u_wel");
    expect(b.words.map((w) => w.id)).toEqual([
      "w_dat",
      "w_zijn",
      "w_drie",
      "w_euro",
      "w_de",
      "w_niet",
      "w_dollar",
      "w_dank_u",
      "w_tot_ziens",
      "w_vier",
      "w_vijf",
    ]);
    // zijn and de were first met in NN05
    expect(b.newWordIds).toEqual([
      "w_dat",
      "w_drie",
      "w_euro",
      "w_niet",
      "w_dollar",
      "w_dank_u",
      "w_tot_ziens",
      "w_vier",
      "w_vijf",
    ]);
    // an unsplit lesson next to it is unchanged
    const nn22 = buildLesson(split, d, "NN22", { pack: lesson("NN22") })!;
    expect(nn22.part).toBeUndefined();
    expect(nn22.fullSegment).toBeUndefined();
    expect(nn22.extras).toHaveLength(1);
  });

  it("a pack lesson is unavailable without the pack", () => {
    expect(buildLesson(content, dict, "NN21", {})).toBeNull();
    expect(buildLesson(content, dict, "NN99", {})).toBeNull();
  });

  it("word audio: original recording from the pack wins, synthesized otherwise", () => {
    expect(dict.words.get("w_vier")!.audio.nn).toBe("audio/NN21/S10.mp3");
    expect(dict.words.get("w_brood")!.audio.packTts).toBe("audio/words/w_brood.mp3");
    expect(dict.words.get("w_graag")!.audio.tts).toEqual({ voice: "nl-NL-FennaNeural", text: "graag" });
  });
});

describe("phonics lessons P03–P10", () => {
  const dict = buildDictionary(CONTENT, words);
  const p = (id: string, sources: Parameters<typeof buildLesson>[3] = {}) =>
    buildLesson(CONTENT, dict, id, { own: CONTENT.lessons[id], ...sources })!;

  it("P09 shows the letters with the sounds; they are not new words or word cards", () => {
    const l = p("P09");
    expect(l.sounds.map((s) => s.grapheme)).toEqual(["a e i o u", "-ee", "e-", "h k q x z", "1–10", "11–20"]);
    expect(l.words.filter((w) => w.letter)).toHaveLength(26);
    expect(l.newWordIds.some((id) => id.startsWith("w_letter_"))).toBe(false);
    // words taught in earlier phonics lessons (twee in P02, vijf in P06) are not new again
    expect(l.newWordIds).not.toContain("w_twee");
    expect(l.newWordIds).not.toContain("w_vijf");
    expect(l.newWordIds).toContain("w_dertien");
  });

  it("the reading text needs the pack: without it the lesson has none", () => {
    expect(CONTENT.lessons.P05.reading).toBe("NN14");
    expect(p("P05").reading).toBeUndefined();
  });

  it("the reading text comes from the pack; its own exercises are not used", () => {
    const l = p("P05", { reading: lesson("NN14") });
    expect(l.reading!.title.nl).toBe("Naar de markt");
    expect(l.reading!.fullAudio).toEqual({ id: "NN14-full", nn: "audio/NN14/full.mp3" });
    expect(l.reading!.fullSentences[0].kind).toBe("title");
    expect(l.reading!.sentences.map((s) => s.id)).toEqual([
      "NN14-S01",
      "NN14-S02",
      "NN14-S03",
      "NN14-S04",
      "NN14-S05",
      "NN14-S06",
    ]);
    expect(l.reading!.words.map((w) => w.id)).toContain("w_markt");
    expect(l.reading!.newWordIds).toContain("w_kaas");
    expect(l.packExercises.some((e) => e.lessonId === "NN14")).toBe(false);
  });

  it("an NN lesson linked to two phonics lessons gives its exercises to the first only", () => {
    expect(CONTENT.lessons.P06.nn_lessons).toEqual(["NN09", "NN10"]);
    expect(CONTENT.lessons.P07.nn_lessons).toEqual(["NN09", "NN10"]);
    const nn09 = { ...lesson("NN05"), id: "NN09", nn_lesson: 9 };
    expect(p("P06", { linked: [nn09] }).packExercises.map((e) => e.lessonId)).toContain("NN09");
    const p07 = p("P07", { linked: [nn09] });
    expect(p07.packExercises).toEqual([]);
    // the keyword recordings are still reused
    expect(p07.words.length).toBeGreaterThan(0);
  });
});
