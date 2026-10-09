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
    expect(view.find((s) => s.id === "phonics")!.lessons.map((l) => l.id)).toEqual(["P01", "P02"]);
    const main = view.find((s) => s.id === "main")!;
    expect(main.lessons).toEqual([]);
    expect(main.missing).toHaveLength(45);
  });

  it("with a pack takes titles from its index and keeps course order", () => {
    const main = buildCourseView(CONTENT, index).find((s) => s.id === "main")!;
    expect(main.lessons.map((l) => [l.id, l.code, l.title?.nl])).toEqual([
      ["NN21", "第 21 课", "Bij de bakker"],
      ["NN22", "第 22 课", "Mijn buurman"],
    ]);
    expect(main.missing[0].id).toBe("NN23");
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
