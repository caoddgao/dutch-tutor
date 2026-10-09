// @vitest-environment node
import { describe, expect, it } from "vitest";
import { createSqliteSettingsStore } from "./sqliteSettingsStore";
import { createTestDb, migrationFiles } from "./testDb";

describe("migrations", () => {
  it("are numbered consecutively from 0001", () => {
    const files = migrationFiles();
    expect(files.length).toBeGreaterThan(0);
    files.forEach((f, i) => expect(f.startsWith(String(i + 1).padStart(4, "0") + "_")).toBe(true));
  });

  it("create every table the app needs", () => {
    const { raw } = createTestDb();
    const tables = raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r) => (r as { name: string }).name);
    expect(tables).toEqual(
      expect.arrayContaining([
        "settings",
        "lesson_progress",
        "review_items",
        "review_log",
        "recordings",
        "feedback",
        "study_days",
      ]),
    );
  });

  it("enforce allowed lesson statuses", () => {
    const { raw } = createTestDb();
    expect(() => raw.exec("INSERT INTO lesson_progress (lesson_id, status) VALUES ('NN21', 'studied')")).not.toThrow();
    expect(() => raw.exec("INSERT INTO lesson_progress (lesson_id, status) VALUES ('NN22', 'done')")).toThrow();
  });
});

describe("sqlite settings store", () => {
  it("saves, overwrites and loads JSON values", async () => {
    const { db } = createTestDb();
    const store = createSqliteSettingsStore(async () => db);
    expect(await store.load()).toEqual({});
    await store.save("theme", "dark");
    await store.save("scaleNl", 1.25);
    await store.save("showEnglish", false);
    await store.save("theme", "light");
    expect(await store.load()).toEqual({ theme: "light", scaleNl: 1.25, showEnglish: false });
  });

  it("survives a reopen (same database, new store)", async () => {
    const { db } = createTestDb();
    await createSqliteSettingsStore(async () => db).save("playbackRate", 0.75);
    expect(await createSqliteSettingsStore(async () => db).load()).toEqual({ playbackRate: 0.75 });
  });
});
