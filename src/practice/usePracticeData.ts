import { useEffect, useState } from "react";
import { useContent } from "../content/context";
import { useServices } from "../servicesContext";
import { allProgress } from "../storage/learning";
import { lessonLabel, practiceSentences, studiedLessons, type PracticeLesson } from "./data";

export interface PracticeData {
  /** Studied lessons with sentences, in course order */
  lessons: PracticeLesson[];
  /** The lesson studied most recently, when it has sentences */
  latest: string | null;
  /** Studied lessons that cannot be opened now (their lesson needs the pack) */
  missing: number;
}

/** Loads the studied lessons and their sentences; null while loading. */
export function usePracticeData(): PracticeData | null {
  const { db } = useServices();
  const { course, loadLesson, packStatus } = useContent();
  const [data, setData] = useState<PracticeData | null>(null);

  useEffect(() => {
    if (packStatus === "loading") return;
    let cancelled = false;
    (async () => {
      const studied = studiedLessons(course, await allProgress(await db()));
      const loaded = await Promise.all(studied.lessons.map((l) => loadLesson(l.id).catch(() => null)));
      const seen = new Set<string>();
      const lessons: PracticeLesson[] = [];
      studied.lessons.forEach((l, i) => {
        const lesson = loaded[i];
        if (!lesson) return;
        const sentences = practiceSentences(lesson, seen);
        if (sentences.length) lessons.push({ id: l.id, label: lessonLabel(l), sentences });
      });
      const latest = lessons.some((l) => l.id === studied.latest) ? studied.latest : null;
      return { lessons, latest, missing: studied.unavailable + loaded.filter((l) => !l).length };
    })()
      .then((d) => !cancelled && setData(d))
      .catch(() => !cancelled && setData({ lessons: [], latest: null, missing: 0 }));
    return () => {
      cancelled = true;
    };
  }, [db, course, loadLesson, packStatus]);

  return data;
}
