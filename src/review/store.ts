// Review queue in SQLite (review_items, review_log; schema in src-tauri/migrations/0001_init.sql).
import type { SqlDb } from "../storage/db";
import { addDays, localDay, markStudyDay, setLessonStatus } from "../storage/learning";
import { MASTERED_INTERVAL, MASTERY_SHARE, nextSchedule, type ReviewResult } from "./schedule";

export type ReviewSource = "daily" | "lesson" | "mistakes";
export type ReviewMode = "R1" | "R2" | "R3";

export interface ReviewItem {
  item_id: string;
  item_type: "sentence" | "word";
  lesson_id: string;
  stage: number;
  interval_days: number;
  due_at: string;
  reps: number;
  lapses: number;
}

const COLS = "item_id, item_type, lesson_id, stage, interval_days, due_at, reps, lapses";

/** Distinct items answered today (counts against the daily limit). reviewed_at is UTC ISO text. */
export async function reviewedToday(db: SqlDb, now = new Date()): Promise<number> {
  const rows = await db.select<{ n: number }[]>(
    "SELECT COUNT(DISTINCT item_id) AS n FROM review_log WHERE reviewed_at >= $1",
    [utcStartOfLocalDay(now)],
  );
  return rows[0]?.n ?? 0;
}

function utcStartOfLocalDay(now: Date): string {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
}

export async function dueCount(db: SqlDb, now = new Date()): Promise<number> {
  const rows = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM review_items WHERE due_at <= $1", [
    localDay(now),
  ]);
  return rows[0]?.n ?? 0;
}

/** What today's review offers: due items, oldest first, up to what is left of the daily limit. */
export async function dailyItems(db: SqlDb, limit: number, now = new Date()): Promise<ReviewItem[]> {
  const left = Math.max(0, limit - (await reviewedToday(db, now)));
  if (left === 0) return [];
  return db.select<ReviewItem[]>(
    `SELECT ${COLS} FROM review_items WHERE due_at <= $1 ORDER BY due_at, lesson_id, item_id LIMIT $2`,
    [localDay(now), left],
  );
}

export async function lessonItems(db: SqlDb, lessonId: string): Promise<ReviewItem[]> {
  return db.select<ReviewItem[]>(`SELECT ${COLS} FROM review_items WHERE lesson_id = $1 ORDER BY item_type, item_id`, [
    lessonId,
  ]);
}

/** Items whose latest answer was wrong ("不会" or a wrong choice). */
export async function mistakeItems(db: SqlDb): Promise<ReviewItem[]> {
  return db.select<ReviewItem[]>(
    `SELECT ${COLS.split(", ")
      .map((c) => `i.${c}`)
      .join(", ")} FROM review_items i
     JOIN review_log l ON l.item_id = i.item_id
     WHERE l.id = (SELECT MAX(id) FROM review_log WHERE item_id = i.item_id) AND l.result = 'bad'
     ORDER BY l.reviewed_at DESC`,
  );
}

export interface LessonReviewStat {
  lesson_id: string;
  total: number;
  known: number;
  due: number;
}

export async function lessonStats(db: SqlDb, now = new Date()): Promise<LessonReviewStat[]> {
  return db.select<LessonReviewStat[]>(
    `SELECT lesson_id, COUNT(*) AS total,
       SUM(CASE WHEN interval_days >= $1 THEN 1 ELSE 0 END) AS known,
       SUM(CASE WHEN due_at <= $2 THEN 1 ELSE 0 END) AS due
     FROM review_items GROUP BY lesson_id`,
    [MASTERED_INTERVAL, localDay(now)],
  );
}

export async function sentenceCount(db: SqlDb): Promise<number> {
  const rows = await db.select<{ n: number }[]>("SELECT COUNT(*) AS n FROM review_items WHERE item_type = 'sentence'");
  return rows[0]?.n ?? 0;
}

/**
 * Records one answer. `repeat` marks the second showing of a wrong item in the same session:
 * it is logged but does not move the schedule again.
 */
export async function recordAnswer(
  db: SqlDb,
  item: ReviewItem,
  result: ReviewResult,
  mode: ReviewMode,
  source: ReviewSource,
  opts: { repeat?: boolean; now?: Date } = {},
): Promise<ReviewItem> {
  const now = opts.now ?? new Date();
  await db.execute("INSERT INTO review_log (item_id, mode, result, source, reviewed_at) VALUES ($1, $2, $3, $4, $5)", [
    item.item_id,
    mode,
    result,
    source,
    now.toISOString(),
  ]);
  if (opts.repeat) return item;
  const next = nextSchedule(item, result);
  const due_at = addDays(localDay(now), next.interval_days);
  await db.execute(
    `UPDATE review_items SET stage = $1, interval_days = $2, due_at = $3, reps = $4, lapses = $5, last_reviewed_at = $6
     WHERE item_id = $7`,
    [next.stage, next.interval_days, due_at, next.reps, next.lapses, now.toISOString(), item.item_id],
  );
  await markStudyDay(db, now, { reviews: 1 });
  return { ...item, ...next, due_at };
}

/** Lesson status follows mastery (design §2.2): ≥ 80 % of its items well known → 掌握. */
export async function updateMastery(db: SqlDb, lessonIds: string[]) {
  const stats = await lessonStats(db);
  for (const id of new Set(lessonIds)) {
    const s = stats.find((x) => x.lesson_id === id);
    if (!s || s.total === 0) continue;
    const rows = await db.select<{ status: string }[]>("SELECT status FROM lesson_progress WHERE lesson_id = $1", [id]);
    const current = rows[0]?.status;
    if (!current || current === "new") continue;
    const mastered = s.known / s.total >= MASTERY_SHARE;
    if (mastered && current !== "mastered") await setLessonStatus(db, id, "mastered");
    if (!mastered && current === "mastered") await setLessonStatus(db, id, "studied");
  }
}
