// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PackLesson } from "./packTypes";
import { packLessonParts, partSizes, partStarts, suggestedParts } from "./split";
import { FIXTURE_PACK_DIR } from "../test/services";

const nn21 = JSON.parse(readFileSync(join(FIXTURE_PACK_DIR, "lessons/NN21.json"), "utf8")) as PackLesson;
const limits = { max_sentences: 36, max_new_words: 45 };
const ids = (list: { id: string }[]) => list.map((s) => s.id.replace("NN21-", ""));

describe("split suggestions (design §2.1)", () => {
  it("splits when text sentences > 36 or new words > 45, into as many parts as needed", () => {
    expect(suggestedParts({ sentence_count: 20, line_count: 19, new_word_count: 18 }, limits)).toBe(1);
    expect(suggestedParts({ sentence_count: 40, line_count: 36, new_word_count: 45 }, limits)).toBe(1);
    expect(suggestedParts({ sentence_count: 40, line_count: 37, new_word_count: 10 }, limits)).toBe(2);
    expect(suggestedParts({ sentence_count: 20, line_count: 20, new_word_count: 46 }, limits)).toBe(2);
    expect(suggestedParts({ sentence_count: 80, line_count: 73, new_word_count: 51 }, limits)).toBe(3);
  });

  it("only text sentences count: the title and the word-list reading do not", () => {
    // NN35-like: 48 sentences, but 17 of them read the word list
    expect(suggestedParts({ sentence_count: 48, line_count: 31, new_word_count: 40 }, limits)).toBe(1);
    // an index without line_count falls back to sentence_count
    expect(suggestedParts({ sentence_count: 48, new_word_count: 40 }, limits)).toBe(2);
  });
});

describe("dividing the sentences", () => {
  it("even sizes, earlier parts one longer; `from` moves a boundary", () => {
    const ids = ["a", "b", "c", "d", "e"];
    expect(partStarts(ids, [undefined, undefined])).toEqual([0, 3]);
    expect(partStarts(ids, [undefined, undefined, undefined])).toEqual([0, 2, 4]);
    expect(partStarts(ids, [undefined, "e"])).toEqual([0, 4]);
    // an unknown or out-of-order `from` falls back to the even split
    expect(partStarts(ids, [undefined, "zz"])).toEqual([0, 3]);
    expect(partStarts(ids, [undefined, "d", "b"])).toEqual([0, 3, 4]);
    // a `from` that would leave a later part empty is not used
    expect(partStarts(ids, [undefined, "e", undefined])).toEqual([0, 2, 4]);
    expect(partStarts(ids, [undefined, undefined, "a"])).toEqual([0, 2, 4]);
    expect(partSizes(35, [undefined, undefined])).toEqual([18, 17]);
    expect(partSizes(49, [undefined, undefined, undefined])).toEqual([17, 16, 16]);
    // with only the counts known, "NN22-S18" is the 18th text sentence
    expect(partSizes(28, [undefined, "NN22-S18"])).toEqual([17, 11]);
    expect(partSizes(28, [undefined, "NN22-S99"])).toEqual([14, 14]);
  });

  it("parts of a pack lesson: text sentences, recording stretch, words where first met, book material last", () => {
    const [a, b] = packLessonParts(nn21, [{}, {}]);
    // the 9 text sentences are halved; the word-list reading (S10, S11) goes with the last part
    expect(ids(a.sentences)).toEqual(["S01", "S02", "S03", "S04", "S05"]);
    expect(ids(b.sentences)).toEqual(["S06", "S07", "S08", "S09", "S10", "S11"]);
    // the title belongs to part 1
    expect(ids(a.full)).toEqual(["S00", "S01", "S02", "S03", "S04", "S05"]);
    expect(ids(b.full)).toEqual(["S06", "S07", "S08", "S09", "S10", "S11"]);
    expect(a.segment).toEqual({ start: 0, end: 15.71 });
    expect(b.segment!.start).toBeCloseTo(15.66);
    expect(b.segment!.end).toBeCloseTo(30.93);
    expect(a.wordIds).toContain("w_dank_u_wel");
    expect(a.wordIds).not.toContain("w_dollar");
    expect(b.wordIds).toEqual([
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
    expect([a.last, b.last]).toEqual([false, true]);
    // not split: everything in one part
    const [all] = packLessonParts(nn21, [{}]);
    expect(all.sentences).toHaveLength(11);
    expect(all.segment).toBeUndefined();
    expect(all.wordIds).toEqual(nn21.word_ids);
  });

  it("`from` names a text sentence; every part keeps at least one", () => {
    const [, late] = packLessonParts(nn21, [{}, { from: "NN21-S09" }]);
    expect(ids(late.sentences)).toEqual(["S09", "S10", "S11"]);
    // a word-list sentence is not a split point: the even split is used
    const [, extra] = packLessonParts(nn21, [{}, { from: "NN21-S10" }]);
    expect(ids(extra.sentences)).toEqual(["S06", "S07", "S08", "S09", "S10", "S11"]);
    const thirds = packLessonParts(nn21, [{}, {}, {}]);
    expect(thirds.map((p) => ids(p.sentences))).toEqual([
      ["S01", "S02", "S03"],
      ["S04", "S05", "S06"],
      ["S07", "S08", "S09", "S10", "S11"],
    ]);
    // more parts than text sentences: every part with a text sentence, the rest empty (the check reports it)
    const many = packLessonParts(
      nn21,
      Array.from({ length: 10 }, () => ({})),
    );
    expect(many.slice(0, 9).every((p) => p.sentences.some((s) => s.role === "line"))).toBe(true);
    expect(many[9].sentences.map((s) => s.role)).toEqual(["extra", "extra"]);
  });
});
