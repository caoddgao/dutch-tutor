import { useEffect, useState, useSyncExternalStore } from "react";
import { loadPeaks } from "./peaks";
import { player, type PlayerState } from "./player";

export function usePlayerState(): PlayerState {
  return useSyncExternalStore(
    (cb) => player.subscribe(cb),
    () => player.getState(),
  );
}

/** Waveform peaks for a URL (null while loading or when it cannot be decoded). */
export function usePeaks(url: string | null | undefined, bars: number, start?: number, end?: number): number[] | null {
  const [peaks, setPeaks] = useState<{ key: string; value: number[] | null } | null>(null);
  const key = `${url}|${bars}|${start}|${end}`;
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    loadPeaks(url, bars, start, end).then((value) => {
      if (!cancelled) setPeaks({ key, value });
    });
    return () => {
      cancelled = true;
    };
  }, [url, bars, start, end, key]);
  return peaks?.key === key ? peaks.value : null;
}
