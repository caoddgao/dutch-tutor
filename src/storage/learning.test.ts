// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addDays, completeLesson, getProgress, localDay, markStudyDay, savePosition, streak } from "./learning";
import { createTestDb } from "./testDb";

describe("dates", () => {
  it("counts local calendar days", () => {
    expect(localDay(new Date(2026, 0, 31, 23, 59))).toBe("2026-01-31");
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });
});

describe("streak (decided: consecutive calendar days with study or review)", () => {
  it("counts back from today, or from yesterday when today is still empty", () => {
    expect(streak(["2026-10-07", "2026-10-08", "2026-10-09"], "2026-10-09")).toBe(3);
    expect(streak(["2026-10-07", "2026-10-08"], "2026-10-09")).toBe(2);
    expect(streak(["2026-10-06", "2026-10-08"], "2026-10-09")).toBe(1);
    expect(streak(["2026-10-07"], "2026-10-09")).toBe(0);
    expect(streak([], "2026-10-09")).toBe(0);
  });
});

describe("lesson progress", () => {
  it("remembers the position and completes into the review queue", async () => {
    const { db, raw } = createTestDb();
    const now = new Date(2026, 9, 9, 20, 0);
    await savePosition(db, "NN21", 1, 7, now);
    expect(await getProgress(db, "NN21")).toMatchObject({ status: "new", current_step: 1, current_index: 7 });

    const items = [
      { id: "NN21-S01", type: "sentence" as const },
      { id: "w_brood", type: "word" as const },
    ];
    expect(await completeLesson(db, "NN21", items, now)).toEqual({ added: 2 });
    expect(await getProgress(db, "NN21")).toMatchObject({ status: "studied", completed_count: 1 });
    const due = raw.prepare("SELECT item_id, due_at, stage, interval_days FROM review_items ORDER BY item_id").all();
    expect(due).toEqual([
      { item_id: "NN21-S01", due_at: "2026-10-10", stage: 0, interval_days: 1 },
      { item_id: "w_brood", due_at: "2026-10-10", stage: 0, interval_days: 1 },
    ]);

    // a second pass keeps the schedule and a mastered lesson stays mastered
    raw.exec("UPDATE review_items SET stage = 3; UPDATE lesson_progress SET status = 'mastered'");
    expect(await completeLesson(db, "NN21", items, now)).toEqual({ added: 0 });
    expect(await getProgress(db, "NN21")).toMatchObject({ status: "mastered", completed_count: 2 });
  });

  it("adds up study days", async () => {
    const { db, raw } = createTestDb();
    const now = new Date(2026, 9, 9, 9);
    await markStudyDay(db, now, { sentences: 2 });
    await markStudyDay(db, now, { reviews: 5 });
    expect(raw.prepare("SELECT * FROM study_days").all()).toEqual([
      { day: "2026-10-09", sentences_learned: 2, reviews_done: 5 },
    ]);
  });
});
