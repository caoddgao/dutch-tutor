import { ArrowLeft, Check, ChevronRight, Ear, Repeat2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { useAudio } from "../audio/context";
import { player } from "../audio/player";
import { AudioButton } from "../components/AudioButton";
import { EmptyState } from "../components/EmptyState";
import { RecordButton } from "../exercises/RecordButton";
import { SentenceText } from "../lesson/SentenceText";
import { useServices } from "../servicesContext";
import type { ReviewResult } from "./schedule";
import type { ReviewQuestion } from "./session";
import { recordAnswer, updateMastery, type ReviewSource } from "./store";
import { useReviewSession } from "./useReviewData";
import "./review.css";

const MODE_LABEL = { R1: "看荷兰语选意思", R2: "只听不看选意思", R3: "看中文说荷兰语" } as const;

interface Props {
  source: ReviewSource;
  lessonId?: string;
  title: string;
}

export function ReviewSession({ source, lessonId, title }: Props) {
  const data = useReviewSession(source, lessonId);
  const { db } = useServices();
  const navigate = useNavigate();
  // wrong answers come back once at the end of the session
  const [again, setAgain] = useState<ReviewQuestion[]>([]);
  const queue = data ? [...data.questions, ...again] : null;
  const [index, setIndex] = useState(0);
  const [result, setResult] = useState<ReviewResult | null>(null);
  const [tally, setTally] = useState({ good: 0, total: 0 });
  const touched = useRef(new Set<string>());

  // mastery follows the new intervals once the session ends (or the page is left)
  useEffect(
    () => () => {
      const ids = [...touched.current];
      if (ids.length) void db().then((d) => updateMastery(d, ids));
      player.stop();
    },
    [db],
  );

  if (!data || !queue) return <p className="muted lesson-loading">正在准备…</p>;
  if (queue.length === 0)
    return (
      <EmptyState
        icon={Repeat2}
        title={source === "mistakes" ? "没有要集中练的错题" : "现在没有要复习的内容"}
        action={
          <Link to="/review" className="btn btn-primary">
            返回复习
          </Link>
        }
      >
        {data.missing > 0
          ? `有 ${data.missing} 项来自正课，需要先导入资料包。`
          : source === "daily"
            ? "今天到期的都复习完了，明天再来。"
            : "学完一课后，这一课的句子和词会出现在这里。"}
      </EmptyState>
    );

  const q = queue[index];
  const finished = index >= queue.length;

  const answer = async (r: ReviewResult) => {
    if (result) return;
    setResult(r);
    if (!q.repeat) setTally((t) => ({ good: t.good + (r === "good" ? 1 : 0), total: t.total + 1 }));
    touched.current.add(q.card.item.lesson_id);
    const d = await db();
    await recordAnswer(d, q.card.item, r, q.mode, source, { repeat: q.repeat });
    // wrong: the item comes back once more at the end of this session (design §4.3)
    if (r === "bad" && !q.repeat) setAgain((list) => [...list, { ...q, key: `${q.key}-again`, repeat: true }]);
  };

  const next = () => {
    player.stop();
    setResult(null);
    setIndex(index + 1);
  };

  if (finished)
    return (
      <section className="card review-done">
        <h2 className="done-title">{title}完成</h2>
        <ul className="done-stats">
          <li>
            <strong>{tally.total}</strong>
            <span>复习了</span>
          </li>
          <li>
            <strong>{tally.good}</strong>
            <span>会</span>
          </li>
        </ul>
        <p className="muted">每一项会按这次的结果安排下次出现的日子。</p>
        <div className="done-actions">
          <button type="button" className="btn btn-primary" onClick={() => navigate("/review")}>
            返回复习
          </button>
        </div>
      </section>
    );

  return (
    <div className="review-session">
      <div className="review-head">
        <Link to="/review" className="btn btn-ghost btn-small">
          <ArrowLeft size={16} aria-hidden />
          {title}
        </Link>
        <span className="tag tag-studied">
          {q.mode} · {MODE_LABEL[q.mode]}
        </span>
        {q.repeat && <span className="tag tag-recommended">再来一次</span>}
        <span className="sentence-count review-count">
          {index + 1} / {queue.length}
        </span>
      </div>
      <div className="progress review-progress" aria-hidden>
        <span style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>
      <section className="card review-card-main">
        <QuestionBody key={q.key} q={q} result={result} onAnswer={answer} />
        <div className="ex-footer">
          {result && (
            <p
              className={`ex-feedback ${result === "good" ? "is-right" : result === "bad" ? "is-wrong" : ""}`}
              role="status"
            >
              {result === "good"
                ? "会了！"
                : result === "fuzzy"
                  ? "间隔先不升级，过几天再看。"
                  : "没关系，等会儿再来一次。"}
            </p>
          )}
          <button type="button" className="btn btn-accent" disabled={!result} onClick={next}>
            下一个
            <ChevronRight size={16} aria-hidden />
          </button>
        </div>
      </section>
    </div>
  );
}

function Reveal({ q, meaning = true }: { q: ReviewQuestion; meaning?: boolean }) {
  return (
    <div className="review-reveal">
      <div className="review-reveal-nl">
        <AudioButton audio={q.card.audio} label="播放原声" />
        <SentenceText text={q.card.nl} tokens={[]} className="review-nl" />
      </div>
      {meaning && <p className="zh">{q.card.zh}</p>}
      {meaning && <p className="en">{q.card.en}</p>}
    </div>
  );
}

function QuestionBody({
  q,
  result,
  onAnswer,
}: {
  q: ReviewQuestion;
  result: ReviewResult | null;
  onAnswer: (r: ReviewResult) => void;
}) {
  const { resolve, rate } = useAudio();
  const [picked, setPicked] = useState<number | null>(null);
  const [heard, setHeard] = useState(false);
  const url = resolve(q.card.audio)?.url;

  // R2 starts by playing; answering plays the original as feedback
  useEffect(() => {
    if (q.mode === "R2" && url) void player.play(url, { rate, tag: `rev:${q.key}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.key]);
  useEffect(() => {
    if (result && q.mode === "R1" && url) void player.play(url, { rate, tag: `rev:${q.key}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  if (q.mode === "R3") {
    return (
      <div className="review-body">
        <div className="review-prompt">
          <p className="zh review-zh-big">{q.card.zh}</p>
          <p className="en review-en">{q.card.en}</p>
          <p className="muted">用荷兰语说出来</p>
        </div>
        <RecordButton id={`review-${q.card.item.item_id}`} references={[q.card.nl]} canScore={heard} />
        {!heard ? (
          <button
            type="button"
            className="btn btn-ghost review-center"
            onClick={() => {
              setHeard(true);
              if (url) void player.play(url, { rate, tag: `rev:${q.key}` });
            }}
          >
            <Ear size={16} aria-hidden />
            听原声，对一对
          </button>
        ) : (
          <>
            <Reveal q={q} meaning={false} />
            {!result && (
              <div className="self-rate" role="group" aria-label="自评">
                <button type="button" className="btn btn-ghost" onClick={() => onAnswer("good")}>
                  会
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => onAnswer("fuzzy")}>
                  模糊
                </button>
                <button type="button" className="btn btn-ghost" onClick={() => onAnswer("bad")}>
                  不会
                </button>
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <div className="review-body">
      <div className="review-prompt">
        {q.mode === "R1" ? (
          <SentenceText text={q.card.nl} tokens={[]} className="review-nl" />
        ) : (
          <div className="q-listen">
            <AudioButton audio={q.card.audio} label="再听一遍" className="q-listen-btn" />
            <span className="muted">只听，不看文字</span>
          </div>
        )}
      </div>
      <div className="q-options is-meanings" role="group" aria-label="选项">
        {q.options.map((o, i) => {
          const state = result ? (i === q.answer ? "correct" : i === picked ? "wrong" : "") : "";
          return (
            <button
              key={i}
              type="button"
              className="q-option"
              data-state={state}
              disabled={!!result}
              onClick={() => {
                setPicked(i);
                onAnswer(i === q.answer ? "good" : "bad");
              }}
            >
              <span className="zh">{o.zh}</span>
              <span className="en">{o.en}</span>
              {state === "correct" && <Check size={18} className="q-mark" aria-label="正确答案" />}
              {state === "wrong" && <X size={18} className="q-mark" aria-label="你的选择" />}
            </button>
          );
        })}
      </div>
      {result && q.mode === "R2" && <Reveal q={q} />}
    </div>
  );
}
