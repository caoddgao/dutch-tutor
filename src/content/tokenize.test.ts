import { describe, expect, it } from "vitest";
import { buildFormIndex, segmentSentence, splitWords, tokenize, uncoveredWords } from "./tokenize";

const words = [
  {
    id: "w_wonen",
    lemma: "wonen",
    verb_forms: { ik: "woon", jij: "woont", hij: "woont", wij: "wonen" },
    forms_seen: [],
  },
  { id: "w_tot_ziens", lemma: "tot ziens" },
  { id: "w_tot", lemma: "tot" },
  { id: "w_ik", lemma: "ik" },
  { id: "w_huis", lemma: "huis", plural: "huizen" },
  { id: "w_zijn", lemma: "zijn", verb_forms: { ik: "ben", hij: "is" } },
];

describe("tokenize", () => {
  it("splits words, keeping inner apostrophes and skipping numbers", () => {
    expect(splitWords("Het is 3 uur, 's ochtends! Euro's?").map((w) => w.text)).toEqual([
      "Het",
      "is",
      "uur",
      "'s",
      "ochtends",
      "Euro's",
    ]);
  });

  it("maps inflected forms to their lemma and prefers the longest expression", () => {
    const index = buildFormIndex(words);
    expect(tokenize("Ik woon in huizen. Tot ziens!", index)).toEqual([
      { t: "Ik", word_id: "w_ik" },
      { t: "woon", word_id: "w_wonen" },
      { t: "in", word_id: null },
      { t: "huizen", word_id: "w_huis" },
      { t: "Tot ziens", word_id: "w_tot_ziens" },
    ]);
  });

  it("lays tokens over the text for click-to-lookup", () => {
    const segs = segmentSentence("Hij woont in Utrecht.", [
      { t: "woont", word_id: "w_wonen" },
      { t: "Utrecht", word_id: "w_utrecht" },
    ]);
    expect(segs).toEqual([
      { text: "Hij " },
      { text: "woont", wordId: "w_wonen" },
      { text: " in " },
      { text: "Utrecht", wordId: "w_utrecht" },
      { text: "." },
    ]);
    expect(uncoveredWords("Hij woont in Utrecht.", [{ t: "woont", word_id: "x" }])).toEqual(["Hij", "in", "Utrecht"]);
  });

  it("finds repeated tokens in order (split verbs)", () => {
    const segs = segmentSentence("Hij belt op, op tijd.", [
      { t: "belt", word_id: "w_opbellen" },
      { t: "op", word_id: "w_opbellen" },
    ]);
    expect(segs.filter((s) => s.wordId).map((s) => s.text)).toEqual(["belt", "op"]);
    expect(segs.map((s) => s.text).join("")).toBe("Hij belt op, op tijd.");
  });
});
