import { createContext, useContext } from "react";
import type { AudioRef } from "../content/model";
import type { RecordingStore } from "./recordings";
import type { ResolvedAudio } from "./resolve";

export interface AudioContextValue {
  resolve(ref: AudioRef | null | undefined): ResolvedAudio | null;
  /** Current speed: 1 or 0.75 (starts from the default in settings) */
  rate: number;
  setRate(rate: number): void;
  recordings: RecordingStore;
  /** Reloads recorded voices after recording mode saves or imports files. */
  refreshVoice(): Promise<void>;
}

export const AudioCtx = createContext<AudioContextValue | null>(null);

export function useAudio(): AudioContextValue {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used inside AudioProvider");
  return ctx;
}
