import { ArrowRight, BookOpen, Repeat2, TriangleAlert } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { EmptyState } from "../components/EmptyState";
import { ProgressBar } from "../components/ProgressBar";
import { useContent } from "../content/context";
import { ReviewSession } from "../review/ReviewSession";
import { dueCount, lessonStats, mistakeItems, reviewedToday, type LessonReviewStat } from "../review/store";
import { useServices } from "../servicesContext";
import { useSettings } from "../settings/context";
import "../review/review.css";

interface Overview {
  today: number;
  dueTotal: number;
  doneToday: number;
  mistakes: number;
  lessons: LessonReviewStat[];
}

/** /review: today's review, review by lesson, mistakes (design §4.4). */
export function ReviewPage() {
  const { db } = useServices();
  const { settings } = useSettings();
  const { course } = useContent();
  const navigate = useNavigate();
  const [data, setData] = useState<Overview | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const d = await db();
      const [dueTotal, doneToday, mistakes, lessons] = await Promise.all([
        dueCount(d),
        reviewedToday(d),
        mistakeItems(d),
        lessonStats(d),
      ]);
      const today = Math.min(dueTotal, Math.max(0, settings.dailyReviewLimit - doneToday));
      if (!cancelled) setData({ today, dueTotal, doneToday, mistakes: mistakes.length, lessons });
    })().catch(() => !cancelled && setData({ today: 0, dueTotal: 0, doneToday: 0, mistakes: 0, lessons: [] }));
    return () => {
      cancelled = true;
    };
  }, [db, settings.dailyReviewLimit]);

  const lessonInfo = useMemo(() => {
    const all = course.flatMap((s) => [...s.lessons, ...s.missing]);
    return new Map(all.map((l) => [l.id, l]));
  }, [course]);

  if (!data) return <p className="muted lesson-loading">正在读取…</p>;
  if (data.lessons.length === 0)
    return (
      <EmptyState
        icon={Repeat2}
        title="还没有要复习的内容"
        action={
          <Link to="/courses" className="btn btn-primary">
            去学一课
          </Link>
        }
      >
        学完一课后，这一课的句子和单词会进入复习。到期的内容每天出现在这里。
      </EmptyState>
    );

  const order = [...lessonInfo.keys()];
  const lessons = [...data.lessons].sort((a, b) => order.indexOf(a.lesson_id) - order.indexOf(b.lesson_id));

  return (
    <div className="review-home">
      <div className="review-entries">
        <section className="immersive review-today" aria-label="今日复习">
          <div>
            <span className="continue-chip">今日复习</span>
          </div>
          <p className="review-today-number">
            {data.today}
            <small>项</small>
          </p>
          <p className="review-today-note">
            {data.today > 0
              ? `句子和单词，三种方式轮换。大约 ${Math.max(1, Math.ceil(data.today / 3))} 分钟。`
              : data.dueTotal > 0
                ? `今天已复习 ${data.doneToday} 项，到了每日上限，剩下的明天再来。`
                : "今天到期的都复习完了。"}
          </p>
          <div>
            <button
              type="button"
              className="btn btn-accent"
              disabled={data.today === 0}
              onClick={() => navigate("/review/daily")}
            >
              开始复习
              <ArrowRight size={16} aria-hidden />
            </button>
          </div>
        </section>
        <section className="card stat-card" aria-label="错题集中练">
          <div className="stat-head">
            <span className="stat-icon stat-icon-accent">
              <TriangleAlert size={20} aria-hidden />
            </span>
            <span className="stat-title">错题集中练</span>
          </div>
          <p className="stat-number">
            {data.mistakes}
            <span className="stat-unit">项</span>
          </p>
          <p className="muted stat-desc">最近一次答错或选了“不会”的句子和单词。</p>
          <button
            type="button"
            className="btn btn-primary stat-btn"
            disabled={data.mistakes === 0}
            onClick={() => navigate("/review/mistakes")}
          >
            集中练一练
            <ArrowRight size={16} aria-hidden />
          </button>
        </section>
      </div>

      <section className="review-lessons" aria-label="按课复习">
        <div className="course-section-head">
          <h2 className="section-title">按课复习</h2>
          <span className="muted course-section-meta">复习一课的全部句子和单词，结果同样计入复习安排</span>
        </div>
        {lessons.map((s) => {
          const info = lessonInfo.get(s.lesson_id);
          return (
            <div key={s.lesson_id} className="review-lesson-row">
              <span className="lesson-code-chip">{info?.code ?? s.lesson_id}</span>
              <div>
                <p className="nl" lang="nl">
                  {info?.title?.nl ?? s.lesson_id}
                </p>
                <p className="review-lesson-meta">
                  {s.total} 项 · 已熟练 {s.known} · 今天到期 {s.due}
                </p>
              </div>
              <ProgressBar value={s.total ? s.known / s.total : 0} label={`${info?.code ?? s.lesson_id} 熟练度`} />
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => navigate(`/review/lesson/${s.lesson_id}`)}
              >
                <BookOpen size={14} aria-hidden />
                复习
              </button>
            </div>
          );
        })}
      </section>
    </div>
  );
}

export function ReviewSessionPage() {
  const params = useParams();
  const lessonId = params.lessonId;
  const source = lessonId ? "lesson" : (params.source ?? "daily");
  const { course } = useContent();
  const info = course.flatMap((s) => [...s.lessons, ...s.missing]).find((l) => l.id === lessonId);
  const title =
    source === "lesson" ? `${info?.code ?? lessonId} 复习` : source === "mistakes" ? "错题集中练" : "今日复习";
  const kind = source === "lesson" || source === "mistakes" ? source : "daily";
  return <ReviewSession key={`${kind}-${lessonId}`} source={kind} lessonId={lessonId} title={title} />;
}
