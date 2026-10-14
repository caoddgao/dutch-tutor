import { ChevronLeft, ChevronRight, Mic, Play, Shuffle, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";
import { EmptyState } from "../components/EmptyState";
import { Waveform } from "../components/Waveform";
import { ScorePanel } from "../pronunciation/ScorePanel";
import {
  SAMPLE_HARD,
  SAMPLE_LATEST,
  SAMPLE_LESSONS,
  SAMPLE_SENTENCES,
  sampleAssessment,
  samplePeaks,
  sampleTakes,
  type SampleSentence,
} from "./practiceSample";
import "../components/PlayerBar.css";
import "../pronunciation/score.css";
import "./PracticePage.css";

const ALL = "all";
const BARS = 64;

/**
 * Free shadowing of any studied sentence (design §7, decision 29). Static version with sample data:
 * `?sample=none` shows a learner who has not studied any lesson, `?sample=no-hard` one without hard
 * sentences, `?score=off` the page with pronunciation scoring switched off.
 */
export function PracticePage() {
  const [params] = useSearchParams();
  const sample = params.get("sample");
  const studied = useMemo(() => (sample === "none" ? [] : SAMPLE_SENTENCES), [sample]);
  const scoring = params.get("score") !== "off";
  // start on the lesson studied most recently; the list can be widened to all studied lessons
  const [lessonId, setLessonId] = useState(SAMPLE_LATEST);
  const [hardOnly, setHardOnly] = useState(sample === "no-hard");
  const [hard, setHard] = useState<Set<string>>(() => new Set(sample === "no-hard" ? [] : SAMPLE_HARD));
  const [selectedId, setSelectedId] = useState("");
  const [slow, setSlow] = useState(false);

  const shown = useMemo(
    () => studied.filter((s) => (lessonId === ALL || s.lessonId === lessonId) && (!hardOnly || hard.has(s.id))),
    [studied, lessonId, hardOnly, hard],
  );
  const current = shown.find((s) => s.id === selectedId) ?? shown[0];
  const lessons = SAMPLE_LESSONS.filter((l) => studied.some((s) => s.lessonId === l.id));
  const groups = groupByLesson(shown);
  const labelOf = (id: string) => SAMPLE_LESSONS.find((l) => l.id === id)?.label ?? id;
  const listRef = useRef<HTMLUListElement>(null);

  // keep the selected sentence visible in the list (e.g. after "随机来一句")
  useEffect(() => {
    const list = listRef.current;
    const row = list?.querySelector<HTMLElement>(".is-selected");
    if (!list || !row) return;
    // the sticky lesson heading covers the top of the list
    const head = row.closest(".practice-group")?.querySelector<HTMLElement>(".practice-group-head")?.offsetHeight ?? 0;
    const top = row.offsetTop - head;
    if (top < list.scrollTop) list.scrollTop = top;
    else if (top + row.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = top + row.offsetHeight - list.clientHeight;
  }, [current?.id]);

  if (!studied.length) {
    return (
      <EmptyState
        icon={Mic}
        title="还没有学过的课"
        action={
          <Link to="/courses" className="btn btn-primary">
            去上第一课
          </Link>
        }
      >
        学过一课以后，这一课的句子就会出现在这里，可以随时回来反复跟读。
      </EmptyState>
    );
  }

  const toggleHard = (id: string) =>
    setHard((old) => {
      const next = new Set(old);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const pickRandom = () => {
    const pool = shown.length > 1 ? shown.filter((s) => s.id !== current?.id) : shown;
    const next = pool[Math.floor(Math.random() * pool.length)];
    if (next) setSelectedId(next.id);
  };

  return (
    <div className="practice-page">
      <aside className="card practice-list" aria-label="句子列表">
        <div className="practice-list-head">
          <h2 className="section-title">已学的句子</h2>
          <span className="muted">{shown.length} 句</span>
        </div>
        <label className="practice-lesson-select">
          <span>课程</span>
          <select value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
            <option value={ALL}>全部已学的课</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        <div className="practice-list-tools">
          <label className="practice-hard-toggle">
            <button
              type="button"
              className="switch"
              role="switch"
              aria-checked={hardOnly}
              aria-label="只看我的难句"
              onClick={() => setHardOnly(!hardOnly)}
            />
            <span>只看我的难句</span>
            <span className="practice-hard-count">{hard.size}</span>
          </label>
          <button type="button" className="btn btn-accent btn-small" onClick={pickRandom} disabled={!shown.length}>
            <Shuffle size={15} aria-hidden />
            随机来一句
          </button>
        </div>
        {shown.length ? (
          <ul className="practice-rows" ref={listRef} aria-label="句子">
            {groups.map((g) => (
              <li key={g.lessonId} className="practice-group">
                <h3 className="practice-group-head">{labelOf(g.lessonId)}</h3>
                <ul aria-label={labelOf(g.lessonId)}>
                  {g.sentences.map((s) => (
                    <li key={s.id}>
                      <button
                        type="button"
                        className={`practice-row${s.id === current?.id ? " is-selected" : ""}`}
                        aria-current={s.id === current?.id ? "true" : undefined}
                        onClick={() => setSelectedId(s.id)}
                      >
                        <span className="practice-row-text">
                          <span className="nl practice-row-nl" lang="nl">
                            {s.nl}
                          </span>
                          <span className="zh practice-row-zh">{s.zh}</span>
                        </span>
                        {hard.has(s.id) && <Star size={14} className="practice-row-star" aria-label="难句" />}
                      </button>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <p className="practice-list-empty">{hard.size ? "这一课还没有难句。" : "还没有收藏的难句。"}</p>
        )}
      </aside>

      {current ? (
        <PracticeCard
          key={current.id}
          sentence={current}
          index={shown.indexOf(current)}
          total={shown.length}
          lessonLabel={labelOf(current.lessonId)}
          isHard={hard.has(current.id)}
          onToggleHard={() => toggleHard(current.id)}
          scoring={scoring}
          slow={slow}
          onSlow={setSlow}
          onMove={(step) => {
            const next = shown[shown.indexOf(current) + step];
            if (next) setSelectedId(next.id);
          }}
        />
      ) : (
        <EmptyState
          icon={Star}
          title={hard.size ? "这一课还没有难句" : "还没有难句"}
          action={
            <button type="button" className="btn btn-primary" onClick={() => setHardOnly(false)}>
              看全部句子
            </button>
          }
        >
          练习时点句子右上角的星标，把读着别扭的句子收进来，以后可以只练这些。
        </EmptyState>
      )}
    </div>
  );
}

/** Consecutive sentences of the same lesson, in list order. */
function groupByLesson<T extends { lessonId: string }>(items: T[]): { lessonId: string; sentences: T[] }[] {
  const groups: { lessonId: string; sentences: T[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last?.lessonId === item.lessonId) last.sentences.push(item);
    else groups.push({ lessonId: item.lessonId, sentences: [item] });
  }
  return groups;
}

interface CardProps {
  sentence: SampleSentence;
  index: number;
  total: number;
  lessonLabel: string;
  isHard: boolean;
  onToggleHard: () => void;
  scoring: boolean;
  slow: boolean;
  onSlow: (slow: boolean) => void;
  onMove: (step: number) => void;
}

function PracticeCard({
  sentence,
  index,
  total,
  lessonLabel,
  isHard,
  onToggleHard,
  scoring,
  slow,
  onSlow,
  onMove,
}: CardProps) {
  const takes = sampleTakes(sentence);
  const latest = takes[0];
  const seed = sentence.nl.length;
  return (
    <section className="card practice-card" aria-label="练习卡">
      <div className="practice-card-top">
        <span className="practice-lesson-chip">{lessonLabel}</span>
        <span className="practice-count">
          第 {index + 1} / {total} 句
        </span>
        <button
          type="button"
          className={`practice-star${isHard ? " is-on" : ""}`}
          aria-pressed={isHard}
          onClick={onToggleHard}
        >
          <Star size={16} aria-hidden />
          {isHard ? "已收进难句" : "收进难句"}
        </button>
      </div>

      <div className="practice-sentence">
        <p className="nl nl-sentence practice-nl" lang="nl">
          {sentence.nl}
        </p>
        <p className="zh practice-zh">{sentence.zh}</p>
        <p className="en practice-en">{sentence.en}</p>
      </div>

      <div className="immersive practice-player" aria-label="播放与录音">
        <button type="button" className="play-button" aria-label="播放原声">
          <Play size={26} fill="currentColor" strokeWidth={0} aria-hidden />
        </button>
        <div className="player-waves">
          <div className="player-wave-row">
            <span className="player-wave-label">原声</span>
            <Waveform peaks={samplePeaks(seed, BARS, 0.82)} progress={0} bars={BARS} label="原声声波" />
          </div>
          {latest && (
            <div className="player-wave-row">
              <span className="player-wave-label player-wave-label-mine">我的</span>
              <Waveform
                peaks={samplePeaks(seed + 3, BARS, 0.95)}
                progress={0}
                bars={BARS}
                variant="mine"
                label="我的录音声波"
              />
            </div>
          )}
        </div>
        <div className="practice-player-tools">
          <div className="player-compare" role="radiogroup" aria-label="播放速度">
            <button type="button" role="radio" aria-checked={!slow} onClick={() => onSlow(false)}>
              正常
            </button>
            <button type="button" role="radio" aria-checked={slow} onClick={() => onSlow(true)}>
              慢速 0.75×
            </button>
          </div>
          <button type="button" className="player-pill player-record practice-record">
            <Mic size={16} aria-hidden />
            录音
          </button>
          {latest && (
            <div className="player-compare" role="group" aria-label="对比播放">
              <button type="button">原声</button>
              <button type="button">我的</button>
              <button type="button">交替</button>
            </div>
          )}
        </div>
      </div>

      <div className={`practice-lower${scoring && latest ? "" : " is-single"}`}>
        {scoring && latest && (
          <section className="practice-score">
            <h3>刚才这次的评分</h3>
            <ScorePanel result={sampleAssessment(sentence, latest.score)} />
          </section>
        )}
        <section className="practice-takes">
          <h3>最近 3 次录音</h3>
          {takes.length ? (
            <ul>
              {takes.map((take, i) => (
                <li key={take.id}>
                  <button type="button" className="audio-btn audio-btn-sm" aria-label={`播放第 ${i + 1} 次录音`}>
                    <Play size={14} fill="currentColor" strokeWidth={0} aria-hidden />
                  </button>
                  <span className="practice-take-when">{take.when}</span>
                  <span className="practice-take-len">{take.seconds.toFixed(1)} 秒</span>
                  {scoring && <span className="practice-take-score">{take.score} 分</span>}
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">还没有录过这一句。点"录音"，读完再点一次停止。</p>
          )}
          {!scoring && (
            <p className="practice-score-off">
              在设置里开启发音评分后，每次录音都会给出准确度、流利度、完整度和总分。
              <Link to="/settings">去设置</Link>
            </p>
          )}
        </section>
      </div>

      <div className="practice-nav">
        <button type="button" className="btn btn-ghost btn-small" disabled={index <= 0} onClick={() => onMove(-1)}>
          <ChevronLeft size={16} aria-hidden />
          上一句
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          disabled={index >= total - 1}
          onClick={() => onMove(1)}
        >
          下一句
          <ChevronRight size={16} aria-hidden />
        </button>
      </div>
    </section>
  );
}
