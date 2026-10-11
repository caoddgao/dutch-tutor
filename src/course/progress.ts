// Course map and home data from the content (course view) and the learner's records (design §2.2, §7).
import type { CourseLesson, CourseSectionView } from "../content/model";
import type { ContentBundle } from "../content/ownTypes";
import type { PackIndex } from "../content/packTypes";
import { lineCount, partRefs, partSizes } from "../content/split";
import type { LessonProgress } from "../storage/learning";
import type { LessonReviewStat } from "../review/store";
import type { CourseSection, LessonSummary } from "./types";

/** Rough share of a lesson done, per step code (intro, sentences, words, tips, exercises, done). */
const STEP_START = [0.05, 0.15, 0.55, 0.7, 0.75, 1];
const STEP_LABEL: Record<number, string> = { 0: "听原版", 1: "逐句学", 2: "词卡", 3: "小贴士", 4: "练习", 5: "完成" };
const PHONICS_LABEL: Record<number, string> = { 0: "音", 1: "短句", 2: "关键词", 4: "听辨练习", 5: "完成" };

export function sentenceTotal(lesson: CourseLesson, bundle: ContentBundle, index: PackIndex | null): number {
  if (lesson.source === "own") return bundle.lessons[lesson.id]?.sentences?.length ?? 0;
  const entry = index?.lessons.find((l) => l.id === lesson.packId);
  const count = entry?.sentence_count ?? 0;
  const lines = entry ? lineCount(entry) : 0;
  const own = bundle.lessons[lesson.id];
  // split lessons divide the text sentences; the word-list reading is in the last part (split.ts)
  const pack = own?.sentence_ids
    ? own.sentence_ids.length
    : lesson.part
      ? partSizes(
          lines,
          partRefs(bundle.course, lesson.packId ?? lesson.id).map((r) => r.part?.from),
        )[lesson.part.n - 1] + (lesson.part.n === lesson.part.of ? Math.max(0, count - lines) : 0)
      : count;
  return pack + (own?.sentences?.length ?? 0);
}

/** A lesson started but not finished yet. */
export function inProgress(p: LessonProgress | undefined): boolean {
  return !!p && p.status === "new" && !!p.last_studied_at;
}

export function lessonSummary(
  lesson: CourseLesson,
  progress: LessonProgress | undefined,
  stat: LessonReviewStat | undefined,
  sentences: number,
): LessonSummary {
  const status = progress?.status ?? "new";
  let value = 0;
  if (status !== "new") value = stat && stat.total > 0 ? stat.known / stat.total : 0;
  else if (inProgress(progress)) {
    const step = progress!.current_step;
    value = STEP_START[step] ?? 0;
    if (step === 1 && sentences > 0) value += 0.4 * Math.min(1, progress!.current_index / sentences);
  }
  return {
    id: lesson.id,
    kind: lesson.kind,
    code: lesson.code,
    title: lesson.title ?? { nl: lesson.code, zh: "", en: "" },
    status,
    progress: Math.min(1, value),
  };
}

export function summarizeCourse(
  view: CourseSectionView[],
  bundle: ContentBundle,
  index: PackIndex | null,
  progress: LessonProgress[],
  stats: LessonReviewStat[],
): CourseSection[] {
  const p = new Map(progress.map((x) => [x.lesson_id, x]));
  const s = new Map(stats.map((x) => [x.lesson_id, x]));
  return view.map((section) => ({
    id: section.id,
    title: section.title,
    lessons: section.lessons.map((l) => lessonSummary(l, p.get(l.id), s.get(l.id), sentenceTotal(l, bundle, index))),
  }));
}

export interface ContinueInfo {
  lesson: LessonSummary;
  /** "第 2 步 · 逐句学" when the lesson was started */
  stepLabel: string | null;
  position: number | null;
  total: number | null;
}

/** Continue card: the most recently studied unfinished lesson, otherwise the recommended one. */
export function continueLesson(
  sections: CourseSection[],
  progress: LessonProgress[],
  view: CourseSectionView[],
  bundle: ContentBundle,
  index: PackIndex | null,
  recommended: LessonSummary | undefined,
): ContinueInfo | null {
  const all = sections.flatMap((s) => s.lessons);
  const started = progress
    .filter((p) => inProgress(p) && all.some((l) => l.id === p.lesson_id))
    .sort((a, b) => (b.last_studied_at ?? "").localeCompare(a.last_studied_at ?? ""))[0];
  const lesson = started ? all.find((l) => l.id === started.lesson_id)! : recommended;
  if (!lesson) return null;
  if (!started) return { lesson, stepLabel: null, position: null, total: null };
  const course = view.flatMap((s) => s.lessons).find((l) => l.id === lesson.id)!;
  const labels = lesson.kind === "phonics" ? PHONICS_LABEL : STEP_LABEL;
  const order = lesson.kind === "phonics" ? [0, 2, 1, 4, 5] : [0, 1, 2, 3, 4, 5];
  const stepNo = order.indexOf(started.current_step) + 1;
  const total = sentenceTotal(course, bundle, index);
  const inSentences = started.current_step === 1 && total > 0;
  return {
    lesson,
    stepLabel: `第 ${stepNo} 步 · ${labels[started.current_step] ?? ""}`,
    position: inSentences ? started.current_index + 1 : null,
    total: inSentences ? total : null,
  };
}

/** "第 24–65 课" style list of lessons the pack does not contain yet (the parts of a split lesson count once). */
export function missingRanges(missing: CourseLesson[]): string {
  const nums = [...new Set(missing.map((l) => Number((l.packId ?? l.id).replace(/^\D+/, ""))).filter(Number.isFinite))];
  if (nums.length === 0) return "";
  const prefix = missing[0].section === "tests" ? "测验" : "第";
  const suffix = missing[0].section === "tests" ? "" : " 课";
  const parts: string[] = [];
  let start = nums[0];
  let prev = nums[0];
  for (const n of [...nums.slice(1), Number.NaN]) {
    if (n === prev + 1) {
      prev = n;
      continue;
    }
    parts.push(start === prev ? `${start}` : `${start}–${prev}`);
    start = n;
    prev = n;
  }
  return `${prefix} ${parts.join("、")}${suffix}`;
}
