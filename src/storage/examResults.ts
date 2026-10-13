import type { SqlDb } from "./db";

export interface ExamResult {
  id: string;
  correct: number;
  total: number;
  taken_at: string;
}

export async function latestExamResults(db: SqlDb): Promise<ExamResult[]> {
  return db.select<ExamResult[]>("SELECT id, correct, total, taken_at FROM exam_results");
}

export async function saveExamResult(db: SqlDb, id: string, correct: number, total: number): Promise<void> {
  await db.execute(
    `INSERT INTO exam_results (id, correct, total, taken_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT(id) DO UPDATE SET correct = excluded.correct, total = excluded.total, taken_at = excluded.taken_at`,
    [id, correct, total, new Date().toISOString()],
  );
}
