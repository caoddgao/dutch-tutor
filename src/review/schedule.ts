// Spacing (design §4.3), kept in its own module so it can later be swapped for FSRS.
// Ladder 1 → 3 → 7 → 14 → 30 → 60 days, then ×1.7 each time.
// good: one step up · fuzzy: same interval again · bad: back to 1 day (and once more today in the session).

export type ReviewResult = "good" | "fuzzy" | "bad";

export const LADDER = [1, 3, 7, 14, 30, 60] as const;
export const GROWTH = 1.7;
/** An item counts as "熟练" (well known) from this interval on (design §2.2) */
export const MASTERED_INTERVAL = 7;
/** A lesson is "掌握" when this share of its items is well known */
export const MASTERY_SHARE = 0.8;

export function intervalForStage(stage: number): number {
  if (stage < LADDER.length) return LADDER[Math.max(0, stage)];
  const last = LADDER[LADDER.length - 1];
  return Math.round(last * GROWTH ** (stage - LADDER.length + 1));
}

export interface ScheduleState {
  stage: number;
  interval_days: number;
  reps: number;
  lapses: number;
}

export function nextSchedule(item: ScheduleState, result: ReviewResult): ScheduleState {
  const reps = item.reps + 1;
  switch (result) {
    case "good": {
      const stage = item.stage + 1;
      return { stage, interval_days: intervalForStage(stage), reps, lapses: item.lapses };
    }
    case "fuzzy":
      return { stage: item.stage, interval_days: intervalForStage(item.stage), reps, lapses: item.lapses };
    case "bad":
      return { stage: 0, interval_days: 1, reps, lapses: item.lapses + 1 };
  }
}
