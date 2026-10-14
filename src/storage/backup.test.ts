// @vitest-environment node
import { describe, expect, it } from "vitest";
import { recordAnswer } from "../review/store";
import { DEFAULT_SETTINGS } from "../settings/settings";
import {
  BACKUP_TABLES,
  BACKUP_VERSION,
  BackupError,
  backupErrorMessage,
  collectBackup,
  parseBackup,
  restoreBackup,
  serializeBackup,
  summarizeBackup,
} from "./backup";
import { saveExamResult } from "./examResults";
import { hardSentenceIds, setHardSentence } from "./hardSentences";
import { completeLesson, markStudyDay, savePosition } from "./learning";
import { createSqliteSettingsStore } from "./sqliteSettingsStore";
import { createTestDb } from "./testDb";
import type { SqlDb } from "./db";

const NOW = new Date(2026, 9, 14, 15, 30);

async function seed(db: SqlDb) {
  await savePosition(db, "NN21", 2, 4, NOW);
  await completeLesson(
    db,
    "P01",
    [
      { id: "P01-S01", type: "sentence" },
      { id: "w_huis", type: "word" },
    ],
    NOW,
  );
  const [item] = await db.select<never[]>(
    "SELECT item_id, item_type, lesson_id, stage, interval_days, due_at, reps, lapses FROM review_items WHERE item_id = 'P01-S01'",
  );
  await recordAnswer(db, item, "good", "R1", "daily");
  await markStudyDay(db, NOW, { sentences: 5 });
  await saveExamResult(db, "TT1", 8, 10);
  await setHardSentence(db, "P01-S03", true);
  await db.execute(
    "INSERT INTO feedback (target_type, target_id, category, note, lesson_id, nl, zh) VALUES ('sentence', 'P01-S01', 'translation', '中文不通顺', 'P01', 'Ik woon hier.', '我住这儿。')",
  );
  // a recording-mode mark: travels with the recordings, not with the backup
  await db.execute(
    "INSERT INTO feedback (target_type, target_id, category) VALUES ('sentence', 'P01-S02', 'unnatural')",
  );
}

function dump(raw: ReturnType<typeof createTestDb>["raw"]) {
  const out: Record<string, unknown[]> = {};
  for (const t of BACKUP_TABLES) {
    const sql =
      t === "review_log"
        ? "SELECT item_id, mode, result, source, reviewed_at FROM review_log ORDER BY id"
        : t === "feedback"
          ? "SELECT target_type, target_id, category, note, created_at, exported_at, lesson_id, nl, zh FROM feedback ORDER BY category, target_id, created_at"
          : `SELECT * FROM ${t} ORDER BY 1`;
    out[t] = raw.prepare(sql).all();
  }
  return out;
}

describe("backup round trip", () => {
  it("export → clear → import gives back the same data", async () => {
    const a = createTestDb();
    const storeA = createSqliteSettingsStore(async () => a.db);
    await seed(a.db);
    await storeA.save("theme", "dark");
    await storeA.save("dailyReviewLimit", 80);

    const text = serializeBackup(await collectBackup(a.db, storeA, NOW));
    const before = dump(a.raw);

    // a fresh install with other data in it, plus its own recording mark
    const b = createTestDb();
    const storeB = createSqliteSettingsStore(async () => b.db);
    await savePosition(b.db, "NN30", 1, 1, NOW);
    await storeB.save("theme", "light");
    await b.db.execute("INSERT INTO feedback (target_type, target_id, category) VALUES ('word', 'w_x', 'unnatural')");
    await restoreBackup(b.db, storeB, parseBackup(text));

    const after = dump(b.raw);
    expect(after.lesson_progress).toEqual(before.lesson_progress);
    expect(after.review_items).toEqual(before.review_items);
    expect(after.review_log).toEqual(before.review_log);
    expect(after.exam_results).toEqual(before.exam_results);
    expect(after.study_days).toEqual(before.study_days);
    // reports restored; B's own recording mark untouched; A's recording mark not carried over
    const reports = (after.feedback as { category: string; target_id: string }[]).filter(
      (f) => f.category !== "unnatural",
    );
    expect(reports).toEqual((before.feedback as { category: string }[]).filter((f) => f.category !== "unnatural"));
    const marks = (after.feedback as { category: string; target_id: string }[]).filter(
      (f) => f.category === "unnatural",
    );
    expect(marks.map((m) => m.target_id)).toEqual(["w_x"]);

    const settings = await storeB.load();
    expect(settings.theme).toBe("dark");
    expect(settings.dailyReviewLimit).toBe(80);
    expect(settings.reviewR2).toBe(DEFAULT_SETTINGS.reviewR2);
  });

  it("restoring the same file twice changes nothing", async () => {
    const a = createTestDb();
    const store = createSqliteSettingsStore(async () => a.db);
    await seed(a.db);
    const backup = parseBackup(serializeBackup(await collectBackup(a.db, store, NOW)));
    const before = dump(a.raw);
    await restoreBackup(a.db, store, backup);
    await restoreBackup(a.db, store, backup);
    expect(dump(a.raw)).toEqual(before);
  });

  it("restores into an empty database and handles many rows", async () => {
    const a = createTestDb();
    const store = createSqliteSettingsStore(async () => a.db);
    for (let i = 0; i < 260; i++)
      await a.db.execute(
        "INSERT INTO review_log (item_id, mode, result, source, reviewed_at) VALUES ($1, 'R2', 'bad', 'mistakes', $2)",
        [`S${i}`, NOW.toISOString()],
      );
    const text = serializeBackup(await collectBackup(a.db, store, NOW));
    const b = createTestDb();
    await restoreBackup(
      b.db,
      createSqliteSettingsStore(async () => b.db),
      parseBackup(text),
    );
    expect(dump(b.raw).review_log).toEqual(dump(a.raw).review_log);
  });

  it("keeps the Azure key and recordings out of the file", async () => {
    const a = createTestDb();
    const store = createSqliteSettingsStore(async () => a.db);
    await a.db.execute("INSERT INTO recordings (audio_id, kind, file_path) VALUES ('P01-S01', 'voice', '/x/y.webm')");
    const text = serializeBackup(await collectBackup(a.db, store, NOW));
    const parsed = JSON.parse(text);
    expect(parsed.format).toBe("dutch-tutor-backup");
    expect(parsed.version).toBe(2);
    expect(Object.keys(parsed.tables).sort()).toEqual([...BACKUP_TABLES].sort());
    expect(text).not.toMatch(/azure|recordings|file_path|key"/i);
  });

  it("summarizes what a backup holds", async () => {
    const a = createTestDb();
    const store = createSqliteSettingsStore(async () => a.db);
    await seed(a.db);
    const s = summarizeBackup(await collectBackup(a.db, store, NOW));
    expect(s).toMatchObject({ lessons: 1, reviewItems: 2, studyDays: 1, exams: 1, reports: 1, hardSentences: 1 });
  });

  it("restores a version 1 backup (before hard sentences) and keeps the current hard sentences", async () => {
    const a = createTestDb();
    const storeA = createSqliteSettingsStore(async () => a.db);
    await seed(a.db);
    const old = JSON.parse(serializeBackup(await collectBackup(a.db, storeA, NOW)));
    old.version = 1;
    delete old.tables.hard_sentences;

    const b = createTestDb();
    await setHardSentence(b.db, "NN21-S03", true);
    const parsed = parseBackup(JSON.stringify(old));
    expect(summarizeBackup(parsed).hardSentences).toBeNull();
    await restoreBackup(
      b.db,
      createSqliteSettingsStore(async () => b.db),
      parsed,
    );
    expect(await hardSentenceIds(b.db)).toEqual(["NN21-S03"]);
    expect(dump(b.raw).lesson_progress).toEqual(dump(a.raw).lesson_progress);
  });
});

describe("bad backup files", () => {
  const good = async () => {
    const a = createTestDb();
    await seed(a.db);
    return JSON.parse(
      serializeBackup(
        await collectBackup(
          a.db,
          createSqliteSettingsStore(async () => a.db),
          NOW,
        ),
      ),
    );
  };
  const codeOf = (text: string) => {
    try {
      parseBackup(text);
      return "ok";
    } catch (e) {
      return (e as BackupError).code;
    }
  };

  it("rejects files that are not backups", () => {
    expect(codeOf("")).toBe("not_backup");
    expect(codeOf("not json at all")).toBe("not_backup");
    expect(codeOf("[]")).toBe("not_backup");
    expect(codeOf(JSON.stringify({ format: "dutch-tutor-recordings", version: 1 }))).toBe("not_backup");
    expect(codeOf(JSON.stringify({ version: 1, recordings: [], marks: [] }))).toBe("not_backup");
  });

  it("rejects backups from a newer program", async () => {
    const b = await good();
    b.version = BACKUP_VERSION + 1;
    expect(codeOf(JSON.stringify(b))).toBe("newer_version");
  });

  it("rejects damaged or edited files", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- edits reach into arbitrary JSON
    const cases: ((b: Record<string, any>) => void)[] = [
      (b) => (b.version = "1"),
      (b) => (b.version = 0),
      (b) => delete b.created_at,
      (b) => (b.created_at = "yesterday"),
      (b) => delete b.tables,
      (b) => delete b.settings,
      (b) => delete b.tables.review_items,
      (b) => delete b.tables.hard_sentences,
      (b) => b.tables.hard_sentences.push({ ...b.tables.hard_sentences[0] }),
      (b) => (b.tables.review_log = {}),
      (b) => (b.tables.lesson_progress[0].status = "done"),
      (b) => (b.tables.review_items[0].stage = 1.5),
      (b) => (b.tables.review_items[0].interval_days = "1"),
      (b) => delete b.tables.review_items[0].due_at,
      (b) => b.tables.review_items.push({ ...b.tables.review_items[0] }),
      (b) => (b.tables.review_log[0].mode = "R4"),
      (b) => (b.tables.feedback[0].category = "unnatural"),
      (b) => (b.tables.feedback[0].target_type = "lesson"),
      (b) => (b.tables.study_days[0] = "2026-10-14"),
    ];
    for (const edit of cases) {
      const b = await good();
      edit(b);
      expect(codeOf(JSON.stringify(b))).toBe("damaged");
    }
  });

  it("accepts a good file and fills in bad settings with defaults", async () => {
    const b = await good();
    b.settings = { theme: "purple", scaleNl: 9 };
    b.extra = "ignored";
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.settings.theme).toBe(DEFAULT_SETTINGS.theme);
    expect(parsed.settings.scaleNl).toBe(1.5);
  });

  it("a rejected file leaves the data alone", async () => {
    const a = createTestDb();
    await seed(a.db);
    const before = dump(a.raw);
    expect(() => parseBackup("{}")).toThrow(BackupError);
    expect(dump(a.raw)).toEqual(before);
  });

  it("explains every problem in plain Chinese", () => {
    for (const code of ["not_backup", "newer_version", "damaged"] as const) {
      const text = backupErrorMessage(new BackupError(code));
      expect(text).toMatch(/[一-鿿]/);
      expect(text).not.toMatch(/error|json|null|undefined|not_backup|damaged|version/i);
    }
    expect(backupErrorMessage(new Error("io"))).toMatch(/读不出/);
  });
});
