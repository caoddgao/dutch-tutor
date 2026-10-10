// Split lessons (design §2.1): a pack lesson with too many sentences or new words is taught as 2–3 course
// lessons ("第 24 课 a / b"). course.json lists each part; the sentences are divided here, the same way for
// the app (model.ts) and for the content check (validate.ts).
import type { CourseDef, CourseLessonRef, LessonPart } from "./ownTypes";
import type { PackIndexLesson, PackLesson, PackSentence } from "./packTypes";

export type Limits = CourseDef["limits"];

/** Parts a lesson needs so that each stays within the limits (rule 7). */
export function suggestedParts(stat: Pick<PackIndexLesson, "sentence_count" | "new_word_count">, limits: Limits) {
  return Math.max(
    1,
    Math.ceil(stat.sentence_count / limits.max_sentences),
    Math.ceil(stat.new_word_count / limits.max_new_words),
  );
}

/** Part letters: 1 → a, 2 → b … */
export const partLetter = (n: number) => String.fromCharCode(96 + n);

/**
 * First index of each part in a list of `ids`: even sizes (earlier parts take the extra one); a part's
 * `from` (the id it starts with) overrides that when it is found and keeps the parts in order.
 */
export function partStarts(ids: string[], from: (string | undefined)[]): number[] {
  const of = Math.max(1, from.length);
  const starts: number[] = [];
  for (let i = 0; i < of; i++) {
    const even = i === 0 ? 0 : Math.ceil((ids.length * i) / of);
    const given = i === 0 || !from[i] ? -1 : ids.indexOf(from[i]!);
    const prev = i === 0 ? -1 : starts[i - 1];
    starts.push(given > prev ? given : Math.max(even, prev + 1));
  }
  return starts.map((s) => Math.min(s, ids.length));
}

/** Sentences of a part when only the count is known (course map progress before the lesson is opened). */
export function partSize(count: number, n: number, of: number): number {
  const ids = Array.from({ length: count }, (_, i) => String(i));
  const starts = partStarts(ids, Array.from({ length: of }));
  return (starts[n] ?? count) - (starts[n - 1] ?? 0);
}

/** The course entries that teach one pack lesson, in part order (one entry when it is not split). */
export function partRefs(course: CourseDef, packId: string): CourseLessonRef[] {
  return course.sections
    .flatMap((s) => s.lessons)
    .filter((r) => r.source === "pack" && (r.pack_id ?? r.id) === packId)
    .sort((a, b) => (a.part?.n ?? 1) - (b.part?.n ?? 1));
}

export interface PackPartView {
  /** Step ②: the part's sentences ("line" and "extra", in order) */
  sentences: PackSentence[];
  /** Step ①: the stretch of the full recording this part covers (the title belongs to part 1) */
  full: PackSentence[];
  /** Where that stretch is in full.mp3; absent when the lesson is not split */
  segment?: { start: number; end: number };
  /** The lesson's word list, each word in the part where it first occurs; unused words go to the last part */
  wordIds: string[];
  /** The book's exercises and EXTRA boxes go with the last part, after the whole text */
  last: boolean;
}

const taughtRole = (s: PackSentence) => s.role === "line" || s.role === "extra";

/** Divides a pack lesson into its parts; `parts` are the course entries' part settings, in order. */
export function packLessonParts(pack: PackLesson, parts: Pick<LessonPart, "from">[]): PackPartView[] {
  const of = Math.max(1, parts.length);
  const taught = pack.sentences.filter(taughtRole);
  if (of === 1) {
    return [{ sentences: taught, full: pack.sentences, wordIds: [...(pack.word_ids ?? [])], last: true }];
  }
  const starts = partStarts(
    taught.map((s) => s.id),
    parts.map((p) => p.from),
  );
  const chunks = starts.map((s, i) => taught.slice(s, starts[i + 1] ?? taught.length));

  const firstPart = new Map<string, number>();
  chunks.forEach((chunk, i) => {
    for (const s of chunk) for (const t of s.tokens ?? []) if (!firstPart.has(t.word_id)) firstPart.set(t.word_id, i);
  });
  const wordIds: string[][] = chunks.map(() => []);
  for (const id of pack.word_ids ?? []) wordIds[firstPart.get(id) ?? of - 1].push(id);

  const position = new Map(pack.sentences.map((s, i) => [s.id, i]));
  return chunks.map((chunk, i) => {
    const from = i === 0 ? 0 : (position.get(chunk[0]?.id) ?? pack.sentences.length);
    const to = i === of - 1 ? pack.sentences.length : (position.get(chunks[i + 1][0]?.id) ?? pack.sentences.length);
    const full = pack.sentences.slice(from, to);
    const timed = full.filter((s) => s.start !== undefined && s.end !== undefined);
    const segment =
      timed.length > 0
        ? {
            start: i === 0 ? 0 : Math.max(0, Math.min(...timed.map((s) => s.start!)) - 0.2),
            end: Math.max(...timed.map((s) => s.end!)) + (i === of - 1 ? 0.6 : 0.3),
          }
        : undefined;
    return { sentences: chunk, full, segment, wordIds: wordIds[i], last: i === of - 1 };
  });
}
