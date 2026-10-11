import type { RtLesson } from "../content/model";
import type { ReviewSeed } from "../storage/learning";

/**
 * What a finished lesson puts into the review queue (design §4.1): its sentences and its new words, a phonics
 * lesson's reading text included. Single-word "extra" lines (number lists read aloud) are reviewed as words,
 * not as sentences; names and letters of the alphabet are not reviewed.
 */
export function reviewSeeds(lesson: RtLesson): ReviewSeed[] {
  const sentences = [...lesson.sentences, ...(lesson.reading?.sentences ?? [])]
    .filter((s) => s.kind !== "extra" || s.tokens.length > 1)
    .map((s) => ({ id: s.id, type: "sentence" as const }));
  const newIds = new Set([...lesson.newWordIds, ...(lesson.reading?.newWordIds ?? [])]);
  const seen = new Set<string>();
  const words = [...lesson.words, ...(lesson.reading?.words ?? [])]
    .filter((w) => newIds.has(w.id) && w.pos !== "eigen" && !w.letter && !seen.has(w.id) && seen.add(w.id))
    .map((w) => ({ id: w.id, type: "word" as const }));
  return [...sentences, ...words];
}
