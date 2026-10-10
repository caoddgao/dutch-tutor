import { Eye, EyeOff, Headphones } from "lucide-react";
import { useState } from "react";
import { usePlayerState } from "../audio/hooks";
import type { RtLesson } from "../content/model";

/**
 * Step ①: the whole original recording (a split lesson: its part of it); text hidden by default, can be
 * shown, Chinese optional.
 */
export function ListenStep({ lesson }: { lesson: RtLesson }) {
  const [showText, setShowText] = useState(false);
  const [showZh, setShowZh] = useState(false);
  const state = usePlayerState();
  const playingFull = state.tag === `bar:${lesson.fullAudio?.id}` && state.playing;
  // split lessons play only their stretch of the recording; progress is relative to it
  const seg = lesson.fullSegment;
  const t = !playingFull
    ? -1
    : seg
      ? seg.start + state.progress * (seg.end - seg.start)
      : state.progress * state.duration;
  const total = seg ? seg.end - seg.start : lesson.fullSentences.reduce((max, s) => Math.max(max, s.end ?? 0), 0);

  return (
    <div className="listen-step">
      <div className="listen-intro">
        <span className="stat-icon stat-icon-accent">
          <Headphones size={20} aria-hidden />
        </span>
        <div>
          <h2 className="listen-title">先完整听一两遍</h2>
          <p className="muted">
            {lesson.textType === "text" ? "一段短文" : lesson.textType === "mixed" ? "对话和短文" : "一段对话"}
            {lesson.part && ` · 第 ${lesson.part.n} 部分（共 ${lesson.part.of} 部分）`}
            {total > 0 && ` · 约 ${Math.max(1, Math.round(total))} 秒`}，先别看文字，听听能听出哪些词。
          </p>
        </div>
      </div>
      <div className="listen-toggles">
        <button
          type="button"
          className="btn btn-ghost btn-small"
          aria-pressed={showText}
          onClick={() => setShowText(!showText)}
        >
          {showText ? <EyeOff size={14} aria-hidden /> : <Eye size={14} aria-hidden />}
          {showText ? "隐藏原文" : "显示原文"}
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          aria-pressed={showZh}
          disabled={!showText}
          onClick={() => setShowZh(!showZh)}
        >
          {showZh ? "隐藏中文" : "显示中文"}
        </button>
      </div>
      <ol className={`transcript${showText ? "" : " is-hidden"}`} aria-label="原文">
        {lesson.fullSentences.map((s) => {
          const active = t >= 0 && s.start !== undefined && s.end !== undefined && t >= s.start && t < s.end + 0.3;
          return (
            <li key={s.id} className={`${active ? "is-active" : ""} ${s.kind === "title" ? "is-title" : ""}`}>
              {s.speaker && <span className="speaker-chip">{s.speaker}</span>}
              <div>
                <p className="nl" lang="nl">
                  {showText ? s.nl : s.nl.replace(/\p{L}/gu, "•")}
                </p>
                {showText && showZh && <p className="zh transcript-zh">{s.zh}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
