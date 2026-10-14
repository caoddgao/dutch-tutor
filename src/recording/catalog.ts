import type { AudioRef, Dictionary, RtLesson, RtSentence, RtWord } from "../content/model";
import type { ContentBundle, OwnExercise } from "../content/ownTypes";
import type { PackLesson } from "../content/packTypes";
import { voiceName } from "../content/ttsTexts";

export interface RecordingItem {
  id: string;
  nl: string;
  zh: string;
  kind: "sentence" | "word";
  origin: "book" | "own";
  audio: AudioRef;
}

function oralItems(exercises: OwnExercise[], bundle: ContentBundle): RecordingItem[] {
  const voice = voiceName(bundle.tts, "default");
  const out: RecordingItem[] = [];
  const add = (id: string, text: { nl: string; zh: string }) => {
    out.push({
      id,
      nl: text.nl,
      zh: text.zh,
      kind: "sentence",
      origin: "own",
      audio: { id, tts: { voice, text: text.nl } },
    });
  };
  for (const ex of exercises) {
    if (ex.type === "oral_complete") {
      for (const it of ex.items) {
        add(`${it.id}-C`, it.context);
        add(`${it.id}-B`, it.start);
        it.sample_answers.forEach((answer, i) => add(`${it.id}-A${i + 1}`, answer));
      }
    } else if (ex.type === "oral_answer") {
      for (const it of ex.items) {
        add(`${it.id}-Q`, it.question);
        it.sample_answers.forEach((answer, i) => add(`${it.id}-A${i + 1}`, answer));
      }
    }
  }
  return out;
}

function sentence(s: RtSentence, ownIds: Set<string>): RecordingItem {
  return {
    id: s.audio.id,
    nl: s.nl,
    zh: s.zh,
    kind: "sentence",
    origin: ownIds.has(s.id) ? "own" : "book",
    audio: s.audio,
  };
}

function word(w: RtWord, bundle: ContentBundle): RecordingItem {
  const own = bundle.words.some((x) => x.id === w.id);
  return {
    id: w.audio.id,
    nl: w.lemma,
    zh: w.zh,
    kind: "word",
    origin: own && !w.audio.nn && !w.audio.packTts ? "own" : "book",
    audio: w.audio,
  };
}

/** One row per audio ID; the same original sentence can appear in the reading text and a tip. */
export function uniqueItems(items: RecordingItem[]): RecordingItem[] {
  const seen = new Set<string>();
  return items.filter((item) => !!item.nl.trim() && !seen.has(item.id) && !!seen.add(item.id));
}

export function lessonRecordingItems(lesson: RtLesson, bundle: ContentBundle): RecordingItem[] {
  const ownIds = new Set([
    ...(bundle.lessons[lesson.id]?.sentences ?? []).map((s) => s.id),
    ...[...lesson.tips, ...lesson.tipLinks].flatMap((tip) => bundle.tips[tip.id]?.examples.map((s) => s.id) ?? []),
  ]);
  const fromSentence = (s: RtSentence) => sentence(s, ownIds);
  const ownTips = [...lesson.tips, ...lesson.tipLinks].flatMap((tip) =>
    (bundle.tips[tip.id]?.examples ?? []).map((s) => ({
      id: s.id,
      nl: s.nl,
      zh: s.zh,
      kind: "sentence" as const,
      origin: "own" as const,
      audio: { id: s.id, tts: { voice: voiceName(bundle.tts, "default"), text: s.nl } },
    })),
  );
  const fromBookExercises: RecordingItem[] = lesson.packExercises.flatMap(({ exercise }) =>
    exercise.items.flatMap((it) =>
      it.audio && it.prompt && it.zh
        ? [
            {
              id: it.id,
              nl: it.prompt,
              zh: it.zh,
              kind: "sentence" as const,
              origin: "book" as const,
              audio: { id: it.id, ...(it.audio.startsWith("audio/tts/") ? { packTts: it.audio } : { nn: it.audio }) },
            },
          ]
        : [],
    ),
  );
  return uniqueItems([
    ...lesson.fullSentences.map(fromSentence),
    ...lesson.sentences.map(fromSentence),
    ...(lesson.reading?.fullSentences ?? []).map(fromSentence),
    ...lesson.extras.flatMap((box) => box.sentences.map(fromSentence)),
    ...lesson.tips.flatMap((tip) => tip.examples.map(fromSentence)),
    ...lesson.tipLinks.flatMap((tip) => tip.examples.map(fromSentence)),
    ...ownTips,
    ...oralItems(lesson.ownExercises, bundle),
    ...fromBookExercises,
    ...lesson.words.map((w) => word(w, bundle)),
    ...(lesson.reading?.words ?? []).map((w) => word(w, bundle)),
  ]);
}

/** Original NN01–20 material is also available in recording mode, even when a phonics lesson only links its audio. */
export function packRecordingItems(lesson: PackLesson, dict: Dictionary, bundle: ContentBundle): RecordingItem[] {
  const lines: RecordingItem[] = lesson.sentences.map((s) => ({
    id: s.id,
    nl: s.nl,
    zh: s.zh,
    kind: "sentence",
    origin: "book",
    audio: { id: s.id, ...(s.audio ? { nn: s.audio } : {}) },
  }));
  const extras: RecordingItem[] = (lesson.extras ?? []).flatMap((box) =>
    box.sentences.map((s) => ({
      id: s.id,
      nl: s.nl,
      zh: s.zh,
      kind: "sentence",
      origin: "book",
      audio: {
        id: s.id,
        ...(s.audio ? (s.audio_source?.startsWith("tts:") ? { packTts: s.audio } : { nn: s.audio }) : {}),
      },
    })),
  );
  const ids = [...(lesson.word_ids ?? []), ...(lesson.keywords ?? []).map((k) => k.word_id)];
  return uniqueItems([
    ...lines,
    ...extras,
    ...ids.flatMap((id) => {
      const w = dict.words.get(id);
      return w ? [word(w, bundle)] : [];
    }),
  ]);
}

export function examRecordingItems(bundle: ContentBundle): RecordingItem[] {
  return uniqueItems(Object.values(bundle.exams ?? {}).flatMap((exam) => oralItems(exam.exercises, bundle)));
}
