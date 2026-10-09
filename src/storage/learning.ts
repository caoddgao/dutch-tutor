// Lesson progress, study days and the hand-off from lessons to the review queue (design §2.2, §3, §4.1).
import type { SqlDb } from "./db";

export type LessonStatus = "new" | "studied" | "mastered";

export interface LessonProgress {
  lesson_id: string;
  status: LessonStatus;
  current_step: number;
  current_index: number;
  completed_count: number;
  first_completed_at: string | null;
  last_studied_at: string | null;
}

export interface ReviewSeed {
  id: string;
  type: "sentence" | "word";
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** Local calendar day, YYYY-MM-DD (study days and due dates are counted in the learner's own days). */
export function localDay(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return localDay(new Date(y, m - 1, d + n));
}

const iso = (d: Date) => d.toISOString();

export async function allProgress(db: SqlDb): Promise<LessonProgress[]> {
  return db.select<LessonProgress[]>(
    "SELECT lesson_id, status, current_step, current_index, completed_count, first_completed_at, last_studied_at FROM lesson_progress",
  );
}

export async function getProgress(db: SqlDb, lessonId: string): Promise<LessonProgress | null> {
  const rows = await db.select<LessonProgress[]>(
    "SELECT lesson_id, status, current_step, current_index, completed_count, first_completed_at, last_studied_at FROM lesson_progress WHERE lesson_id = $1",
    [lessonId],
  );
  return rows[0] ?? null;
}

/** Remembers where the learner is (step code + position inside the step) for resuming later. */
export async function savePosition(db: SqlDb, lessonId: string, step: number, index: number, now = new Date()) {
  await db.execute(
    `INSERT INTO lesson_progress (lesson_id, current_step, current_index, last_studied_at, updated_at)
     VALUES ($1, $2, $3, $4, $4)
     ON CONFLICT(lesson_id) DO UPDATE SET current_step = excluded.current_step, current_index = excluded.current_index,
       last_studied_at = excluded.last_studied_at, updated_at = excluded.updated_at`,
    [lessonId, step, index, iso(now)],
  );
}

export async function markStudyDay(db: SqlDb, now: Date, add: { sentences?: number; reviews?: number } = {}) {
  await db.execute(
    `INSERT INTO study_days (day, sentences_learned, reviews_done) VALUES ($1, $2, $3)
     ON CONFLICT(day) DO UPDATE SET sentences_learned = sentences_learned + excluded.sentences_learned,
       reviews_done = reviews_done + excluded.reviews_done`,
    [localDay(now), add.sentences ?? 0, add.reviews ?? 0],
  );
}

/**
 * A full pass through the lesson: status becomes "studied" (a mastered lesson stays mastered) and the
 * lesson's sentences and new words enter the review queue, first due tomorrow. Items already in the
 * queue (from an earlier pass or another lesson) keep their schedule.
 */
export async function completeLesson(db: SqlDb, lessonId: string, items: ReviewSeed[], now = new Date()) {
  const at = iso(now);
  await db.execute(
    `INSERT INTO lesson_progress (lesson_id, status, completed_count, first_completed_at, last_studied_at, updated_at)
     VALUES ($1, 'studied', 1, $2, $2, $2)
     ON CONFLICT(lesson_id) DO UPDATE SET
       status = CASE WHEN lesson_progress.status = 'mastered' THEN 'mastered' ELSE 'studied' END,
       completed_count = lesson_progress.completed_count + 1,
       first_completed_at = COALESCE(lesson_progress.first_completed_at, excluded.first_completed_at),
       last_studied_at = excluded.last_studied_at, updated_at = excluded.updated_at`,
    [lessonId, at],
  );
  const due = addDays(localDay(now), 1);
  let added = 0;
  for (const item of items) {
    const before = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM review_items WHERE item_id = $1", [
      item.id,
    ]);
    if (before[0].n > 0) continue;
    await db.execute(
      `INSERT INTO review_items (item_id, item_type, lesson_id, stage, interval_days, due_at, created_at)
       VALUES ($1, $2, $3, 0, 1, $4, $5)`,
      [item.id, item.type, lessonId, due, at],
    );
    added += 1;
  }
  return { added };
}

export async function setLessonStatus(db: SqlDb, lessonId: string, status: LessonStatus) {
  await db.execute(
    `INSERT INTO lesson_progress (lesson_id, status) VALUES ($1, $2)
     ON CONFLICT(lesson_id) DO UPDATE SET status = excluded.status`,
    [lessonId, status],
  );
}

/** Consecutive days with study or review, ending today, or yesterday if today has none yet. */
export function streak(days: string[], today: string): number {
  const set = new Set(days);
  let day = set.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (set.has(day)) {
    n += 1;
    day = addDays(day, -1);
  }
  return n;
}
