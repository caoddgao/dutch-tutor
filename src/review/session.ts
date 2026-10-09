// Builds a review session (design §4.2): rotate R1 / R2 / R3, distractors from the same or adjacent
// lessons, same part of speech and similar length.
import type { AudioRef, Dictionary, RtLesson } from "../content/model";
import type { Pos } from "../content/packTypes";
import type { PackToken } from "../content/packTypes";
import { pickClosest, seededRandom, shuffle } from "../exercises/random";
import type { ReviewItem, ReviewMode } from "./store";

export interface ReviewCard {
  item: ReviewItem;
  nl: string;
  zh: string;
  en: string;
  audio: AudioRef;
  tokens: PackToken[];
  pos?: Pos;
  lessonId: string;
}

export interface ReviewQuestion {
  key: string;
  card: ReviewCard;
  mode: ReviewMode;
  /** R1 / R2 */
  options: { zh: string; en: string }[];
  answer: number;
  /** Second showing of an item answered wrong earlier in this session */
  repeat?: boolean;
}

/** Everything a session needs to show its items, built from the lessons involved. */
export function cardsFromLessons(
  items: ReviewItem[],
  lessons: RtLesson[],
  dict: Dictionary,
): {
  cards: ReviewCard[];
  pool: ReviewCard[];
  missing: number;
} {
  const sentences = new Map<string, ReviewCard>();
  const words = new Map<string, ReviewCard>();
  for (const l of lessons) {
    for (const s of l.sentences) {
      if (!sentences.has(s.id))
        sentences.set(s.id, {
          item: placeholder(s.id, "sentence", l.id),
          nl: s.nl,
          zh: s.zh,
          en: s.en,
          audio: s.audio,
          tokens: s.tokens,
          lessonId: l.id,
        });
    }
    for (const w of l.words) {
      if (!words.has(w.id))
        words.set(w.id, {
          item: placeholder(w.id, "word", l.id),
          nl: w.article ? `${w.article} ${w.lemma}` : w.lemma,
          zh: w.zh,
          en: w.en,
          audio: w.audio,
          tokens: [{ t: w.lemma, word_id: w.id }],
          pos: w.pos,
          lessonId: l.id,
        });
    }
  }
  const cards: ReviewCard[] = [];
  let missing = 0;
  for (const item of items) {
    let card = item.item_type === "sentence" ? sentences.get(item.item_id) : words.get(item.item_id);
    if (!card && item.item_type === "word") {
      const w = dict.words.get(item.item_id);
      if (w)
        card = {
          item,
          nl: w.article ? `${w.article} ${w.lemma}` : w.lemma,
          zh: w.zh,
          en: w.en,
          audio: w.audio,
          tokens: [{ t: w.lemma, word_id: w.id }],
          pos: w.pos,
          lessonId: item.lesson_id,
        };
    }
    if (card) cards.push({ ...card, item });
    else missing += 1;
  }
  return { cards, pool: [...sentences.values(), ...words.values()], missing };
}

function placeholder(id: string, type: "sentence" | "word", lessonId: string): ReviewItem {
  return {
    item_id: id,
    item_type: type,
    lesson_id: lessonId,
    stage: 0,
    interval_days: 0,
    due_at: "",
    reps: 0,
    lapses: 0,
  };
}

const hasAudio = (a: AudioRef) => !!(a.nn || a.tts || a.packTts);

/** Rotates through the enabled modes; R2 (listening only) needs audio. */
export function chooseMode(index: number, enabled: ReviewMode[], canListen: boolean): ReviewMode {
  const modes = enabled.length ? enabled : (["R1"] as ReviewMode[]);
  for (let k = 0; k < modes.length; k++) {
    const m = modes[(index + k) % modes.length];
    if (m !== "R2" || canListen) return m;
  }
  return "R1";
}

export function meaningOptions(card: ReviewCard, pool: ReviewCard[], rnd: () => number) {
  const candidates = pool.filter(
    (c) => c.item.item_type === card.item.item_type && c.zh !== card.zh && c.item.item_id !== card.item.item_id,
  );
  const others = pickClosest(
    candidates,
    3,
    (c) =>
      Math.abs(c.zh.length - card.zh.length) / 2 +
      (card.pos && c.pos !== card.pos ? 3 : 0) +
      (c.lessonId === card.lessonId ? 0 : 1),
    rnd,
  );
  const opts = shuffle([card, ...others], rnd);
  return { options: opts.map((c) => ({ zh: c.zh, en: c.en })), answer: opts.indexOf(card) };
}

export function buildQuestions(
  cards: ReviewCard[],
  pool: ReviewCard[],
  enabled: ReviewMode[],
  seed: string,
): ReviewQuestion[] {
  const rnd = seededRandom(seed);
  return shuffle(cards, rnd).map((card, i) => {
    let mode = chooseMode(i, enabled, hasAudio(card.audio));
    let { options, answer } = mode === "R3" ? { options: [], answer: -1 } : meaningOptions(card, pool, rnd);
    // nothing to choose between (a lesson with a single item): say it instead
    if (mode !== "R3" && options.length < 2) {
      mode = "R3";
      options = [];
      answer = -1;
    }
    return { key: `${card.item.item_id}#${i}`, card, mode, options, answer };
  });
}
