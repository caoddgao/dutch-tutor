// What the practice page offers (design §7, decision 29): the sentences of every lesson the learner has
// studied, grouped by lesson in course order.
import type { AudioRef, CourseLesson, CourseSectionView, RtLesson } from "../content/model";
import type { LessonProgress } from "../storage/learning";

export interface PracticeSentence {
  id: string;
  lessonId: string;
  nl: string;
  zh: string;
  en: string;
  audio: AudioRef;
}

export interface PracticeLesson {
  id: string;
  /** "课号 · 中文课题", as on the course map (`lessonCode()`) */
  label: string;
  sentences: PracticeSentence[];
}

/**
 * Studied lessons (status not "new") that can be opened, in course order; the one studied most recently;
 * and how many studied lessons need a pack that is not installed.
 */
export function studiedLessons(
  course: CourseSectionView[],
  progress: LessonProgress[],
): { lessons: CourseLesson[]; latest: string | null; unavailable: number } {
  const byId = new Map(progress.map((p) => [p.lesson_id, p]));
  const studied = (l: CourseLesson) => (byId.get(l.id)?.status ?? "new") !== "new";
  const sections = course.filter((s) => s.id !== "tests");
  const lessons = sections.flatMap((s) => s.lessons).filter(studied);
  const latest = [...lessons].sort((a, b) =>
    (byId.get(b.id)?.last_studied_at ?? "").localeCompare(byId.get(a.id)?.last_studied_at ?? ""),
  )[0];
  const unavailable = sections.flatMap((s) => s.missing).filter(studied).length;
  return { lessons, latest: latest?.id ?? null, unavailable };
}

export function lessonLabel(lesson: Pick<CourseLesson, "code" | "title">): string {
  return lesson.title?.zh ? `${lesson.code} · ${lesson.title.zh}` : lesson.code;
}

/**
 * The sentences a lesson teaches, as in its review seeds: step ② plus a phonics lesson's reading text;
 * single-word "extra" lines (number lists) are left out. A sentence already listed for an earlier lesson
 * (`seen`) is not repeated.
 */
export function practiceSentences(lesson: RtLesson, seen = new Set<string>()): PracticeSentence[] {
  return [...lesson.sentences, ...(lesson.reading?.sentences ?? [])]
    .filter((s) => (s.kind !== "extra" || s.tokens.length > 1) && !seen.has(s.id) && !!seen.add(s.id))
    .map((s) => ({ id: s.id, lessonId: lesson.id, nl: s.nl, zh: s.zh, en: s.en, audio: s.audio }));
}
