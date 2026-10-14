// Learning-data backup and restore (design §8): one JSON file with the learner's own data.
// In: lesson progress, review schedule and answers, exam scores, settings, study days, content reports,
// "my hard sentences" (version 2).
// Out: recordings and the "unnatural" marks that travel with them (recording mode has its own export),
// the resource pack, and the Azure key (kept by the Rust side in its own file, never read here).
import { normalizeSettings, SETTING_KEYS, type Settings } from "../settings/settings";
import type { SqlDb } from "./db";
import type { SettingsStore } from "./settingsStore";

export const BACKUP_FORMAT = "dutch-tutor-backup";
/** 2 added hard_sentences; version 1 files are still read (see TableSpec.since). */
export const BACKUP_VERSION = 2;

type Col = "text" | "text?" | "int" | "num" | readonly string[];

interface TableSpec {
  /** Primary key column, checked for duplicates; null when the table's own id is not kept */
  key: string | null;
  cols: Record<string, Col>;
  /** Rows of the table that belong to the backup */
  where?: string;
  order: string;
  /** Backup version that added the table; restoring an older file leaves the table as it is */
  since?: number;
}

const TABLES = {
  lesson_progress: {
    key: "lesson_id",
    cols: {
      lesson_id: "text",
      status: ["new", "studied", "mastered"],
      current_step: "int",
      current_index: "int",
      completed_count: "int",
      first_completed_at: "text?",
      last_studied_at: "text?",
      updated_at: "text",
    },
    order: "lesson_id",
  },
  review_items: {
    key: "item_id",
    cols: {
      item_id: "text",
      item_type: ["sentence", "word"],
      lesson_id: "text",
      stage: "int",
      interval_days: "num",
      due_at: "text",
      last_reviewed_at: "text?",
      reps: "int",
      lapses: "int",
      created_at: "text",
    },
    order: "item_id",
  },
  review_log: {
    key: null,
    cols: {
      item_id: "text",
      mode: ["R1", "R2", "R3"],
      result: ["good", "fuzzy", "bad"],
      source: ["daily", "lesson", "mistakes"],
      reviewed_at: "text",
    },
    order: "id",
  },
  exam_results: {
    key: "id",
    cols: { id: "text", correct: "int", total: "int", taken_at: "text" },
    order: "id",
  },
  study_days: {
    key: "day",
    cols: { day: "text", sentences_learned: "int", reviews_done: "int" },
    order: "day",
  },
  feedback: {
    key: null,
    cols: {
      target_type: ["sentence", "word", "exercise", "tip", "audio"],
      target_id: "text",
      category: "text",
      note: "text",
      created_at: "text",
      exported_at: "text?",
      lesson_id: "text?",
      nl: "text?",
      zh: "text?",
    },
    where: "category <> 'unnatural'",
    order: "id",
  },
  hard_sentences: {
    key: "sentence_id",
    cols: { sentence_id: "text", created_at: "text" },
    order: "sentence_id",
    since: 2,
  },
} as const satisfies Record<string, TableSpec>;

export type BackupTable = keyof typeof TABLES;
export const BACKUP_TABLES = Object.keys(TABLES) as BackupTable[];

type Row = Record<string, string | number | null>;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  created_at: string;
  settings: Settings;
  /** A table added after the file's version is missing */
  tables: Partial<Record<BackupTable, Row[]>> & Record<Exclude<BackupTable, "hard_sentences">, Row[]>;
}

export type BackupErrorCode = "not_backup" | "newer_version" | "damaged";

export class BackupError extends Error {
  constructor(
    readonly code: BackupErrorCode,
    detail = "",
  ) {
    super(`${code}${detail ? `: ${detail}` : ""}`);
  }
}

/** Learner-facing text for a failed read of a backup file. */
export function backupErrorMessage(err: unknown): string {
  const code = err instanceof BackupError ? err.code : null;
  if (code === "not_backup") return "这个文件不是 Dutch Tutor 的学习数据备份，请选择从“导出学习数据”保存的文件。";
  if (code === "newer_version") return "这个备份来自更新版本的程序，请先把程序更新到最新版再恢复。";
  if (code === "damaged") return "这个备份文件已损坏或被改动过，无法恢复。当前的学习数据没有变化。";
  return "读不出这个文件，请确认文件还在、可以打开。当前的学习数据没有变化。";
}

export async function collectBackup(db: SqlDb, store: SettingsStore, now = new Date()): Promise<BackupFile> {
  const tables = {} as Record<BackupTable, Row[]>;
  for (const name of BACKUP_TABLES) {
    const spec: TableSpec = TABLES[name];
    const cols = Object.keys(spec.cols).join(", ");
    tables[name] = await db.select<Row[]>(
      `SELECT ${cols} FROM ${name}${spec.where ? ` WHERE ${spec.where}` : ""} ORDER BY ${spec.order}`,
    );
  }
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    created_at: now.toISOString(),
    settings: normalizeSettings(await store.load()),
    tables,
  };
}

export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 1);
}

const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function checkValue(type: Col, v: unknown): boolean {
  if (Array.isArray(type)) return typeof v === "string" && type.includes(v);
  switch (type) {
    case "text":
      return typeof v === "string" && v.length <= 20000;
    case "text?":
      return v === null || v === undefined || (typeof v === "string" && v.length <= 20000);
    case "int":
      return Number.isInteger(v);
    case "num":
      return typeof v === "number" && Number.isFinite(v);
  }
  return false;
}

/** Reads and checks a backup file; throws BackupError. Nothing is written. */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError("not_backup", "not JSON");
  }
  if (!isObject(raw) || raw.format !== BACKUP_FORMAT) throw new BackupError("not_backup");
  if (!Number.isInteger(raw.version) || (raw.version as number) < 1) throw new BackupError("damaged", "version");
  if ((raw.version as number) > BACKUP_VERSION) throw new BackupError("newer_version", String(raw.version));
  if (typeof raw.created_at !== "string" || Number.isNaN(Date.parse(raw.created_at)))
    throw new BackupError("damaged", "created_at");
  if (!isObject(raw.settings) || !isObject(raw.tables)) throw new BackupError("damaged", "sections");

  const version = raw.version as number;
  const tables = {} as BackupFile["tables"];
  for (const name of BACKUP_TABLES) {
    const spec: TableSpec = TABLES[name];
    const rows = raw.tables[name];
    if (spec.since && version < spec.since && rows === undefined) continue;
    if (!Array.isArray(rows) || rows.length > 500_000) throw new BackupError("damaged", name);
    const keys = new Set<string>();
    tables[name] = rows.map((r: unknown, i) => {
      if (!isObject(r)) throw new BackupError("damaged", `${name}[${i}]`);
      const row: Row = {};
      for (const [col, type] of Object.entries(spec.cols)) {
        if (!checkValue(type, r[col])) throw new BackupError("damaged", `${name}[${i}].${col}`);
        row[col] = (r[col] ?? null) as Row[string];
      }
      if (name === "feedback" && row.category === "unnatural") throw new BackupError("damaged", `${name}[${i}]`);
      if (spec.key) {
        const k = String(row[spec.key]);
        if (keys.has(k)) throw new BackupError("damaged", `${name} duplicate ${k}`);
        keys.add(k);
      }
      return row;
    });
  }
  return {
    format: BACKUP_FORMAT,
    version,
    created_at: raw.created_at,
    settings: normalizeSettings(raw.settings),
    tables,
  };
}

/** Rows per INSERT statement (keeps the number of bound values well under SQLite's limit). */
const CHUNK = 50;

async function insertRows(db: SqlDb, table: BackupTable, rows: Row[]) {
  const cols = Object.keys(TABLES[table].cols);
  for (let start = 0; start < rows.length; start += CHUNK) {
    const chunk = rows.slice(start, start + CHUNK);
    const values: unknown[] = [];
    const groups = chunk.map((row) => {
      const marks = cols.map((c) => {
        values.push(row[c] ?? null);
        return `$${values.length}`;
      });
      return `(${marks.join(", ")})`;
    });
    await db.execute(`INSERT INTO ${table} (${cols.join(", ")}) VALUES ${groups.join(", ")}`, values);
  }
}

/**
 * Replaces the learner's data with the backup's. Recordings and their marks are left alone.
 * The caller saves a copy of the current data first and puts it back if this throws.
 */
export async function restoreBackup(db: SqlDb, store: SettingsStore, backup: BackupFile): Promise<void> {
  // tables an older backup does not have keep their current rows
  const present = BACKUP_TABLES.filter((name) => backup.tables[name]);
  for (const name of present) {
    const spec: TableSpec = TABLES[name];
    await db.execute(`DELETE FROM ${name}${spec.where ? ` WHERE ${spec.where}` : ""}`);
  }
  for (const name of present) await insertRows(db, name, backup.tables[name]!);
  for (const key of SETTING_KEYS) await store.save(key, backup.settings[key]);
}

export interface BackupSummary {
  createdAt: string;
  lessons: number;
  reviewItems: number;
  studyDays: number;
  exams: number;
  reports: number;
  /** null for a backup made before hard sentences were kept (restoring it leaves them alone) */
  hardSentences: number | null;
}

export function summarizeBackup(backup: BackupFile): BackupSummary {
  return {
    createdAt: backup.created_at,
    lessons: backup.tables.lesson_progress.filter((r) => r.status !== "new").length,
    reviewItems: backup.tables.review_items.length,
    studyDays: backup.tables.study_days.length,
    exams: backup.tables.exam_results.length,
    reports: backup.tables.feedback.length,
    hardSentences: backup.tables.hard_sentences?.length ?? null,
  };
}

const p2 = (n: number) => String(n).padStart(2, "0");

/** Local date and time, e.g. 20261014-153000 (names of the automatic copies). */
export function backupStamp(d: Date): string {
  return `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}-${p2(d.getHours())}${p2(d.getMinutes())}${p2(d.getSeconds())}`;
}

export function backupFileName(d: Date): string {
  return `Dutch-Tutor-学习数据-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.json`;
}
