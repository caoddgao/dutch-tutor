// Builds step ⑤ of a lesson (design §3.1): generated questions (E1–E4, E7) from the lesson's sentences and
// words, book exercises from the pack (E8; listen_choose → E3, answer_oral → E6) and our own exercises.
import type { AudioRef, Dictionary, RtLesson, RtSentence, RtWord } from "../content/model";
import type { OwnExercise } from "../content/ownTypes";
import { fillBank, type PackExercise, type PackExerciseItem } from "../content/packTypes";
import { voiceName } from "../content/ttsTexts";
import type { TtsManifest } from "../content/ownTypes";
import { pickClosest, seededRandom, shuffle } from "./random";
import type { ExerciseGroup, OrderQuestion, Question } from "./types";

export type { ExerciseGroup } from "./types";

const hasAudio = (a: AudioRef | undefined) => !!a && !!(a.nn || a.tts || a.packTts);

/** Pack-relative exercise audio: synthesized files live under audio/tts/ */
function packItemAudio(id: string, path: string | null | undefined): AudioRef | undefined {
  if (!path) return undefined;
  return path.startsWith("audio/tts/") ? { id, packTts: path } : { id, nn: path };
}

/** Word blocks for ordering: split on spaces, punctuation stays attached to its word. */
export function sentenceBlocks(nl: string): string[] {
  return nl.split(/\s+/).filter(Boolean);
}

function orderQuestion(
  id: string,
  code: "E7" | "E8",
  blocks: string[],
  rnd: () => number,
  extra: Partial<OrderQuestion> = {},
): OrderQuestion {
  const idx = blocks.map((_, i) => i);
  let shuffled = shuffle(idx, rnd);
  // never offer the blocks already in the right order
  if (blocks.length > 1 && shuffled.every((v, i) => v === i)) shuffled = [...idx.slice(1), idx[0]];
  return { kind: "order", id, code, blocks, shuffled, ...extra };
}

/** Meaning options for a sentence: the right one plus up to 3 others of similar length. */
function meaningOptions(target: RtSentence, pool: RtSentence[], rnd: () => number) {
  const others = pickClosest(
    pool.filter((s) => s.id !== target.id && s.zh !== target.zh),
    3,
    (s) => Math.abs(s.zh.length - target.zh.length),
    rnd,
  );
  const options = shuffle([target, ...others], rnd);
  return {
    options: options.map((s) => ({ zh: s.zh, en: s.en })),
    answer: options.indexOf(target),
  };
}

function spellingDistractors(word: RtWord, pool: RtWord[], rnd: () => number): RtWord[] {
  return pickClosest(
    pool.filter((w) => w.id !== word.id && w.lemma.toLowerCase() !== word.lemma.toLowerCase()),
    3,
    (w) => Math.abs(w.lemma.length - word.lemma.length) + (w.pos === word.pos ? 0 : 2),
    rnd,
  );
}

/**
 * Generated questions for a main lesson, as many of each kind as the lesson asks for (default 2×E1, 2×E2,
 * 2×E3, 1×E4, 2×E7) when it has enough material.
 */
export function generatedGroups(lesson: RtLesson, dict: Dictionary, rnd: () => number): ExerciseGroup[] {
  const n = lesson.autoCounts;
  const sentences = lesson.sentences.filter((s) => s.tokens.length >= 2 && s.zh?.trim());
  const groups: ExerciseGroup[] = [];
  if (sentences.length >= 2) {
    const listen = shuffle(
      sentences.filter((s) => hasAudio(s.audio)),
      rnd,
    ).slice(0, n.E1);
    if (listen.length > 0) {
      groups.push({
        id: `${lesson.id}-G-E1`,
        code: "E1",
        questions: listen.map((s) => ({
          kind: "choice",
          id: `${lesson.id}-E1-${s.id}`,
          code: "E1",
          prompt: { audio: s.audio, revealNl: s.nl },
          ...meaningOptions(s, sentences, rnd),
        })),
      });
    }
    const read = shuffle(
      sentences.filter((s) => !listen.includes(s)),
      rnd,
    ).slice(0, n.E2);
    groups.push({
      id: `${lesson.id}-G-E2`,
      code: "E2",
      questions: read.map((s) => ({
        kind: "choice",
        id: `${lesson.id}-E2-${s.id}`,
        code: "E2",
        prompt: { nl: s.nl },
        ...meaningOptions(s, sentences, rnd),
      })),
    });
  }

  const words = lesson.words.filter((w) => w.pos !== "eigen" && w.pos !== "uitdr");
  const pool = words.length >= 4 ? words : [...words, ...[...dict.words.values()].filter((w) => w.pos !== "eigen")];
  const heard = shuffle(
    words.filter((w) => hasAudio(w.audio) && (lesson.newWordIds.length === 0 || lesson.newWordIds.includes(w.id))),
    rnd,
  );
  const e3 = heard.slice(0, n.E3);
  if (e3.length > 0 && pool.length >= 2) {
    groups.push({
      id: `${lesson.id}-G-E3`,
      code: "E3",
      questions: e3.map((w) => {
        const options = shuffle([w, ...spellingDistractors(w, pool, rnd)], rnd);
        return {
          kind: "choice",
          id: `${lesson.id}-E3-${w.id}`,
          code: "E3",
          prompt: { audio: w.audio, revealZh: w.zh, revealEn: w.en },
          options: options.map((o) => ({ nl: o.lemma })),
          answer: options.indexOf(w),
        };
      }),
    });
  }
  const e4word = heard[n.E3] ?? heard[0];
  if (e4word && n.E4 > 0) {
    const others = spellingDistractors(
      e4word,
      pool.filter((w) => hasAudio(w.audio)),
      rnd,
    );
    if (others.length >= 1) {
      const options = shuffle([e4word, ...others], rnd);
      groups.push({
        id: `${lesson.id}-G-E4`,
        code: "E4",
        questions: [
          {
            kind: "audio-choice",
            id: `${lesson.id}-E4-${e4word.id}`,
            code: "E4",
            nl: e4word.lemma,
            zh: e4word.zh,
            options: options.map((o) => o.audio),
            answer: options.indexOf(e4word),
          },
        ],
      });
    }
  }

  const orderable = shuffle(
    sentences.filter((s) => {
      const n = sentenceBlocks(s.nl).length;
      return n >= 3 && n <= 7;
    }),
    rnd,
  ).slice(0, n.E7);
  if (orderable.length > 0) {
    groups.push({
      id: `${lesson.id}-G-E7`,
      code: "E7",
      questions: orderable.map((s) =>
        orderQuestion(`${lesson.id}-E7-${s.id}`, "E7", sentenceBlocks(s.nl), rnd, {
          zh: s.zh,
          en: s.en,
          audio: s.audio,
        }),
      ),
    });
  }
  return groups.filter((g) => g.questions.length > 0);
}

function packItemQuestion(ex: PackExercise, it: PackExerciseItem, rnd: () => number): Question | null {
  const example = it.example === true;
  switch (ex.type) {
    case "true_false":
    case "choose_one":
    case "listen_choose":
    case "fill_choice": {
      const opts = ex.type === "fill_choice" ? fillBank(ex, it) : (it.options ?? []);
      const answer = opts.findIndex((o) => o.trim().toLowerCase() === (it.answer ?? "").trim().toLowerCase());
      if (answer < 0 || opts.length < 2) return null;
      const code = ex.type === "listen_choose" ? "E3" : "E8";
      return {
        kind: "choice",
        id: it.id,
        code,
        example,
        prompt: {
          nl: ex.type === "listen_choose" ? undefined : it.prompt,
          audio: packItemAudio(it.id, it.audio),
          revealZh: it.zh,
          revealEn: it.en,
        },
        options: opts.map((o) => ({ nl: o })),
        answer,
      };
    }
    case "match": {
      if (!it.left || !it.right || !it.pairs) return null;
      return { kind: "match", id: it.id, code: "E8", example, left: it.left, right: it.right, pairs: it.pairs };
    }
    case "order":
      if (!it.tokens || it.tokens.length < 2) return null;
      return orderQuestion(it.id, "E8", it.tokens, rnd, { example, zh: it.zh, en: it.en });
    case "answer_oral":
      return {
        kind: "oral",
        id: it.id,
        code: "E6",
        example,
        prompt: { nl: it.prompt ?? "", zh: it.zh ?? "", en: it.en ?? "", audio: packItemAudio(it.id, it.audio) },
        samples: (it.sample_answers ?? []).map((nl) => ({ nl, zh: "", en: "" })),
      };
    default:
      return null;
  }
}

function ownGroup(
  lesson: RtLesson,
  ex: OwnExercise,
  dict: Dictionary,
  tts: TtsManifest,
  rnd: () => number,
): ExerciseGroup | null {
  const word = (id: string) => lesson.words.find((w) => w.id === id) ?? dict.words.get(id);
  const say = (id: string, text: string): AudioRef => ({ id, tts: { voice: voiceName(tts, "default"), text } });
  let questions: (Question | null)[] = [];
  let code: ExerciseGroup["code"] = "E8";
  switch (ex.type) {
    case "listen_choose":
      code = "E3";
      questions = ex.items.map((it) => {
        const w = word(it.word_id);
        const answer = it.options.indexOf(it.answer);
        if (!w || answer < 0) return null;
        return {
          kind: "choice",
          id: it.id,
          code,
          prompt: { audio: w.audio, revealZh: w.zh, revealEn: w.en },
          options: it.options.map((nl) => ({ nl })),
          answer,
        };
      });
      break;
    case "choose_audio":
      code = "E4";
      questions = ex.items.map((it) => {
        const w = word(it.word_id);
        const options = shuffle(it.options, rnd);
        const refs = options.map((id) => word(id)?.audio);
        if (!w || refs.some((r) => !r)) return null;
        return {
          kind: "audio-choice",
          id: it.id,
          code,
          nl: w.lemma,
          zh: w.zh,
          options: refs as AudioRef[],
          answer: options.indexOf(it.word_id),
        };
      });
      break;
    case "order":
      code = "E7";
      questions = ex.items.map((it) => {
        const s = lesson.sentences.find((x) => x.id === it.sentence_id);
        return s ? orderQuestion(it.id, "E7", sentenceBlocks(s.nl), rnd, { zh: s.zh, en: s.en, audio: s.audio }) : null;
      });
      break;
    case "oral_complete":
      code = "E5";
      questions = ex.items.map((it) => ({
        kind: "oral",
        id: it.id,
        code: "E5",
        prompt: { ...it.context, audio: say(`${it.id}-C`, it.context.nl) },
        start: { ...it.start, audio: say(`${it.id}-B`, it.start.nl) },
        samples: it.sample_answers.map((a, i) => ({ ...a, audio: say(`${it.id}-A${i + 1}`, a.nl) })),
      }));
      break;
    case "oral_answer":
      code = "E6";
      questions = ex.items.map((it) => ({
        kind: "oral",
        id: it.id,
        code: "E6",
        prompt: { ...it.question, audio: say(`${it.id}-Q`, it.question.nl) },
        samples: it.sample_answers.map((a, i) => ({ ...a, audio: say(`${it.id}-A${i + 1}`, a.nl) })),
      }));
      break;
    case "read_passage":
      code = "E9";
      questions = ex.items.map((it) => {
        // the file lists the answer anywhere; shown in a fixed shuffled order so it is not always first
        const options = shuffle(it.options, rnd);
        return {
          kind: "choice",
          id: it.id,
          code: "E9",
          passage: ex.passage,
          prompt: { nl: it.question.nl },
          options: options.map((o) => ({ nl: o.nl })),
          answer: options.findIndex((o) => o.nl === it.answer),
        };
      });
      break;
  }
  const qs = questions.filter((q): q is Question => !!q);
  return qs.length ? { id: ex.id, code, instruction: ex.instruction, questions: qs } : null;
}

export function buildExercises(
  lesson: RtLesson,
  dict: Dictionary,
  tts: TtsManifest,
  seed = lesson.id,
): ExerciseGroup[] {
  const rnd = seededRandom(seed);
  const groups: ExerciseGroup[] = [];
  if (lesson.kind === "main") groups.push(...generatedGroups(lesson, dict, rnd));
  for (const ex of lesson.ownExercises) {
    const g = ownGroup(lesson, ex, dict, tts, rnd);
    if (g) groups.push(g);
  }
  for (const { exercise: ex } of lesson.packExercises) {
    const qs = ex.items.map((it) => packItemQuestion(ex, it, rnd)).filter((q): q is Question => !!q);
    if (qs.length === 0) continue;
    const code = ex.type === "listen_choose" ? "E3" : ex.type === "answer_oral" ? "E6" : "E8";
    groups.push({ id: ex.id, code, instruction: ex.instruction, questions: qs });
  }
  return groups;
}

export function scoredCount(groups: ExerciseGroup[]): number {
  return groups.reduce((n, g) => n + g.questions.filter((q) => !q.example).length, 0);
}
