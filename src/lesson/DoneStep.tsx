import { ArrowRight, PartyPopper, RotateCcw } from "lucide-react";
import { Link } from "react-router";
import type { RtLesson } from "../content/model";

interface Props {
  lesson: RtLesson;
  added: number | null;
  score?: { correct: number; total: number } | null;
  onRestart: () => void;
}

/** Step ⑥: summary; the lesson's sentences and words have entered the review queue. */
export function DoneStep({ lesson, added, score, onRestart }: Props) {
  return (
    <div className="done-step">
      <div className="done-icon">
        <PartyPopper size={34} aria-hidden />
      </div>
      <h2 className="done-title">{lesson.code} 学完了！</h2>
      <ul className="done-stats">
        <li>
          <strong>{lesson.sentences.length}</strong>
          <span>句子</span>
        </li>
        <li>
          <strong>{lesson.newWordIds.length}</strong>
          <span>新词</span>
        </li>
        {score && score.total > 0 && (
          <li>
            <strong>
              {score.correct}/{score.total}
            </strong>
            <span>练习答对</span>
          </li>
        )}
      </ul>
      <p className="muted done-text">
        {added === null
          ? "正在加入复习…"
          : added > 0
            ? `本课的 ${added} 个句子和词已进入复习，明天开始出现在“今日复习”里。`
            : "本课的句子和词已经在复习里了，会按原来的安排出现。"}
      </p>
      <div className="done-actions">
        <Link to="/courses" className="btn btn-primary">
          返回课程地图
          <ArrowRight size={16} aria-hidden />
        </Link>
        <button type="button" className="btn btn-ghost" onClick={onRestart}>
          <RotateCcw size={16} aria-hidden />
          再学一遍
        </button>
      </div>
    </div>
  );
}
