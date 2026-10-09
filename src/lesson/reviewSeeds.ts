import type { RtLesson } from "../content/model";
import type { ReviewSeed } from "../storage/learning";

/**
 * What a finished lesson puts into the review queue (design §4.1): its sentences and its new words.
 * Single-word "extra" lines (number lists read aloud) are reviewed as words, not as sentences;
 * names are not reviewed.
 */
export function reviewSeeds(lesson: RtLesson): ReviewSeed[] {
  const sentences = lesson.sentences
    .filter((s) => s.kind !== "extra" || s.tokens.length > 1)
    .map((s) => ({ id: s.id, type: "sentence" as const }));
  const words = lesson.words
    .filter((w) => lesson.newWordIds.includes(w.id) && w.pos !== "eigen")
    .map((w) => ({ id: w.id, type: "word" as const }));
  return [...sentences, ...words];
}
