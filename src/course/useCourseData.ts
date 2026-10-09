import { useEffect, useMemo, useState } from "react";
import { useContent } from "../content/context";
import { dueCount, lessonStats, reviewedToday, sentenceCount, type LessonReviewStat } from "../review/store";
import { useServices } from "../servicesContext";
import { useSettings } from "../settings/context";
import { allProgress, localDay, streak, type LessonProgress } from "../storage/learning";
import { continueLesson, summarizeCourse, type ContinueInfo } from "./progress";
import { recommendNext, type CourseSection } from "./types";

export interface LearnerRecords {
  progress: LessonProgress[];
  stats: LessonReviewStat[];
  reviewsToday: number;
  sentencesLearned: number;
  streakDays: number;
}

export interface CourseData {
  sections: CourseSection[];
  records: LearnerRecords;
  continueInfo: ContinueInfo | null;
}

const EMPTY: LearnerRecords = { progress: [], stats: [], reviewsToday: 0, sentencesLearned: 0, streakDays: 0 };

/** Course map and home data: content + progress, reviews and study days from SQLite. */
export function useCourseData(): CourseData | null {
  const { db } = useServices();
  const { course, bundle, packIndex, packStatus } = useContent();
  const { settings } = useSettings();
  const [records, setRecords] = useState<LearnerRecords | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await db();
      const [progress, stats, due, done, sentences, days] = await Promise.all([
        allProgress(d),
        lessonStats(d),
        dueCount(d),
        reviewedToday(d),
        sentenceCount(d),
        d.select<{ day: string }[]>("SELECT day FROM study_days"),
      ]);
      if (cancelled) return;
      setRecords({
        progress,
        stats,
        reviewsToday: Math.min(due, Math.max(0, settings.dailyReviewLimit - done)),
        sentencesLearned: sentences,
        streakDays: streak(
          days.map((r) => r.day),
          localDay(new Date()),
        ),
      });
    })().catch(() => !cancelled && setRecords(EMPTY));
    return () => {
      cancelled = true;
    };
  }, [db, settings.dailyReviewLimit]);

  return useMemo(() => {
    if (!records || packStatus === "loading") return null;
    const sections = summarizeCourse(course, bundle, packIndex, records.progress, records.stats);
    const recommended = recommendNext(sections);
    return {
      sections,
      records,
      continueInfo: continueLesson(sections, records.progress, course, bundle, packIndex, recommended),
    };
  }, [records, packStatus, course, bundle, packIndex]);
}
