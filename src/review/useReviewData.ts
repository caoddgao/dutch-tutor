import { useCallback, useEffect, useState } from "react";
import { useContent } from "../content/context";
import { partRefs } from "../content/split";
import { courseOrder, type RtLesson } from "../content/model";
import { useServices } from "../servicesContext";
import { localDay } from "../storage/learning";
import { useSettings } from "../settings/context";
import { buildQuestions, cardsFromLessons, type ReviewQuestion } from "./session";
import { dailyItems, lessonItems, mistakeItems, type ReviewMode, type ReviewSource } from "./store";

export interface SessionData {
  questions: ReviewQuestion[];
  /** Items that cannot be shown (their lesson needs the pack) */
  missing: number;
}

/** Loads the items of a session and the lessons (plus neighbours, for distractors) they come from. */
export function useReviewSession(source: ReviewSource, lessonId?: string): SessionData | null {
  const { db } = useServices();
  const { bundle, dict, loadLesson, packStatus } = useContent();
  const { settings } = useSettings();
  const [data, setData] = useState<SessionData | null>(null);
  const modes = (["R1", "R2", "R3"] as ReviewMode[]).filter((m) => settings[`review${m}`]);
  const modeKey = modes.join(",");

  const load = useCallback(async () => {
    const d = await db();
    const items =
      source === "daily"
        ? await dailyItems(d, settings.dailyReviewLimit)
        : source === "lesson"
          ? await lessonItems(d, lessonId ?? "")
          : await mistakeItems(d);
    const order = courseOrder(bundle);
    const ids = new Set<string>();
    for (const it of items) {
      const i = order.indexOf(it.lesson_id);
      // recorded before the lesson was split (design §2.1, e.g. NN21 → NN21a / NN21b): look in its parts
      if (i < 0) for (const r of partRefs(bundle.course, it.lesson_id)) ids.add(r.id);
      ids.add(it.lesson_id);
      if (i > 0) ids.add(order[i - 1]);
      if (i >= 0 && i + 1 < order.length) ids.add(order[i + 1]);
    }
    const lessons = (await Promise.all([...ids].map((id) => loadLesson(id).catch(() => null)))).filter(
      (l): l is RtLesson => !!l,
    );
    const { cards, pool, missing } = cardsFromLessons(items, lessons, dict);
    const questions = buildQuestions(
      cards,
      pool,
      modeKey.split(",") as ReviewMode[],
      `${source}|${lessonId}|${localDay(new Date())}`,
    );
    return { questions, missing };
  }, [db, source, lessonId, settings.dailyReviewLimit, bundle, dict, loadLesson, modeKey]);

  useEffect(() => {
    if (packStatus === "loading") return;
    let cancelled = false;
    load()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ questions: [], missing: 0 }));
    return () => {
      cancelled = true;
    };
    // a session is fixed once loaded; settings changes apply to the next one
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packStatus]);

  return data;
}
