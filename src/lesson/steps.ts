import type { LessonKind, RtLesson } from "../content/model";

/**
 * Step codes are stored in lesson_progress.current_step, so they stay fixed even where the order
 * differs (phonics lessons: sounds → keywords → sentences → exercises → reading text, design §2.1, §3).
 * The reading step's index 0 is listening to the whole text, 1… its sentences.
 */
export const STEP = { intro: 0, sentences: 1, words: 2, tips: 3, exercises: 4, done: 5, reading: 6 } as const;
export type StepCode = (typeof STEP)[keyof typeof STEP];

export interface StepDef {
  code: StepCode;
  label: string;
}

const MAIN: StepDef[] = [
  { code: STEP.intro, label: "听原版" },
  { code: STEP.sentences, label: "逐句学" },
  { code: STEP.words, label: "词卡" },
  { code: STEP.tips, label: "小贴士" },
  { code: STEP.exercises, label: "练习" },
  { code: STEP.done, label: "完成" },
];

const PHONICS: StepDef[] = [
  { code: STEP.intro, label: "音" },
  { code: STEP.words, label: "关键词" },
  { code: STEP.sentences, label: "短句" },
  { code: STEP.exercises, label: "听辨练习" },
  { code: STEP.reading, label: "认读小文" },
  { code: STEP.done, label: "完成" },
];

const TEST: StepDef[] = [
  { code: STEP.exercises, label: "测验" },
  { code: STEP.done, label: "完成" },
];

export function stepsFor(
  lesson: Pick<
    RtLesson,
    "kind" | "tips" | "extras" | "fullAudio" | "fullSentences" | "sentences" | "words" | "reading"
  >,
  hasExercises: boolean,
): StepDef[] {
  const base: Record<LessonKind, StepDef[]> = { main: MAIN, phonics: PHONICS, test: TEST };
  return base[lesson.kind].filter((s) => {
    if (s.code === STEP.tips) return lesson.tips.length > 0 || lesson.extras.length > 0;
    if (s.code === STEP.intro && lesson.kind === "main") return !!lesson.fullAudio || lesson.fullSentences.length > 0;
    if (s.code === STEP.sentences) return lesson.sentences.length > 0;
    if (s.code === STEP.words) return wordCards(lesson).length > 0;
    if (s.code === STEP.reading) return (lesson.reading?.sentences.length ?? 0) > 0;
    if (s.code === STEP.exercises) return hasExercises;
    return true;
  });
}

/** The word-card step: the lesson's words except letters of the alphabet (those are shown with the sounds). */
export function wordCards(lesson: Pick<RtLesson, "words">): RtLesson["words"] {
  return lesson.words.filter((w) => !w.letter);
}
