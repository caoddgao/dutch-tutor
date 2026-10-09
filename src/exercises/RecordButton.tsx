import { Mic, Play, Square } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAudio } from "../audio/context";
import { player } from "../audio/player";
import { recorderErrorMessage, RecorderError, startRecording, type ActiveRecording } from "../audio/recorder";
import type { Take } from "../audio/recordings";

const MAX_SECONDS = 20;

/** Speak-aloud answer: record, then listen to yourself (E5, E6, R3). */
export function RecordButton({ id, onRecorded }: { id: string; onRecorded?: () => void }) {
  const { recordings } = useAudio();
  const [take, setTake] = useState<Take | null>(null);
  const [state, setState] = useState<"idle" | "recording" | "saving">("idle");
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const active = useRef<ActiveRecording | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(
    () => () => {
      active.current?.cancel();
      if (timer.current) window.clearInterval(timer.current);
    },
    [],
  );

  const stop = async () => {
    const r = active.current;
    if (!r) return;
    active.current = null;
    if (timer.current) window.clearInterval(timer.current);
    setState("saving");
    try {
      const saved = await recordings.savePractice(id, await r.stop());
      setTake(saved);
      void player.play(saved.url, { tag: `mine:${id}` });
      onRecorded?.();
    } catch {
      setError("录音没有保存成功，请再试一次。");
    }
    setState("idle");
  };

  const start = async () => {
    player.stop();
    setError(null);
    try {
      active.current = await startRecording();
    } catch (e) {
      setError(recorderErrorMessage(e instanceof RecorderError ? e.code : "unsupported"));
      return;
    }
    const t0 = Date.now();
    setSeconds(0);
    setState("recording");
    timer.current = window.setInterval(() => {
      const s = Math.floor((Date.now() - t0) / 1000);
      if (s >= MAX_SECONDS) void stop();
      else setSeconds(s);
    }, 250);
  };

  return (
    <div className="record-row">
      <button
        type="button"
        className={`btn ${state === "recording" ? "btn-danger" : "btn-accent"}`}
        disabled={state === "saving"}
        onClick={() => (state === "recording" ? void stop() : void start())}
      >
        {state === "recording" ? <Square size={14} fill="currentColor" aria-hidden /> : <Mic size={16} aria-hidden />}
        {state === "recording" ? `说完了 0:${String(seconds).padStart(2, "0")}` : take ? "再说一次" : "开口回答"}
      </button>
      {take && state === "idle" && (
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => void player.play(take.url, { tag: `mine:${id}` })}
        >
          <Play size={14} aria-hidden />
          听我的
        </button>
      )}
      {error && (
        <p className="notice notice-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
