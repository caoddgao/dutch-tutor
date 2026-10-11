// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDictionary, buildLesson } from "../content/model";
import type { PackLesson, PackWord } from "../content/packTypes";
import { fixtureContent, FIXTURE_PACK_DIR } from "../test/services";
import { buildExercises, scoredCount, sentenceBlocks } from "./build";
import type { ChoiceQuestion, OrderQuestion } from "./types";

const read = <T>(rel: string): T => JSON.parse(readFileSync(join(FIXTURE_PACK_DIR, rel), "utf8")) as T;
const content = fixtureContent();
const dict = buildDictionary(content, read<PackWord[]>("words.json"));
const nn21 = buildLesson(content, dict, "NN21", {
  own: content.lessons.NN21,
  pack: read<PackLesson>("lessons/NN21.json"),
})!;
const p01 = buildLesson(content, dict, "P01", {
  own: content.lessons.P01,
  linked: [read<PackLesson>("lessons/NN05.json")],
})!;

describe("generated questions follow the lesson's counts", () => {
  it("asks for as many questions of each kind as the lesson says", () => {
    const nn22 = buildLesson(content, dict, "NN22", {
      own: content.lessons.NN22,
      pack: read<PackLesson>("lessons/NN22.json"),
    })!;
    const generated = buildExercises(nn22, dict, content.tts).filter((g) => !g.instruction);
    expect(generated.map((g) => [g.code, g.questions.length])).toEqual([
      ["E1", 1],
      ["E3", 1],
      ["E7", 1],
    ]);
  });
});

it("E9 repeats the same written passage for two scored choices without audio", () => {
  const lesson = buildLesson(content, dict, "NN22", {
    own: content.lessons.NN22,
    pack: read<PackLesson>("lessons/NN22.json"),
  })!;
  const group = buildExercises(lesson, dict, content.tts).find((g) => g.code === "E9")!;
  expect(group.questions).toHaveLength(2);
  const [first, second] = group.questions as ChoiceQuestion[];
  expect(first.passage).toHaveLength(4);
  expect(first.options).toHaveLength(3);
  expect(second.passage).toEqual(first.passage);
  expect(first.prompt.audio).toBeUndefined();
  expect(first.options[first.answer].nl).toBe("In Utrecht.");
  expect(scoredCount([group])).toBe(2);
});

describe("lesson exercises", () => {
  const groups = buildExercises(nn21, dict, content.tts);

  it("generates E1–E4 and E7 from the lesson, then our own and the book's exercises", () => {
    expect(groups.map((g) => g.code)).toEqual([
      "E1",
      "E2",
      "E3",
      "E4",
      "E7",
      "E5",
      "E6",
      "E7",
      "E8",
      "E8",
      "E8",
      "E8",
      "E8",
      "E6",
    ]);
  });

  it("every choice has exactly one right answer among distinct options", () => {
    for (const g of groups)
      for (const q of g.questions) {
        if (q.kind !== "choice") continue;
        const labels = q.options.map((o) => o.nl ?? o.zh);
        expect(new Set(labels).size).toBe(labels.length);
        expect(q.answer).toBeGreaterThanOrEqual(0);
        expect(q.answer).toBeLessThan(q.options.length);
      }
  });

  it("E1 plays the sentence and offers meanings; E2 shows the Dutch", () => {
    const e1 = groups[0].questions[0] as ChoiceQuestion;
    expect(e1.prompt.audio).toBeTruthy();
    expect(e1.prompt.nl).toBeUndefined();
    expect(e1.options[e1.answer].zh).toBeTruthy();
    const e2 = groups[1].questions[0] as ChoiceQuestion;
    expect(e2.prompt.nl).toBeTruthy();
  });

  it("book examples are kept as answered demos and not scored; skipped exercises are left out", () => {
    const all = groups.flatMap((g) => g.questions);
    expect(all.filter((q) => q.example).map((q) => q.id)).toEqual(["NN21-E2-1", "NN21-E4-1"]);
    expect(all.some((q) => ["NN21-E7-1", "NN21-E8-1"].includes(q.id))).toBe(false);
    expect(scoredCount(groups)).toBe(all.length - 2);
  });

  it("fill_choice offers the whole word bank", () => {
    const q = groups.flatMap((g) => g.questions).find((x) => x.id === "NN21-E4-2") as ChoiceQuestion;
    expect(q.options.map((o) => o.nl)).toEqual(["Dank", "wilt", "is"]);
    expect(q.options[q.answer].nl).toBe("wilt");
  });

  it("fill_choice items with their own word bank offer that bank", () => {
    const nn22 = buildLesson(content, dict, "NN22", { pack: read<PackLesson>("lessons/NN22.json") })!;
    const qs = buildExercises(nn22, dict, content.tts).find((g) => g.id === "NN22-E3")!.questions as ChoiceQuestion[];
    expect(qs.map((q) => q.options.map((o) => o.nl))).toEqual([
      ["woont", "werkt"],
      ["woont", "werkt"],
      ["aardig", "vaak"],
      ["aardig", "vaak"],
    ]);
    expect(qs.map((q) => q.options[q.answer].nl)).toEqual(["woont", "werkt", "vaak", "aardig"]);
  });

  it("order questions never start in the right order", () => {
    for (const q of groups.flatMap((g) => g.questions).filter((x): x is OrderQuestion => x.kind === "order")) {
      expect(q.shuffled.slice().sort()).toEqual(q.blocks.map((_, i) => i));
      expect(q.shuffled.every((v, i) => v === i)).toBe(false);
    }
    expect(sentenceBlocks("Een bruin brood, alstublieft.")).toEqual(["Een", "bruin", "brood,", "alstublieft."]);
  });

  it("is stable for the same lesson", () => {
    expect(buildExercises(nn21, dict, content.tts)).toEqual(groups);
  });
});

describe("phonics exercises", () => {
  it("uses our own listen / choose-audio items and the linked lesson's listen_choose as E3", () => {
    const groups = buildExercises(p01, dict, content.tts);
    expect(groups.map((g) => [g.id, g.code])).toEqual([
      ["P01-E1", "E3"],
      ["P01-E2", "E4"],
      ["NN05-E1", "E3"],
    ]);
    const heard = groups[2].questions[0] as ChoiceQuestion;
    expect(heard.prompt.audio?.nn).toBe("audio/NN05/K01.mp3");
    expect(heard.prompt.nl).toBeUndefined();
  });
});
