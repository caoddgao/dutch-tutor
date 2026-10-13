import { Repeat2 } from "lucide-react";
import { Link } from "react-router";
import { STATUS_LABEL, type DisplayStatus, type LessonSummary } from "../course/types";
import { ProgressBar } from "./ProgressBar";
import "./LessonCard.css";

export function LessonCard({
  lesson,
  status,
  score,
}: {
  lesson: LessonSummary;
  status: DisplayStatus;
  score?: { correct: number; total: number };
}) {
  const pct = Math.round(lesson.progress * 100);
  const reviewable = lesson.status !== "new";
  return (
    <article className={`lesson-card${status === "recommended" ? " is-recommended" : ""}`} data-status={status}>
      <Link to={`/lesson/${lesson.id}`} className="lesson-card-link" aria-label={`${lesson.code} ${lesson.title.nl}`}>
        <div className="lesson-card-top">
          <span className="lesson-code">{lesson.code}</span>
          <span className={`tag tag-${status}`}>{STATUS_LABEL[status]}</span>
        </div>
        <div className="lesson-card-body">
          <h3 className="nl lesson-title">{lesson.title.nl}</h3>
          <p className="zh lesson-zh">{lesson.title.zh}</p>
          <p className="en lesson-en">{lesson.title.en}</p>
        </div>
        {lesson.kind === "test" && score && (
          <p className="muted">
            上次得分 {score.correct} / {score.total} · 可重做
          </p>
        )}
        {lesson.kind !== "test" && (
          <div className={`lesson-card-progress${reviewable ? " has-review" : ""}`}>
            <ProgressBar value={lesson.progress} label={`${lesson.code} ${reviewable ? "掌握度" : "进度"}`} />
            <span className="lesson-pct">{pct}%</span>
          </div>
        )}
      </Link>
      {reviewable && lesson.kind !== "test" && (
        <Link to={`/review/lesson/${lesson.id}`} className="lesson-card-review" aria-label={`复习${lesson.code}`}>
          <Repeat2 size={13} aria-hidden />
          复习
        </Link>
      )}
    </article>
  );
}
