import { useCallback, useEffect, useRef, useState } from "react";
import { player } from "./player";
import { recorderErrorMessage, RecorderError, startRecording, type ActiveRecording, type Recording } from "./recorder";

export type RecState =
  { kind: "idle" } | { kind: "recording"; seconds: number } | { kind: "saving" } | { kind: "error"; message: string };

const IDLE: RecState = { kind: "idle" };

/**
 * One shadowing take of the item `key` (design §5.3): start, a running clock, stop by hand or after
 * `maxSeconds`, then `onRecorded` saves it. Moving to another item cancels a running take and starts clean.
 */
export function useShadowRecorder(key: string, maxSeconds: number, onRecorded: (rec: Recording) => Promise<void>) {
  const [recOf, setRecOf] = useState<{ key: string; rec: RecState }>({ key: "", rec: IDLE });
  const rec = recOf.key === key ? recOf.rec : IDLE;
  const setRec = useCallback((r: RecState) => setRecOf({ key, rec: r }), [key]);
  const active = useRef<ActiveRecording | null>(null);
  const timer = useRef<number | null>(null);
  const save = useRef(onRecorded);
  useEffect(() => {
    save.current = onRecorded;
  });

  useEffect(
    () => () => {
      active.current?.cancel();
      active.current = null;
      if (timer.current) window.clearInterval(timer.current);
    },
    [key],
  );

  const stop = useCallback(async () => {
    const r = active.current;
    if (!r) return;
    active.current = null;
    if (timer.current) window.clearInterval(timer.current);
    setRec({ kind: "saving" });
    try {
      await save.current(await r.stop());
      setRec(IDLE);
    } catch {
      setRec({ kind: "error", message: "录音没有保存成功，请再试一次。" });
    }
  }, [setRec]);

  const start = useCallback(async () => {
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
      if (seconds >= maxSeconds) void stop();
      else setRec({ kind: "recording", seconds });
    }, 250);
  }, [stop, setRec, maxSeconds]);

  return { rec, start, stop };
}
