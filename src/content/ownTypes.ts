// Our own content in the repo: content/a1/ (docs/01_DESIGN.md §10). JSON Schemas: content/schema/.
import type { Pos, Trilingual, VerbForms } from "./packTypes";

export type Voice = "default" | "male";

export interface CourseLessonRef {
  id: string;
  /** "own": content/a1/lessons/<id>.json; "pack": the resource pack (plus an optional own half) */
  source: "own" | "pack";
  /** Pack lesson id, defaults to id */
  pack_id?: string;
  /** One part of a split pack lesson (design §2.1) */
  part?: LessonPart;
}

export interface LessonPart {
  /** 1-based; shown as a letter ("第 24 课 b") */
  n: number;
  of: number;
  /** Sentence id the part starts with; default: the sentences are divided evenly */
  from?: string;
}

export interface CourseSectionDef {
  id: "phonics" | "main" | "tests";
  title: string;
  lessons: CourseLessonRef[];
}

export interface CourseDef {
  level: "A1";
  /** Lessons above these limits are reported as candidates for splitting (design §2.1, rule 7) */
  limits: { max_sentences: number; max_new_words: number };
  sections: CourseSectionDef[];
}

export interface OwnSentence {
  id: string;
  nl: string;
  zh: string;
  en: string;
  speaker?: string | null;
  voice?: Voice;
}

export interface OwnSound {
  grapheme: string;
  note_zh: string;
  note_en?: string;
  word_ids: string[];
}

interface OwnExerciseBase {
  id: string;
  instruction: Trilingual;
  extra?: boolean;
}

/** E3: hear a word, pick its spelling */
export interface ListenChooseExercise extends OwnExerciseBase {
  type: "listen_choose";
  items: { id: string; word_id: string; options: string[]; answer: string }[];
}

/** E4: see a word, pick its pronunciation from the audio of several words */
export interface ChooseAudioExercise extends OwnExerciseBase {
  type: "choose_audio";
  items: { id: string; word_id: string; options: string[] }[];
}

/** E7: put word blocks in order */
export interface OrderExercise extends OwnExerciseBase {
  type: "order";
  items: { id: string; sentence_id: string }[];
}

export interface OralSample {
  nl: string;
  zh: string;
  en: string;
}

/** E5: hear a situation and the start of the next sentence, finish it aloud */
export interface OralCompleteExercise extends OwnExerciseBase {
  type: "oral_complete";
  items: { id: string; context: OralSample; start: OralSample; sample_answers: OralSample[] }[];
}

/** E6: hear an everyday question, answer aloud */
export interface OralAnswerExercise extends OwnExerciseBase {
  type: "oral_answer";
  items: { id: string; question: OralSample; sample_answers: OralSample[] }[];
}

/** E9: one everyday text, followed by two reading comprehension choices; no audio. */
export interface ReadPassageExercise extends OwnExerciseBase {
  type: "read_passage";
  passage: OralSample[];
  items: { id: string; question: OralSample; options: OralSample[]; answer: string }[];
}

export type OwnExercise =
  | ListenChooseExercise
  | ChooseAudioExercise
  | OrderExercise
  | OralCompleteExercise
  | OralAnswerExercise
  | ReadPassageExercise;

export interface OwnLesson {
  id: string;
  kind: "phonics" | "main";
  title?: Trilingual;
  /** main: the pack lesson this file completes ("our half") */
  pack_lesson?: string;
  /** phonics: NN lessons 1–20 whose keyword audio and exercises are reused when the pack is installed */
  nn_lessons?: string[];
  /**
   * phonics: an NN reading text (NN14–19, pack kind "reading") at the end of the lesson — listen to the original,
   * then shadow it sentence by sentence; its exercises are not used (design §2.1)
   */
  reading?: string;
  sounds?: OwnSound[];
  /** main: pack sentences to teach, in order; default: all "line" and "extra" sentences */
  sentence_ids?: string[];
  /** phonics: the lesson's sentences; main: 0–5 added sentences */
  sentences?: OwnSentence[];
  /** Words taught in this lesson (phonics). Main lessons use the pack's word_ids */
  word_ids?: string[];
  /** Tips taught in this lesson (0–2): each tip is taught once, in the lesson that first clearly uses it */
  tips?: string[];
  /** Tips taught in an earlier lesson that this lesson uses again: shown as links back, not taught again */
  tip_links?: string[];
  /**
   * main: how many generated questions of each kind (design §3.1); default E1 2, E2 2, E3 2, E4 1, E7 2.
   * Generated questions and our own exercises together stay ≤ 9 per lesson.
   */
  auto_exercises?: Partial<Record<AutoCode, number>>;
  exercises?: OwnExercise[];
}

/** Kinds of generated questions in a main lesson */
export type AutoCode = "E1" | "E2" | "E3" | "E4" | "E7";

export const DEFAULT_AUTO: Record<AutoCode, number> = { E1: 2, E2: 2, E3: 2, E4: 1, E7: 2 };

/** Generated + own exercise items in a lesson may not exceed this (design §3: 自动出题 ≤ 9 道) */
export const MAX_AUTO_QUESTIONS = 9;

export interface TipExample {
  id: string;
  nl: string;
  zh: string;
  en: string;
}

export interface Tip {
  id: string;
  title: { zh: string; en?: string };
  /** 2–4 short paragraphs in Chinese */
  body_zh: string[];
  body_en?: string[];
  examples: TipExample[];
  /**
   * Example sentences from the pack's EXTRA boxes (03 §4A), by box id ("NN22-X1") or sentence id
   * ("NN22-X1-2"). Shown first when the pack is installed, our examples only fill up to 3; the NN text stays in
   * the pack.
   */
  pack_examples?: string[];
  table?: { head: string[]; rows: string[][] };
}

export interface OwnWord {
  id: string;
  lemma: string;
  pos: Pos;
  article?: "de" | "het" | "de/het" | null;
  plural?: string | null;
  verb_forms?: VerbForms | null;
  separable?: string | null;
  forms_seen?: string[];
  zh: string;
  en: string;
  /** "letter": a letter of the alphabet (P09) — not a vocabulary word, never part of a sentence */
  flags?: string[];
}

export interface FunctionWords {
  lemmas: string[];
}

export interface TtsManifestEntry {
  text: string;
  voice: string;
  /** seconds */
  duration: number;
}

export interface TtsManifest {
  voices: { default: string; male: string };
  entries: Record<string, TtsManifestEntry>;
}

/** Everything under content/ (or a fixture copy), already parsed. */
export interface ContentBundle {
  course: CourseDef;
  lessons: Record<string, OwnLesson>;
  tips: Record<string, Tip>;
  words: OwnWord[];
  functionWords: FunctionWords;
  tts: TtsManifest;
}
