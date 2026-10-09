import { STATUS_LABEL, type DisplayStatus, type LessonSummary } from "../course/types";
import { ProgressBar } from "./ProgressBar";
import "./LessonCard.css";

export function LessonCard({ lesson, status }: { lesson: LessonSummary; status: DisplayStatus }) {
  const pct = Math.round(lesson.progress * 100);
  return (
    <article className={`lesson-card${status === "recommended" ? " is-recommended" : ""}`} data-status={status}>
      <div className="lesson-card-top">
        <span className="lesson-code">{lesson.code}</span>
        <span className={`tag tag-${status}`}>{STATUS_LABEL[status]}</span>
      </div>
      <div className="lesson-card-body">
        <h3 className="nl lesson-title">{lesson.title.nl}</h3>
        <p className="zh lesson-zh">{lesson.title.zh}</p>
        <p className="en lesson-en">{lesson.title.en}</p>
      </div>
      <div className="lesson-card-progress">
        <ProgressBar value={lesson.progress} label={`${lesson.code} 进度`} />
        <span className="lesson-pct">{pct}%</span>
      </div>
    </article>
  );
}
