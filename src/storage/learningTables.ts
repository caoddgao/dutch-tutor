// "导出成表格（只供查看）" (decision 29): the learner's data as an Excel workbook to look at.
// Four sheets: 课程进度, 测验成绩, 学习天数, 复习统计. Restoring still reads only the JSON backup.
import type { ContentBundle } from "../content/ownTypes";
import { lessonCode, type CourseSectionView } from "../content/model";
import { formatDateTime } from "../format";
import { MASTERED_INTERVAL } from "../review/schedule";
import type { SqlDb } from "./db";
import { localDay } from "./learning";
import type { CellValue, TableSheet } from "./workbook";

export interface LessonName {
  /** As on the course map (`lessonCode()`): 第 21 课, 第 24 课 a, 测验 1, P01 */
  code: string;
  /** Chinese title; "" when unknown (pack lessons without a pack) */
  title: string;
  section: string;
}

/** Every lesson of the course, available or not, in course order; titles come from the course view. */
export function lessonNames(
  bundle: Pick<ContentBundle, "course">,
  course: CourseSectionView[],
): Map<string, LessonName> {
  const view = new Map(course.flatMap((s) => [...s.lessons, ...s.missing]).map((l) => [l.id, l]));
  const names = new Map<string, LessonName>();
  for (const s of bundle.course.sections)
    for (const ref of s.lessons)
      names.set(ref.id, { code: lessonCode(s.id, ref), title: view.get(ref.id)?.title?.zh ?? "", section: s.title });
  return names;
}

const STATUS_ZH: Record<string, string> = { new: "未学", studied: "学过", mastered: "已掌握" };

const EXAM_PARTS: Record<string, string> = { oral: "口语", reading: "阅读" };

interface ProgressRow {
  lesson_id: string;
  status: string;
  completed_count: number;
  first_completed_at: string | null;
  last_studied_at: string | null;
}

interface ExamRow {
  id: string;
  correct: number;
  total: number;
  taken_at: string;
}

interface DayRow {
  day: string;
  sentences_learned: number;
  reviews_done: number;
}

interface ReviewRow {
  lesson_id: string;
  sentences: number;
  words: number;
  known: number;
  due: number;
  reps: number;
  good: number | null;
  fuzzy: number | null;
  bad: number | null;
  last: string | null;
}

const percent = (correct: number, total: number) => (total > 0 ? Math.round((correct / total) * 100) : null);

/** The four sheets, built from the database; `course` (the course map's view) gives the lesson titles. */
export async function buildLearningTables(
  db: SqlDb,
  course: CourseSectionView[],
  bundle: Pick<ContentBundle, "course" | "exams">,
  now = new Date(),
): Promise<TableSheet[]> {
  const names = lessonNames(bundle, course);
  const order = [...names.keys()];
  const rank = (id: string) => {
    const i = order.indexOf(id);
    return i < 0 ? order.length : i;
  };
  const byCourse = <T>(rows: T[], id: (r: T) => string) =>
    [...rows].sort((a, b) => rank(id(a)) - rank(id(b)) || id(a).localeCompare(id(b)));
  const name = (id: string): [string, string] => {
    const n = names.get(id);
    return n ? [n.code, n.title] : [id, ""];
  };

  const progress = await db.select<ProgressRow[]>(
    "SELECT lesson_id, status, completed_count, first_completed_at, last_studied_at FROM lesson_progress",
  );
  const progressById = new Map(progress.map((p) => [p.lesson_id, p]));
  // every lesson of the course, then anything recorded for a lesson the course no longer lists
  const lessonIds = [...order, ...byCourse(progress, (p) => p.lesson_id).map((p) => p.lesson_id)].filter(
    (id, i, all) => all.indexOf(id) === i,
  );
  const progressRows: CellValue[][] = lessonIds.map((id) => {
    const p = progressById.get(id);
    return [
      ...name(id),
      names.get(id)?.section ?? "",
      STATUS_ZH[p?.status ?? "new"] ?? "",
      p?.completed_count ?? 0,
      formatDateTime(p?.first_completed_at),
      formatDateTime(p?.last_studied_at),
    ];
  });

  const exams = await db.select<ExamRow[]>("SELECT id, correct, total, taken_at FROM exam_results");
  const examName = (id: string) => {
    if (names.has(id)) return name(id);
    // the A1 mock exam is kept per part: A1-MOCK-1-oral, A1-MOCK-1-reading
    const m = /^(.+)-(oral|reading)$/.exec(id);
    const exam = m ? bundle.exams?.[m[1]] : undefined;
    return exam && m ? [exam.title.zh, EXAM_PARTS[m[2]]] : [id, ""];
  };
  const examRows: CellValue[][] = byCourse(exams, (e) => e.id).map((e) => [
    ...examName(e.id),
    e.correct,
    e.total,
    percent(e.correct, e.total),
    formatDateTime(e.taken_at),
  ]);

  const days = await db.select<DayRow[]>("SELECT day, sentences_learned, reviews_done FROM study_days ORDER BY day");
  const dayRows: CellValue[][] = days.map((d) => [d.day, d.sentences_learned, d.reviews_done]);

  const reviews = await db.select<ReviewRow[]>(
    `SELECT i.lesson_id,
       SUM(CASE WHEN i.item_type = 'sentence' THEN 1 ELSE 0 END) AS sentences,
       SUM(CASE WHEN i.item_type = 'word' THEN 1 ELSE 0 END) AS words,
       SUM(CASE WHEN i.interval_days >= $1 THEN 1 ELSE 0 END) AS known,
       SUM(CASE WHEN i.due_at <= $2 THEN 1 ELSE 0 END) AS due,
       SUM(COALESCE(l.reps, 0)) AS reps, SUM(l.good) AS good, SUM(l.fuzzy) AS fuzzy, SUM(l.bad) AS bad,
       MAX(l.last) AS last
     FROM review_items i LEFT JOIN (
       SELECT item_id, COUNT(*) AS reps,
         SUM(CASE WHEN result = 'good' THEN 1 ELSE 0 END) AS good,
         SUM(CASE WHEN result = 'fuzzy' THEN 1 ELSE 0 END) AS fuzzy,
         SUM(CASE WHEN result = 'bad' THEN 1 ELSE 0 END) AS bad,
         MAX(reviewed_at) AS last
       FROM review_log GROUP BY item_id
     ) l ON l.item_id = i.item_id
     GROUP BY i.lesson_id`,
    [MASTERED_INTERVAL, localDay(now)],
  );
  const reviewRows: CellValue[][] = byCourse(reviews, (r) => r.lesson_id).map((r) => [
    ...name(r.lesson_id),
    r.sentences,
    r.words,
    r.known,
    r.due,
    r.reps,
    r.good ?? 0,
    r.fuzzy ?? 0,
    r.bad ?? 0,
    formatDateTime(r.last),
  ]);
  if (reviewRows.length > 0) {
    const sum = (k: keyof ReviewRow) => reviews.reduce((n, r) => n + Number(r[k] ?? 0), 0);
    reviewRows.push([
      "合计",
      "",
      sum("sentences"),
      sum("words"),
      sum("known"),
      sum("due"),
      sum("reps"),
      sum("good"),
      sum("fuzzy"),
      sum("bad"),
      formatDateTime(
        reviews
          .map((r) => r.last ?? "")
          .sort()
          .pop(),
      ),
    ]);
  }

  return [
    {
      name: "课程进度",
      columns: [
        { title: "课号", width: 12 },
        { title: "课题", width: 24 },
        { title: "部分", width: 10 },
        { title: "状态", width: 8 },
        { title: "学完次数", width: 10 },
        { title: "第一次学完", width: 18 },
        { title: "最近学习", width: 18 },
      ],
      rows: progressRows,
    },
    {
      name: "测验成绩",
      columns: [
        { title: "测验", width: 14 },
        { title: "名称", width: 24 },
        { title: "答对", width: 8 },
        { title: "题数", width: 8 },
        { title: "正确率（%）", width: 12 },
        { title: "完成时间", width: 18 },
      ],
      rows: examRows,
    },
    {
      name: "学习天数",
      columns: [
        { title: "日期", width: 12 },
        { title: "新学句子", width: 10 },
        { title: "复习次数", width: 10 },
      ],
      rows: dayRows,
    },
    {
      name: "复习统计",
      columns: [
        { title: "课号", width: 12 },
        { title: "课题", width: 24 },
        { title: "句子", width: 8 },
        { title: "词", width: 8 },
        { title: "已熟练", width: 8 },
        { title: "今天该复习", width: 12 },
        { title: "复习次数", width: 10 },
        { title: "会", width: 8 },
        { title: "模糊", width: 8 },
        { title: "不会", width: 8 },
        { title: "最近复习", width: 18 },
      ],
      rows: reviewRows,
    },
  ];
}

const p2 = (n: number) => String(n).padStart(2, "0");

export function learningTableFileName(d: Date): string {
  return `Dutch-Tutor-学习数据表-${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}.xlsx`;
}
