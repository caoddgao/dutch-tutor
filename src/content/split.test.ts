// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { PackLesson } from "./packTypes";
import { packLessonParts, partSize, partStarts, suggestedParts } from "./split";
import { FIXTURE_PACK_DIR } from "../test/services";

const nn21 = JSON.parse(readFileSync(join(FIXTURE_PACK_DIR, "lessons/NN21.json"), "utf8")) as PackLesson;
const limits = { max_sentences: 24, max_new_words: 45 };

describe("split suggestions (design §2.1)", () => {
  it("splits when sentences > 24 or new words > 45, into as many parts as needed", () => {
    expect(suggestedParts({ sentence_count: 20, new_word_count: 18 }, limits)).toBe(1);
    expect(suggestedParts({ sentence_count: 24, new_word_count: 45 }, limits)).toBe(1);
    expect(suggestedParts({ sentence_count: 25, new_word_count: 10 }, limits)).toBe(2);
    expect(suggestedParts({ sentence_count: 20, new_word_count: 46 }, limits)).toBe(2);
    expect(suggestedParts({ sentence_count: 49, new_word_count: 51 }, limits)).toBe(3);
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
    expect([1, 2].map((n) => partSize(35, n, 2))).toEqual([18, 17]);
    expect([1, 2, 3].map((n) => partSize(49, n, 3))).toEqual([17, 16, 16]);
  });

  it("parts of a pack lesson: sentences, recording stretch, words where first met, book material last", () => {
    const [a, b] = packLessonParts(nn21, [{}, {}]);
    expect(a.sentences.map((s) => s.id)).toEqual([
      "NN21-S01",
      "NN21-S02",
      "NN21-S03",
      "NN21-S04",
      "NN21-S05",
      "NN21-S06",
    ]);
    expect(b.sentences.map((s) => s.id)).toEqual(["NN21-S07", "NN21-S08", "NN21-S09", "NN21-S10", "NN21-S11"]);
    // the title belongs to part 1
    expect(a.full[0].id).toBe("NN21-S00");
    expect(b.full[0].id).toBe("NN21-S07");
    expect(a.segment).toEqual({ start: 0, end: 21.46 });
    expect(b.segment!.start).toBeCloseTo(21.41);
    expect(b.segment!.end).toBeCloseTo(30.93);
    expect(a.wordIds).toContain("w_dollar");
    expect(a.wordIds).not.toContain("w_tot_ziens");
    expect(b.wordIds).toEqual(["w_dank_u", "w_tot_ziens", "w_vier", "w_vijf"]);
    expect([a.last, b.last]).toEqual([false, true]);
    // not split: everything in one part
    const [all] = packLessonParts(nn21, [{}]);
    expect(all.sentences).toHaveLength(11);
    expect(all.segment).toBeUndefined();
    expect(all.wordIds).toEqual(nn21.word_ids);
  });
});
