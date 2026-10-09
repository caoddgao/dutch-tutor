// Splitting Dutch sentences into dictionary words (design §6: every word in a sentence opens its entry).
import type { PackToken, VerbForms } from "./packTypes";

/** Longest fixed expression we try to match, in words ("tot ziens", "hoe gaat het"). */
const MAX_PHRASE_WORDS = 4;

/** Words: letters with inner apostrophes / hyphens, or a leading apostrophe ('s, 't). Numbers are not words. */
const WORD_RE = /['’]?[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*/gu;

export function splitWords(text: string): { text: string; start: number; end: number }[] {
  const out: { text: string; start: number; end: number }[] = [];
  for (const m of text.matchAll(WORD_RE)) {
    out.push({ text: m[0], start: m.index, end: m.index + m[0].length });
  }
  return out;
}

export function normalizeForm(form: string): string {
  return form.toLowerCase().replace(/’/g, "'").replace(/\s+/g, " ").trim();
}

export interface DictWordLike {
  id: string;
  lemma: string;
  forms_seen?: string[];
  verb_forms?: VerbForms | null;
  plural?: string | null;
}

/** form (lower case) → word id. The lemma wins over another word's inflected form. */
export function buildFormIndex(words: DictWordLike[]): Map<string, string> {
  const index = new Map<string, string>();
  const weak = new Map<string, string>();
  for (const w of words) {
    index.set(normalizeForm(w.lemma), w.id);
    const forms = [
      ...(w.forms_seen ?? []),
      ...(w.plural ? [w.plural] : []),
      ...Object.entries(w.verb_forms ?? {})
        .filter(([k]) => k !== "aux")
        .map(([, v]) => v as string),
    ];
    for (const f of forms) if (f) weak.set(normalizeForm(f), w.id);
  }
  for (const [form, id] of weak) if (!index.has(form)) index.set(form, id);
  return index;
}

export interface AutoToken {
  t: string;
  word_id: string | null;
}

/** Greedy longest match against the form index; unknown words get word_id null. */
export function tokenize(text: string, index: Map<string, string>): AutoToken[] {
  const words = splitWords(text);
  const out: AutoToken[] = [];
  let i = 0;
  while (i < words.length) {
    let matched = false;
    for (let n = Math.min(MAX_PHRASE_WORDS, words.length - i); n >= 1; n--) {
      const surface = text.slice(words[i].start, words[i + n - 1].end);
      const key = normalizeForm(
        words
          .slice(i, i + n)
          .map((w) => w.text)
          .join(" "),
      );
      const id = index.get(key);
      if (id) {
        out.push({ t: surface, word_id: id });
        i += n;
        matched = true;
        break;
      }
    }
    if (!matched) {
      out.push({ t: words[i].text, word_id: null });
      i += 1;
    }
  }
  return out;
}

export interface Segment {
  text: string;
  wordId?: string;
}

/**
 * Lays tokens over the sentence text so every token becomes a clickable span and everything else
 * (spaces, punctuation, numbers) stays plain. Tokens are found in order, case-insensitively.
 */
export function segmentSentence(text: string, tokens: PackToken[]): Segment[] {
  const lower = text.toLowerCase();
  const segments: Segment[] = [];
  let cursor = 0;
  for (const tok of tokens) {
    const pos = lower.indexOf(tok.t.toLowerCase(), cursor);
    if (pos < 0) continue;
    if (pos > cursor) segments.push({ text: text.slice(cursor, pos) });
    segments.push({ text: text.slice(pos, pos + tok.t.length), wordId: tok.word_id });
    cursor = pos + tok.t.length;
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor) });
  return segments;
}

/** Words of the sentence that no token covers (numbers excluded). Used by content check rule 4. */
export function uncoveredWords(text: string, tokens: PackToken[]): string[] {
  const covered = new Set<number>();
  const lower = text.toLowerCase();
  let cursor = 0;
  for (const tok of tokens) {
    const pos = lower.indexOf(tok.t.toLowerCase(), cursor);
    if (pos < 0) continue;
    for (let k = pos; k < pos + tok.t.length; k++) covered.add(k);
    cursor = pos + tok.t.length;
  }
  return splitWords(text)
    .filter((w) => !covered.has(w.start))
    .map((w) => w.text);
}
