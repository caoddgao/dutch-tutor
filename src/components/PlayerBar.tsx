import { Mic, Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAudio } from "../audio/context";
import { usePeaks, usePlayerState } from "../audio/hooks";
import { player } from "../audio/player";
import type { Take } from "../audio/recordings";
import { useShadowRecorder } from "../audio/useShadowRecorder";
import type { AudioRef } from "../content/model";
import { Waveform } from "./Waveform";
import "./PlayerBar.css";

/** Longest shadowing take; recording stops by itself after this. */
const MAX_RECORD_SECONDS = 15;
const BARS = 72;

interface Props {
  audio: AudioRef | null | undefined;
  /** Play only this part of the file (seconds) */
  segment?: { start: number; end: number };
  /** Allow shadowing (record + compare); false for e.g. the full dialogue */
  canRecord?: boolean;
  /** Navigation shown at the right end (previous / next, counter) */
  nav?: ReactNode;
}

/**
 * The dark immersive player bar (design §7): glowing orange play button, waveform, 0.75× slow mode,
 * shadowing with original / mine / alternate playback and both waveforms.
 */
export function PlayerBar({ audio, segment, canRecord = true, nav }: Props) {
  const { resolve, rate, setRate, recordings } = useAudio();
  const state = usePlayerState();
  const resolved = resolve(audio);
  const id = audio?.id ?? "";
  const origTag = `bar:${id}`;
  const mineTag = `mine:${id}`;
  const origPeaks = usePeaks(resolved?.url, BARS, segment?.start, segment?.end);
  // belongs to the current item; a different item starts clean
  const [takeOf, setTakeOf] = useState<{ id: string; take: Take | null }>({ id: "", take: null });
  const take = takeOf.id === id ? takeOf.take : null;
  const setTake = useCallback((t: Take | null) => setTakeOf({ id, take: t }), [id]);
  const minePeaks = usePeaks(take?.url, BARS);

  // load the latest take of this item
  useEffect(() => {
    let cancelled = false;
    if (!id || !canRecord) return;
    recordings
      .takes(id)
      .then((t) => !cancelled && setTake(t[0] ?? null))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [id, canRecord, recordings, setTake]);

  // leaving the item stops playback (and any recording, see useShadowRecorder)
  useEffect(() => () => player.stop(), [id]);

  const playOriginal = useCallback(() => {
    if (!resolved) return;
    void player.play(resolved.url, { rate, tag: origTag, start: segment?.start, end: segment?.end });
  }, [resolved, rate, origTag, segment?.start, segment?.end]);

  const playMine = useCallback(
    (t: Take | null = take) => {
      if (t) void player.play(t.url, { tag: mineTag });
    },
    [take, mineTag],
  );

  const playAlternate = useCallback(
    (t: Take | null = take) => {
      if (!resolved || !t) return;
      void player.playSequence([
        { url: resolved.url, opts: { rate, tag: origTag, start: segment?.start, end: segment?.end } },
        { url: t.url, opts: { tag: mineTag } },
      ]);
    },
    [resolved, take, rate, origTag, mineTag, segment?.start, segment?.end],
  );

  const {
    rec,
    start: startRec,
    stop: stopRecording,
  } = useShadowRecorder(id, MAX_RECORD_SECONDS, async (recording) => {
    const saved = await recordings.savePractice(id, recording);
    setTake(saved);
    playAlternate(saved);
  });

  const origPlaying = state.playing && state.tag === origTag;
  const minePlaying = state.playing && state.tag === mineTag;
  const recording = rec.kind === "recording";

  return (
    <div className="immersive player-bar" aria-label="播放条">
      <button
        type="button"
        className="play-button player-play"
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
          {take && <span className="player-wave-label">原声</span>}
          <Waveform
            peaks={resolved ? origPeaks : null}
            progress={origPlaying ? state.progress : 0}
            bars={BARS}
            label="原声声波"
          />
        </div>
        {take && (
          <div className="player-wave-row">
            <span className="player-wave-label player-wave-label-mine">我的</span>
            <Waveform
              peaks={minePeaks}
              progress={minePlaying ? state.progress : 0}
              bars={BARS}
              variant="mine"
              label="我的录音声波"
            />
          </div>
        )}
        {!resolved && <span className="player-hint">这一句暂时没有录音</span>}
        {rec.kind === "error" && (
          <span className="player-hint player-error" role="alert">
            {rec.message}
          </span>
        )}
      </div>

      <div className="player-tools">
        <button
          type="button"
          className="player-pill"
          aria-pressed={rate === 0.75}
          title="慢速播放（音调不变）"
          onClick={() => setRate(rate === 0.75 ? 1 : 0.75)}
        >
          0.75×
        </button>
        {canRecord && (
          <button
            type="button"
            className={`player-pill player-record${recording ? " is-recording" : ""}`}
            disabled={rec.kind === "saving"}
            aria-label={recording ? "停止录音" : "跟读录音"}
            onClick={() => (recording ? void stopRecording() : void startRec())}
          >
            {recording ? <Square size={14} fill="currentColor" aria-hidden /> : <Mic size={16} aria-hidden />}
            {recording ? `停止 0:${String(rec.seconds).padStart(2, "0")}` : rec.kind === "saving" ? "保存中" : "跟读"}
          </button>
        )}
        {take && !recording && (
          <div className="player-compare" role="group" aria-label="对比播放">
            <button type="button" onClick={playOriginal} disabled={!resolved}>
              原声
            </button>
            <button type="button" onClick={() => playMine()}>
              我的
            </button>
            <button type="button" onClick={() => playAlternate()} disabled={!resolved}>
              交替
            </button>
          </div>
        )}
      </div>

      {nav && <div className="player-nav">{nav}</div>}
    </div>
  );
}
