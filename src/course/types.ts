export type Level = "A1" | "A2" | "B1" | "B2";
export type LessonKind = "phonics" | "main" | "test";
/** Stored status (design §2.2). */
export type LessonStatus = "new" | "studied" | "mastered";
/** What the course map shows: stored status plus the single "recommended next" lesson. */
export type DisplayStatus = LessonStatus | "recommended";

export interface Trilingual {
  nl: string;
  zh: string;
  en: string;
}

export interface LessonSummary {
  id: string;
  kind: LessonKind;
  /** Short label shown on the card, e.g. "P01", "第 21 课", "测验 1" */
  code: string;
  title: Trilingual;
  status: LessonStatus;
  /** 0–1: mastery for studied lessons, position for a lesson in progress */
  progress: number;
}

export interface CourseSection {
  id: string;
  title: string;
  lessons: LessonSummary[];
}

export const LEVELS: { level: Level; available: boolean }[] = [
  { level: "A1", available: true },
  { level: "A2", available: false },
  { level: "B1", available: false },
  { level: "B2", available: false },
];

export const STATUS_LABEL: Record<DisplayStatus, string> = {
  mastered: "已掌握",
  studied: "学过",
  recommended: "推荐",
  new: "未学",
};

/** The recommended next lesson is the first "new" lesson in course order (a suggestion, never a lock). */
export function recommendNext(sections: CourseSection[]): LessonSummary | undefined {
  for (const section of sections) {
    const found = section.lessons.find((l) => l.status === "new");
    if (found) return found;
  }
  return undefined;
}

export function displayStatus(lesson: LessonSummary, recommendedId: string | undefined): DisplayStatus {
  return lesson.id === recommendedId ? "recommended" : lesson.status;
}

export function countByStatus(lessons: LessonSummary[]): Record<LessonStatus, number> {
  const counts: Record<LessonStatus, number> = { new: 0, studied: 0, mastered: 0 };
  for (const l of lessons) counts[l.status] += 1;
  return counts;
}
