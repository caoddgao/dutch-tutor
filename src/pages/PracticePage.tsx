import { ChevronLeft, ChevronRight, Mic, PackageOpen, Pause, Play, Shuffle, Square, Star } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router";
import { useAudio } from "../audio/context";
import { usePeaks, usePlayerState } from "../audio/hooks";
import { player } from "../audio/player";
import type { Take, TakeAssessment } from "../audio/recordings";
import { useShadowRecorder } from "../audio/useShadowRecorder";
import { EmptyState } from "../components/EmptyState";
import { Waveform } from "../components/Waveform";
import { formatRecent } from "../format";
import type { PracticeSentence } from "../practice/data";
import { usePracticeData, type PracticeData } from "../practice/usePracticeData";
import { azureErrorMessage, useAzure } from "../pronunciation/context";
import { ScorePanel } from "../pronunciation/ScorePanel";
import "../components/PlayerBar.css";
import "../pronunciation/score.css";
import "./PracticePage.css";

const ALL = "all";
const BARS = 64;
/** Longest take, as when shadowing in the lesson; recording stops by itself after this. */
const MAX_RECORD_SECONDS = 15;

/** Free shadowing of any studied sentence (design §7, decisions 29, 30). */
export function PracticePage() {
  const data = usePracticeData();
  if (!data) return <p className="muted">正在打开…</p>;
  if (!data.lessons.length) {
    if (data.missing)
      return (
        <EmptyState
          icon={PackageOpen}
          title="需要资料包"
          action={
            <Link to="/settings" className="btn btn-primary">
              去导入资料包
            </Link>
          }
        >
          学过的课在 Naar Nederland 资料包里。导入资料包之后，这些课的句子就能拿来练习。
        </EmptyState>
      );
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
  return <Practice data={data} />;
}

function Practice({ data }: { data: PracticeData }) {
  const { status: azure } = useAzure();
  const scoring = !!azure?.enabled;
  const studied = useMemo(() => data.lessons.flatMap((l) => l.sentences), [data]);
  const labels = useMemo(() => new Map(data.lessons.map((l) => [l.id, l.label])), [data]);
  // start on the lesson studied most recently; the list can be widened to all studied lessons
  const [lessonId, setLessonId] = useState(data.latest ?? ALL);
  const [hardOnly, setHardOnly] = useState(false);
  const [hard, setHard] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState("");

  const shown = useMemo(
    () => studied.filter((s) => (lessonId === ALL || s.lessonId === lessonId) && (!hardOnly || hard.has(s.id))),
    [studied, lessonId, hardOnly, hard],
  );
  const current = shown.find((s) => s.id === selectedId) ?? shown[0];
  const groups = groupByLesson(shown);
  const labelOf = (id: string) => labels.get(id) ?? id;
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
    else if (top + head + row.offsetHeight > list.scrollTop + list.clientHeight)
      list.scrollTop = top + head + row.offsetHeight - list.clientHeight;
  }, [current?.id]);

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
            {data.lessons.map((l) => (
              <option key={l.id} value={l.id}>
                {l.label}
              </option>
            ))}
          </select>
        </label>
        {data.missing > 0 && (
          <p className="practice-list-note">
            另有 {data.missing} 课学过、但需要资料包才能练。<Link to="/settings">去导入</Link>
          </p>
        )}
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

/** The bytes of an earlier take, for scoring it. */
async function takeAudio(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error("audio");
  return response.blob();
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
  sentence: PracticeSentence;
  index: number;
  total: number;
  lessonLabel: string;
  isHard: boolean;
  onToggleHard: () => void;
  scoring: boolean;
  onMove: (step: number) => void;
}

type ScoreState = { kind: "idle" } | { kind: "scoring" } | { kind: "error"; message: string };

/**
 * One sentence: listen (normal / slow), record, compare with the original. Takes are the same as when
 * shadowing in the lesson (newest three per audio ID); practising here is not a review and does not
 * change mastery. With pronunciation scoring on, each new take is scored against the sentence (the usual
 * rate limit and monthly usage apply) and the score is kept with the take.
 */
function PracticeCard({ sentence, index, total, lessonLabel, isHard, onToggleHard, scoring, onMove }: CardProps) {
  const { resolve, rate, setRate, recordings } = useAudio();
  const { assess } = useAzure();
  const state = usePlayerState();
  const resolved = resolve(sentence.audio);
  const id = sentence.audio.id;
  const origTag = `bar:${id}`;
  const mineTag = `mine:${id}`;
  const origPeaks = usePeaks(resolved?.url, BARS);
  const [takes, setTakes] = useState<Take[]>([]);
  const latest = takes[0];
  const minePeaks = usePeaks(latest?.url, BARS);
  const [score, setScore] = useState<ScoreState>({ kind: "idle" });
  // the take recorded on this visit (its score is "刚才这次的评分")
  const [freshId, setFreshId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    recordings
      .takes(id)
      .then((t) => !cancelled && setTakes(t))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, recordings]);

  // leaving the sentence stops playback (and any recording, see useShadowRecorder)
  useEffect(() => () => player.stop(), []);

  const playOriginal = () => {
    if (resolved) void player.play(resolved.url, { rate, tag: origTag });
  };
  const playTake = (t: Take | undefined = latest) => {
    if (t) void player.play(t.url, { tag: `${mineTag}:${t.id}` });
  };
  const playAlternate = (t: Take | undefined = latest) => {
    if (!resolved || !t) return;
    void player.playSequence([
      { url: resolved.url, opts: { rate, tag: origTag } },
      { url: t.url, opts: { tag: `${mineTag}:${t.id}` } },
    ]);
  };

  const scoreTake = async (take: Take, blob?: Blob) => {
    setScore({ kind: "scoring" });
    try {
      const audio = blob ?? (await takeAudio(take.url));
      const { total, accuracy, fluency, completeness, low_words } = await assess(audio, sentence.nl);
      const result: TakeAssessment = { total, accuracy, fluency, completeness, low_words };
      // the score is shown even if it cannot be kept
      await recordings.saveAssessment(take.id, result).catch(() => undefined);
      setTakes((old) => old.map((t) => (t.id === take.id ? { ...t, assessment: result } : t)));
      setScore({ kind: "idle" });
    } catch (error) {
      setScore({ kind: "error", message: azureErrorMessage(error) });
    }
  };

  const { rec, start, stop } = useShadowRecorder(id, MAX_RECORD_SECONDS, async (recording) => {
    await recordings.savePractice(id, recording);
    const next = await recordings.takes(id);
    setTakes(next);
    setFreshId(next[0]?.id ?? null);
    setScore({ kind: "idle" });
    if (resolved) playAlternate(next[0]);
    else playTake(next[0]);
    if (scoring && next[0]) void scoreTake(next[0], recording.blob);
  });

  const playingTag = state.playing ? state.tag : null;
  const origPlaying = playingTag === origTag;
  const recording = rec.kind === "recording";
  const progressOf = (tag: string) => (playingTag === tag ? state.progress : 0);

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
        <button
          type="button"
          className="play-button"
          disabled={!resolved || recording}
          aria-label={origPlaying ? "暂停" : "播放原声"}
          onClick={() => (origPlaying ? player.stop() : playOriginal())}
        >
          {origPlaying ? (
            <Pause size={26} fill="currentColor" strokeWidth={0} aria-hidden />
          ) : (
            <Play size={26} fill="currentColor" strokeWidth={0} aria-hidden />
          )}
        </button>
        <div className="player-waves">
          <div className="player-wave-row">
            <span className="player-wave-label">原声</span>
            <Waveform peaks={resolved ? origPeaks : null} progress={progressOf(origTag)} bars={BARS} label="原声声波" />
          </div>
          {latest && (
            <div className="player-wave-row">
              <span className="player-wave-label player-wave-label-mine">我的</span>
              <Waveform
                peaks={minePeaks}
                progress={progressOf(`${mineTag}:${latest.id}`)}
                bars={BARS}
                variant="mine"
                label="我的录音声波"
              />
            </div>
          )}
          {!resolved && <span className="player-hint">这一句暂时没有原声</span>}
          {rec.kind === "error" && (
            <span className="player-hint player-error" role="alert">
              {rec.message}
            </span>
          )}
        </div>
        <div className="practice-player-tools">
          <div className="player-compare" role="radiogroup" aria-label="播放速度">
            <button type="button" role="radio" aria-checked={rate !== 0.75} onClick={() => setRate(1)}>
              正常
            </button>
            <button type="button" role="radio" aria-checked={rate === 0.75} onClick={() => setRate(0.75)}>
              慢速 0.75×
            </button>
          </div>
          <button
            type="button"
            className={`player-pill player-record practice-record${recording ? " is-recording" : ""}`}
            disabled={rec.kind === "saving"}
            aria-label={recording ? "停止录音" : undefined}
            onClick={() => (recording ? void stop() : void start())}
          >
            {recording ? <Square size={14} fill="currentColor" aria-hidden /> : <Mic size={16} aria-hidden />}
            {recording ? `停止 0:${String(rec.seconds).padStart(2, "0")}` : rec.kind === "saving" ? "保存中" : "录音"}
          </button>
          {latest && !recording && (
            <div className="player-compare" role="group" aria-label="对比播放">
              <button type="button" onClick={playOriginal} disabled={!resolved}>
                原声
              </button>
              <button type="button" onClick={() => playTake()}>
                我的
              </button>
              <button type="button" onClick={() => playAlternate()} disabled={!resolved}>
                交替
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`practice-lower${scoring && latest ? "" : " is-single"}`}>
        {scoring && latest && (
          <section className="practice-score" aria-live="polite">
            <h3>{latest.id === freshId ? "刚才这次的评分" : "最近一次的评分"}</h3>
            {score.kind === "scoring" ? (
              <p className="muted">评分中…</p>
            ) : latest.assessment ? (
              <ScorePanel result={{ ...latest.assessment, month_seconds: 0 }} />
            ) : (
              <>
                {score.kind === "error" ? (
                  <p className="notice notice-error" role="alert">
                    {score.message}
                  </p>
                ) : (
                  <p className="muted">这次录音还没有评分。</p>
                )}
                <button
                  type="button"
                  className="btn btn-primary btn-small"
                  disabled={recording || rec.kind === "saving"}
                  onClick={() => void scoreTake(latest)}
                >
                  {score.kind === "error" ? "再评一次" : "给这次录音评分"}
                </button>
              </>
            )}
          </section>
        )}
        <section className="practice-takes">
          <h3>最近 3 次录音</h3>
          {takes.length ? (
            <ul>
              {takes.map((take, i) => {
                const playing = playingTag === `${mineTag}:${take.id}`;
                return (
                  <li key={take.id}>
                    <button
                      type="button"
                      className="audio-btn audio-btn-sm"
                      aria-label={playing ? "暂停" : `播放第 ${i + 1} 次录音`}
                      onClick={() => (playing ? player.stop() : playTake(take))}
                    >
                      {playing ? (
                        <Pause size={14} fill="currentColor" strokeWidth={0} aria-hidden />
                      ) : (
                        <Play size={14} fill="currentColor" strokeWidth={0} aria-hidden />
                      )}
                    </button>
                    <span className="practice-take-when">{formatRecent(take.createdAt)}</span>
                    <span className="practice-take-len">{take.duration.toFixed(1)} 秒</span>
                    {scoring && take.assessment && (
                      <span className="practice-take-score">{Math.round(take.assessment.total)} 分</span>
                    )}
                  </li>
                );
              })}
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
