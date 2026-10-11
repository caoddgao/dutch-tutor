// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildDictionary, buildLesson } from "../content/model";
import type { PackLesson, PackWord } from "../content/packTypes";
import { fixtureContent, FIXTURE_PACK_DIR } from "../test/services";
import { buildQuestions, cardsFromLessons, chooseMode } from "./session";
import type { ReviewItem } from "./store";

const read = <T>(rel: string): T => JSON.parse(readFileSync(join(FIXTURE_PACK_DIR, rel), "utf8")) as T;
const content = fixtureContent();
const dict = buildDictionary(content, read<PackWord[]>("words.json"));
const nn21 = buildLesson(content, dict, "NN21", {
  own: content.lessons.NN21,
  pack: read<PackLesson>("lessons/NN21.json"),
})!;
const nn22 = buildLesson(content, dict, "NN22", { pack: read<PackLesson>("lessons/NN22.json") })!;

const item = (id: string, type: "sentence" | "word", lesson = "NN21"): ReviewItem => ({
  item_id: id,
  item_type: type,
  lesson_id: lesson,
  stage: 0,
  interval_days: 1,
  due_at: "2026-10-10",
  reps: 0,
  lapses: 0,
});

describe("review modes", () => {
  it("rotate through the enabled modes; listening only needs audio", () => {
    expect([0, 1, 2, 3].map((i) => chooseMode(i, ["R1", "R2", "R3"], true))).toEqual(["R1", "R2", "R3", "R1"]);
    expect(chooseMode(1, ["R1", "R2", "R3"], false)).toBe("R3");
    expect(chooseMode(0, ["R2"], false)).toBe("R1");
    expect(chooseMode(5, ["R3"], true)).toBe("R3");
  });
});

describe("review cards and distractors", () => {
  const items = [
    item("NN21-S03", "sentence"),
    item("w_brood", "word"),
    item("w_wonen", "word", "NN22"),
    item("NN99-S01", "sentence"),
  ];
  const { cards, pool, missing } = cardsFromLessons(items, [nn21, nn22], dict);

  it("finds sentences and words in the loaded lessons; unknown ones are counted as missing", () => {
    expect(cards.map((c) => [c.item.item_id, c.nl])).toEqual([
      ["NN21-S03", "Een bruin brood, alstublieft."],
      ["w_brood", "het brood"],
      ["w_wonen", "wonen"],
    ]);
    expect(missing).toBe(1);
  });

  it("meaning options: one right answer, same kind, preferring the same part of speech", () => {
    const qs = buildQuestions(cards, pool, ["R1"], "seed");
    for (const q of qs) {
      expect(q.options[q.answer].zh).toBe(q.card.zh);
      expect(new Set(q.options.map((o) => o.zh)).size).toBe(q.options.length);
    }
    const noun = qs.find((q) => q.card.item.item_id === "w_brood")!;
    const nouns = new Set([...dict.words.values()].filter((w) => w.pos === "zn").map((w) => w.zh));
    expect(noun.options.filter((o) => nouns.has(o.zh)).length).toBe(noun.options.length);
    const sentence = qs.find((q) => q.card.item.item_type === "sentence")!;
    expect(sentence.options).toHaveLength(4);
  });
});

describe("reading texts in review", () => {
  it("finds the sentences and words of a phonics lesson's reading text", () => {
    const p02 = buildLesson(content, dict, "P02", {
      own: content.lessons.P02,
      reading: read<PackLesson>("lessons/NN14.json"),
    })!;
    const { cards, missing } = cardsFromLessons(
      [item("NN14-S05", "sentence", "P02"), item("w_kaas", "word", "P02")],
      [p02],
      dict,
    );
    expect(cards.map((c) => c.nl)).toEqual(["Ik koop kaas.", "de kaas"]);
    expect(missing).toBe(0);
  });
});
