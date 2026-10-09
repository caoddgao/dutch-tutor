// @vitest-environment node
import { describe, expect, it } from "vitest";
import { completeLesson, getProgress } from "../storage/learning";
import { createTestDb } from "../storage/testDb";
import { intervalForStage, nextSchedule } from "./schedule";
import { dailyItems, dueCount, lessonItems, mistakeItems, recordAnswer, reviewedToday, updateMastery } from "./store";

describe("spacing ladder (design §4.3)", () => {
  it("goes 1 → 3 → 7 → 14 → 30 → 60, then ×1.7", () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].map(intervalForStage)).toEqual([1, 3, 7, 14, 30, 60, 102, 173]);
  });

  it("good moves up, fuzzy repeats the interval, bad goes back to one day", () => {
    const s = { stage: 2, interval_days: 7, reps: 4, lapses: 0 };
    expect(nextSchedule(s, "good")).toEqual({ stage: 3, interval_days: 14, reps: 5, lapses: 0 });
    expect(nextSchedule(s, "fuzzy")).toEqual({ stage: 2, interval_days: 7, reps: 5, lapses: 0 });
    expect(nextSchedule(s, "bad")).toEqual({ stage: 0, interval_days: 1, reps: 5, lapses: 1 });
  });
});

async function seeded() {
  const t = createTestDb();
  const day1 = new Date(2026, 9, 9, 20);
  await completeLesson(
    t.db,
    "NN21",
    Array.from({ length: 5 }, (_, i) => ({ id: `NN21-S0${i + 1}`, type: "sentence" as const })),
    day1,
  );
  return { ...t, day1 };
}

describe("review queue", () => {
  it("items are due the day after the lesson", async () => {
    const { db, day1 } = await seeded();
    expect(await dueCount(db, day1)).toBe(0);
    expect(await dueCount(db, new Date(2026, 9, 10, 8))).toBe(5);
  });

  it("today's review respects the daily limit, counting what was already done", async () => {
    const { db } = await seeded();
    const day2 = new Date(2026, 9, 10, 9);
    const items = await dailyItems(db, 3, day2);
    expect(items).toHaveLength(3);
    await recordAnswer(db, items[0], "good", "R1", "daily", { now: day2 });
    expect(await reviewedToday(db, day2)).toBe(1);
    expect(await dailyItems(db, 3, day2)).toHaveLength(2);
  });

  it("answers move the schedule; a repeat in the same session only gets logged", async () => {
    const { db, raw } = await seeded();
    const day2 = new Date(2026, 9, 10, 9);
    const [a, b] = await lessonItems(db, "NN21");
    const after = await recordAnswer(db, a, "good", "R2", "daily", { now: day2 });
    expect(after).toMatchObject({ stage: 1, interval_days: 3, due_at: "2026-10-13" });
    await recordAnswer(db, b, "bad", "R3", "daily", { now: day2 });
    await recordAnswer(db, { ...b, stage: 0, interval_days: 1 }, "good", "R3", "daily", { now: day2, repeat: true });
    expect(
      raw.prepare("SELECT stage, interval_days, due_at, lapses FROM review_items WHERE item_id = ?").get(b.item_id),
    ).toEqual({
      stage: 0,
      interval_days: 1,
      due_at: "2026-10-11",
      lapses: 1,
    });
    expect(raw.prepare("SELECT COUNT(*) AS n FROM review_log").get()).toEqual({ n: 3 });
    expect(raw.prepare("SELECT reviews_done FROM study_days WHERE day = '2026-10-10'").get()).toEqual({
      reviews_done: 2,
    });
  });

  it("mistakes are items whose latest answer was wrong", async () => {
    const { db } = await seeded();
    const now = new Date(2026, 9, 10, 9);
    const [a, b] = await lessonItems(db, "NN21");
    await recordAnswer(db, a, "bad", "R1", "daily", { now });
    await recordAnswer(db, b, "bad", "R1", "daily", { now });
    await recordAnswer(db, b, "good", "R1", "mistakes", { now: new Date(2026, 9, 10, 10) });
    expect((await mistakeItems(db)).map((i) => i.item_id)).toEqual([a.item_id]);
  });

  it("a lesson becomes mastered when 80 % of its items reach 7 days, and drops back", async () => {
    const { db, raw } = await seeded();
    raw.exec("UPDATE review_items SET interval_days = 7 WHERE item_id <> 'NN21-S05'");
    await updateMastery(db, ["NN21"]);
    expect((await getProgress(db, "NN21"))?.status).toBe("mastered");
    raw.exec("UPDATE review_items SET interval_days = 1 WHERE item_id IN ('NN21-S01', 'NN21-S02')");
    await updateMastery(db, ["NN21"]);
    expect((await getProgress(db, "NN21"))?.status).toBe("studied");
  });
});
