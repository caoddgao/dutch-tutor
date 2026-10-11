// Split lessons (design §2.1): a pack lesson with too many sentences or new words is taught as 2–3 course
// lessons ("第 24 课 a / b"). course.json lists each part; the sentences are divided here, the same way for
// the app (model.ts) and for the content check (validate.ts).
import type { CourseDef, CourseLessonRef, LessonPart } from "./ownTypes";
import type { PackIndexLesson, PackLesson, PackSentence } from "./packTypes";

export type Limits = CourseDef["limits"];

type SplitStat = Pick<PackIndexLesson, "sentence_count" | "new_word_count"> & { line_count?: number };

/** Text sentences (`role: "line"`) a lesson has; an index without `line_count` falls back to `sentence_count`. */
export const lineCount = (stat: SplitStat) => stat.line_count ?? stat.sentence_count;

/** Parts a lesson needs so that each stays within the limits (rule 7); only text sentences count. */
export function suggestedParts(stat: SplitStat, limits: Limits) {
  return Math.max(
    1,
    Math.ceil(lineCount(stat) / limits.max_sentences),
    Math.ceil(stat.new_word_count / limits.max_new_words),
  );
}

/** Part letters: 1 → a, 2 → b … */
export const partLetter = (n: number) => String.fromCharCode(96 + n);

/**
 * First index of each part in a list of `ids`: even sizes (earlier parts take the extra one); a part's
 * `from` (the id it starts with) overrides that when it is found, keeps the parts in order and leaves at
 * least one id for every later part. Parts are only empty when there are fewer ids than parts.
 */
export function partStarts(ids: string[], from: (string | undefined)[]): number[] {
  const of = Math.max(1, from.length);
  const starts: number[] = [0];
  for (let i = 1; i < of; i++) {
    const lo = starts[i - 1] + 1;
    const hi = ids.length - (of - i);
    const even = Math.ceil((ids.length * i) / of);
    const given = from[i] ? ids.indexOf(from[i]!) : -1;
    const start = given >= lo && given <= hi ? given : Math.min(Math.max(even, lo), hi);
    starts.push(Math.min(Math.max(start, lo), ids.length));
  }
  return starts.map((s) => Math.min(s, ids.length));
}

/**
 * Text sentences in each part when only the count is known (split plan, course map before the lesson is
 * opened); `from` holds each part's start, e.g. "NN22-S18", read as the 18th text sentence (S00 is the title).
 */
export function partSizes(count: number, from: (string | undefined)[]): number[] {
  const ids = Array.from({ length: count }, (_, i) => String(i + 1));
  const starts = partStarts(
    ids,
    from.map((f) => {
      const m = f?.match(/-S(\d+)$/);
      return m ? String(Number(m[1])) : undefined;
    }),
  );
  return starts.map((s, i) => (starts[i + 1] ?? count) - s);
}

/** The course entries that teach one pack lesson, in part order (one entry when it is not split). */
export function partRefs(course: CourseDef, packId: string): CourseLessonRef[] {
  return course.sections
    .flatMap((s) => s.lessons)
    .filter((r) => r.source === "pack" && (r.pack_id ?? r.id) === packId)
    .sort((a, b) => (a.part?.n ?? 1) - (b.part?.n ?? 1));
}

export interface PackPartView {
  /** Step ②: the part's text sentences ("line"), in order; the last part also has the word-list reading ("extra") */
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

/**
 * Divides a pack lesson into its parts; `parts` are the course entries' part settings, in order. Only the
 * text sentences are divided (a `from` must name one); the word-list reading goes with the last part.
 */
export function packLessonParts(pack: PackLesson, parts: Pick<LessonPart, "from">[]): PackPartView[] {
  const of = Math.max(1, parts.length);
  const taught = pack.sentences.filter(taughtRole);
  if (of === 1) {
    return [{ sentences: taught, full: pack.sentences, wordIds: [...(pack.word_ids ?? [])], last: true }];
  }
  const position = new Map(pack.sentences.map((s, i) => [s.id, i]));
  const lines = taught.filter((s) => s.role === "line");
  const starts = partStarts(
    lines.map((s) => s.id),
    parts.map((p) => p.from),
  );
  // where each part's stretch of the lesson begins (part 1 with the title); the last runs to the end
  const bounds = starts.map((s, i) => (i === 0 ? 0 : (position.get(lines[s]?.id) ?? pack.sentences.length)));
  const at = (i: number) => (i === of - 1 ? pack.sentences.length : bounds[i + 1]);
  const inStretch = (s: PackSentence, i: number) => {
    const p = position.get(s.id)!;
    return p >= bounds[i] && p < at(i);
  };
  const chunks = starts.map((_, i) =>
    i === of - 1
      ? [
          ...taught.filter((s) => inStretch(s, i)),
          ...taught.filter((s) => s.role === "extra" && position.get(s.id)! < bounds[i]),
        ]
      : taught.filter((s) => s.role === "line" && inStretch(s, i)),
  );

  const firstPart = new Map<string, number>();
  chunks.forEach((chunk, i) => {
    for (const s of chunk) for (const t of s.tokens ?? []) if (!firstPart.has(t.word_id)) firstPart.set(t.word_id, i);
  });
  const wordIds: string[][] = chunks.map(() => []);
  for (const id of pack.word_ids ?? []) wordIds[firstPart.get(id) ?? of - 1].push(id);

  return chunks.map((chunk, i) => {
    const full = pack.sentences.slice(bounds[i], at(i));
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
