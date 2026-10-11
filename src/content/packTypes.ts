// Naar Nederland resource pack, format_version 1 (docs/03_PACK_FORMAT.md).
// The pack lives only on the user's computer; the repo holds a self-written fixture with the same format.

export const PACK_FORMAT_VERSION = 1;

export interface Trilingual {
  nl: string;
  zh: string;
  en: string;
}

export interface PackManifest {
  format_version: number;
  source: string;
  created_at: string;
  producer: string;
  lessons: string[];
  counts: { lessons: number; sentences: number; words: number; exercises: number; audio_files: number };
  tts_voices: { default: string; male: string };
}

export type PackLessonKind = "main" | "phonics" | "reading" | "test";
export type TextType = "dialogue" | "text" | "mixed";
export type SentenceRole = "title" | "line" | "extra";
export type SentenceFlag = "over_5s" | "low_align" | "manual_fixed" | "no_audio";

export interface PackToken {
  t: string;
  word_id: string;
}

export interface PackSentence {
  id: string;
  role: SentenceRole;
  nl: string;
  zh: string;
  en: string;
  speaker: string | null;
  audio: string | null;
  start?: number;
  end?: number;
  duration?: number;
  align_score?: number;
  tokens?: PackToken[];
  flags: SentenceFlag[];
}

export type PackExerciseType =
  "true_false" | "choose_one" | "match" | "fill_choice" | "answer_oral" | "order" | "listen_choose" | "other";

export interface PackExerciseItem {
  id: string;
  prompt?: string;
  options?: string[];
  /** fill_choice: the item's own word bank (the book prints several); falls back to the exercise bank */
  bank?: string[];
  answer?: string;
  zh?: string;
  en?: string;
  audio?: string | null;
  example?: boolean;
  extra?: boolean;
  answer_by?: string;
  /** match */
  left?: string[];
  right?: string[];
  pairs?: [number, number][];
  /** answer_oral */
  sample_answers?: string[];
  /** order: the correct order */
  tokens?: string[];
  /** other */
  raw?: string;
}

export interface PackExercise {
  id: string;
  nn_number?: number;
  type: PackExerciseType;
  instruction: Trilingual;
  items: PackExerciseItem[];
  /** fill_choice word bank (items may carry their own, see fillBank) */
  bank?: string[];
  extra?: boolean;
  skip: boolean;
  skip_reason: string | null;
}

export interface PackExtraSentence {
  id: string;
  nl: string;
  zh: string;
  en: string;
  audio: string | null;
  audio_source?: string;
  tokens?: PackToken[];
}

export interface PackExtra {
  id: string;
  pdf_page?: number;
  sentences: PackExtraSentence[];
}

export interface PackSound {
  grapheme: string;
  /** keyword ids local to the lesson, e.g. "K01" */
  keywords: string[];
  note_zh?: string;
}

export interface PackKeyword {
  id: string;
  nl: string;
  word_id: string;
  audio: string | null;
  start?: number;
  end?: number;
  align_score?: number;
  flags: SentenceFlag[];
}

export interface PackLesson {
  id: string;
  nn_lesson: number;
  kind: PackLessonKind;
  title: Trilingual;
  pdf_pages?: number[];
  text_type?: TextType;
  audio_full?: string | null;
  sentences: PackSentence[];
  word_ids?: string[];
  exercises: PackExercise[];
  extras?: PackExtra[];
  sounds?: PackSound[];
  keywords?: PackKeyword[];
  notes?: string;
}

export type Pos = "zn" | "ww" | "bn" | "bw" | "vnw" | "lidw" | "vz" | "vw" | "telw" | "tw" | "eigen" | "uitdr";

export interface VerbForms {
  ik?: string;
  jij?: string;
  hij?: string;
  wij?: string;
  pp?: string;
  aux?: string;
}

export interface PackWord {
  id: string;
  lemma: string;
  pos: Pos;
  article: "de" | "het" | "de/het" | null;
  plural: string | null;
  verb_forms: VerbForms | null;
  separable: string | null;
  forms_seen: string[];
  zh: string;
  en: string;
  /** Original meanings from the official word lists; null when a list lacks the word */
  zh_nn?: string | null;
  en_nn?: string | null;
  first_lesson?: string;
  lessons?: string[];
  audio: string | null;
  audio_source?: string;
  flags: string[];
}

export interface PackIndexLesson {
  id: string;
  kind: PackLessonKind;
  title: Trilingual;
  /** All sentences, the word-list reading included (03 §8) */
  sentence_count: number;
  /** Text sentences only (`role: "line"`); lessons are split by this count (design §2.1). Older indexes lack it */
  line_count?: number;
  new_word_count: number;
  total_seconds: number;
  max_sentence_seconds: number;
  over_5s_count: number;
  exercise_count: number;
  skipped_exercises: number;
  new_lemmas: string[];
}

export interface PackIndex {
  format_version: number;
  lessons: PackIndexLesson[];
}

/** fill_choice: the bank an item uses — its own when the book prints several, else the exercise's (03 §4). */
export function fillBank(ex: Pick<PackExercise, "bank">, item: Pick<PackExerciseItem, "bank">): string[] {
  return item.bank && item.bank.length > 0 ? item.bank : (ex.bank ?? []);
}
