import { Mic, Pause, Play, Square } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useAudio } from "../audio/context";
import { usePeaks, usePlayerState } from "../audio/hooks";
import { player } from "../audio/player";
import { recorderErrorMessage, RecorderError, startRecording, type ActiveRecording } from "../audio/recorder";
import type { Take } from "../audio/recordings";
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

type RecState =
  { kind: "idle" } | { kind: "recording"; seconds: number } | { kind: "saving" } | { kind: "error"; message: string };

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
  // both belong to the current item; a different item starts clean
  const [takeOf, setTakeOf] = useState<{ id: string; take: Take | null }>({ id: "", take: null });
  const [recOf, setRecOf] = useState<{ id: string; rec: RecState }>({ id: "", rec: { kind: "idle" } });
  const take = takeOf.id === id ? takeOf.take : null;
  const rec: RecState = recOf.id === id ? recOf.rec : { kind: "idle" };
  const setTake = useCallback((t: Take | null) => setTakeOf({ id, take: t }), [id]);
  const setRec = useCallback((r: RecState) => setRecOf({ id, rec: r }), [id]);
  const minePeaks = usePeaks(take?.url, BARS);
  const active = useRef<ActiveRecording | null>(null);
  const timer = useRef<number | null>(null);

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

  // leaving the item stops playback and any recording
  useEffect(
    () => () => {
      player.stop();
      active.current?.cancel();
      active.current = null;
      if (timer.current) window.clearInterval(timer.current);
    },
    [id],
  );

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

  const stopRecording = useCallback(async () => {
    const r = active.current;
    if (!r) return;
    active.current = null;
    if (timer.current) window.clearInterval(timer.current);
    setRec({ kind: "saving" });
    try {
      const recording = await r.stop();
      const saved = await recordings.savePractice(id, recording);
      setTake(saved);
      setRec({ kind: "idle" });
      playAlternate(saved);
    } catch {
      setRec({ kind: "error", message: "录音没有保存成功，请再试一次。" });
    }
  }, [id, recordings, playAlternate, setRec, setTake]);

  const startRec = useCallback(async () => {
    player.stop();
    try {
      active.current = await startRecording();
    } catch (e) {
      setRec({ kind: "error", message: recorderErrorMessage(e instanceof RecorderError ? e.code : "unsupported") });
      return;
    }
    const started = Date.now();
    setRec({ kind: "recording", seconds: 0 });
    timer.current = window.setInterval(() => {
      const seconds = Math.floor((Date.now() - started) / 1000);
      if (seconds >= MAX_RECORD_SECONDS) void stopRecording();
      else setRec({ kind: "recording", seconds });
    }, 250);
  }, [stopRecording, setRec]);

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
