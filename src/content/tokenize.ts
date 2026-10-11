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
  flags?: string[];
  first_lesson?: string;
}

/** NN lesson 20 is the alphabet: the words first met there are letters. */
export const ALPHABET_LESSON = "NN20";

/** Letters of the alphabet (P09) are entries for their sound only: never words of a sentence ("u", "i"). */
export function isLetter(w: Pick<DictWordLike, "flags" | "first_lesson">): boolean {
  return !!w.flags?.includes("letter") || w.first_lesson === ALPHABET_LESSON;
}

/**
 * form (lower case) → word id. The lemma wins over another word's inflected form; of two words with the same
 * lemma (de dag / dag!) the one listed first, i.e. met first, wins. Letters are left out.
 */
export function buildFormIndex(words: DictWordLike[]): Map<string, string> {
  const index = new Map<string, string>();
  const weak = new Map<string, string>();
  for (const w of words) {
    if (isLetter(w)) continue;
    if (!index.has(normalizeForm(w.lemma))) index.set(normalizeForm(w.lemma), w.id);
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

/** Irregular forms of the common verbs (function words), for words not in the index. */
const IRREGULAR: Record<string, string[]> = {
  ben: ["zijn"],
  bent: ["zijn"],
  is: ["zijn"],
  heb: ["hebben"],
  hebt: ["hebben"],
  heeft: ["hebben"],
  kan: ["kunnen"],
  kun: ["kunnen"],
  kunt: ["kunnen"],
  mag: ["mogen"],
  zal: ["zullen"],
  zult: ["zullen"],
  wil: ["willen"],
  wilt: ["willen"],
};

const V = "aeiou";
const isVowel = (c: string | undefined) => !!c && V.includes(c);

/** woon → won, maak → mak: a long vowel written double in a closed syllable is single in an open one */
function undouble(stem: string): string | null {
  const m = stem.match(/^(.*?)(aa|ee|oo|uu)([^aeiou])$/);
  return m ? m[1] + m[2][0] + m[3] : null;
}

/** nam → naam, jar → jaar: a single vowel before one consonant at the end was long */
function redouble(base: string): string | null {
  const m = base.match(/^(.*[^aeiou])([aeiou])([^aeiou])$/);
  return m ? m[1] + m[2] + m[2] + m[3] : null;
}

const devoice = (s: string) => s.replace(/v$/, "f").replace(/z$/, "s");
const voice = (s: string) => s.replace(/f$/, "v").replace(/s$/, "z");

/**
 * Dictionary forms an inflected word may come from, most likely first: a verb's stem or -t form → the
 * infinitive (woont → wonen, zit → zitten, ga → gaan), a plural → the singular (huizen → huis, namen → naam),
 * an adjective with -e → its base form (grote → groot). Used when a form is not in the index: our own
 * sentences may use forms the word lists do not have.
 */
export function lemmaCandidates(form: string): string[] {
  const f = normalizeForm(form);
  const out: string[] = [...(IRREGULAR[f] ?? [])];
  const add = (c: string | null) => {
    if (c && c.length > 1 && c !== f && !out.includes(c)) out.push(c);
  };
  // verbs: the stem (ik woon) or stem + t (hij woont) → infinitive
  const stems = f.length > 2 && f.endsWith("t") && !f.endsWith("tt") ? [f, f.slice(0, -1)] : [f];
  for (const stem of stems) {
    const u = undouble(stem);
    if (u) {
      add(voice(u) + "en");
      add(u + "en");
    }
    const last = stem.slice(-1);
    if (stem === f && isVowel(last) && !isVowel(stem.slice(-2, -1))) add(stem + last + "n"); // ga → gaan
    if (/(aa|oe|ie|[^e]e)$/.test(stem)) add(stem + "n"); // doe(t) → doen, gaa(t) → gaan, douche → douchen
    if (!isVowel(last) && isVowel(stem.slice(-2, -1)) && !isVowel(stem.slice(-3, -2)) && !u) add(stem + last + "en"); // bel → bellen
    if (/[aeiou][aeiou]?[fs]$|[ij][fs]$/.test(stem)) add(voice(stem) + "en"); // blijf → blijven, reis → reizen
    add(stem + "en");
  }
  // plurals (-en, -s, -'s) and adjectives with -e → the base form
  const bases: string[] = [];
  if (f.endsWith("en") && f.length > 3) bases.push(f.slice(0, -2));
  if (f.endsWith("'s")) bases.push(f.slice(0, -2));
  else if (f.endsWith("s") && f.length > 3) bases.push(f.slice(0, -1));
  if (f.endsWith("e") && f.length > 2) bases.push(f.slice(0, -1));
  for (const b of bases) {
    const d = devoice(b);
    if (/([^aeiou])\1$/.test(b)) add(b.slice(0, -1)); // bedden → bed, dikke → dik
    add(redouble(d));
    add(d);
    add(redouble(b));
    add(b);
  }
  return out;
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
      const lemma = lemmaCandidates(words[i].text).find((c) => index.has(c));
      out.push({ t: words[i].text, word_id: lemma ? index.get(lemma)! : null });
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
