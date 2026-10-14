// Content reports (design §7): the "报错" button on sentence and word cards, exported for later revision.
// Rows share the feedback table with recording mode's "unnatural" marks, which are not reports.
import type { SqlDb } from "./db";

export type ReportCategory = "translation" | "dutch" | "audio" | "other";

export const REPORT_CATEGORIES: { value: ReportCategory; label: string }[] = [
  { value: "translation", label: "翻译不对" },
  { value: "dutch", label: "荷兰语不自然" },
  { value: "audio", label: "音频有问题" },
  { value: "other", label: "其他" },
];

export const NOTE_MAX = 500;

export interface ReportTarget {
  type: "sentence" | "word";
  id: string;
  lessonId: string;
  nl: string;
  zh: string;
}

const REPORT_ROWS = "category <> 'unnatural'";

export async function addReport(
  db: SqlDb,
  target: ReportTarget,
  category: ReportCategory,
  note: string,
  now = new Date(),
): Promise<void> {
  await db.execute(
    `INSERT INTO feedback (target_type, target_id, category, note, created_at, lesson_id, nl, zh)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      target.type,
      target.id,
      category,
      note.trim().slice(0, NOTE_MAX),
      now.toISOString(),
      target.lessonId,
      target.nl,
      target.zh,
    ],
  );
}

export interface ReportCounts {
  total: number;
  unexported: number;
}

export async function reportCounts(db: SqlDb): Promise<ReportCounts> {
  const [row] = await db.select<{ total: number; unexported: number | null }[]>(
    `SELECT COUNT(*) AS total, SUM(CASE WHEN exported_at IS NULL THEN 1 ELSE 0 END) AS unexported
     FROM feedback WHERE ${REPORT_ROWS}`,
  );
  return { total: row?.total ?? 0, unexported: row?.unexported ?? 0 };
}

interface ReportRow {
  id: number;
  target_type: string;
  target_id: string;
  category: string;
  note: string;
  created_at: string;
  lesson_id: string | null;
  nl: string | null;
  zh: string | null;
}

export const REPORT_EXPORT_FORMAT = "dutch-tutor-reports";

export interface ReportExport {
  format: typeof REPORT_EXPORT_FORMAT;
  version: 1;
  exported_at: string;
  count: number;
  reports: {
    lesson: string;
    type: "sentence" | "word" | string;
    id: string;
    nl: string;
    zh: string;
    reason: string;
    reason_zh: string;
    note: string;
    reported_at: string;
  }[];
}

/** The reports not exported yet, or all of them; returns the file content and the row ids it covers. */
export async function buildReportExport(
  db: SqlDb,
  all: boolean,
  now = new Date(),
): Promise<{ file: ReportExport; ids: number[] }> {
  const rows = await db.select<ReportRow[]>(
    `SELECT id, target_type, target_id, category, note, created_at, lesson_id, nl, zh FROM feedback
     WHERE ${REPORT_ROWS}${all ? "" : " AND exported_at IS NULL"} ORDER BY created_at, id`,
  );
  const label = new Map(REPORT_CATEGORIES.map((c) => [c.value as string, c.label]));
  return {
    ids: rows.map((r) => r.id),
    file: {
      format: REPORT_EXPORT_FORMAT,
      version: 1,
      exported_at: now.toISOString(),
      count: rows.length,
      reports: rows.map((r) => ({
        lesson: r.lesson_id ?? "",
        type: r.target_type,
        id: r.target_id,
        nl: r.nl ?? "",
        zh: r.zh ?? "",
        reason: r.category,
        reason_zh: label.get(r.category) ?? "其他",
        note: r.note,
        reported_at: r.created_at,
      })),
    },
  };
}

export async function markReportsExported(db: SqlDb, ids: number[], now = new Date()): Promise<void> {
  const at = now.toISOString();
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    await db.execute(
      `UPDATE feedback SET exported_at = $1 WHERE id IN (${chunk.map((_, j) => `$${j + 2}`).join(", ")})`,
      [at, ...chunk],
    );
  }
}

const p2 = (n: number) => String(n).padStart(2, "0");

export function reportFileName(d: Date): string {
  return `Dutch-Tutor-内容报错-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`;
}
