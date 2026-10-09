// Picks the source to play for an item, in the order of design §5.1:
// 1 real-voice recording · 2 Naar Nederland original · 3 synthesized · 4 none (button greyed out).
import type { AudioRef } from "../content/model";

export type AudioSource = "voice" | "nn" | "tts";

export interface ResolvedAudio {
  url: string;
  source: AudioSource;
}

export interface AudioUrls {
  /** Real-voice recording for an audio_id (recording mode), if any */
  voiceUrl(audioId: string): string | undefined;
  packUrl(relPath: string): string;
  ttsUrl(voice: string, text: string): string | null;
}

export function resolveAudio(ref: AudioRef | null | undefined, urls: AudioUrls): ResolvedAudio | null {
  if (!ref) return null;
  const voice = urls.voiceUrl(ref.id);
  if (voice) return { url: voice, source: "voice" };
  if (ref.nn) {
    const url = urls.packUrl(ref.nn);
    if (url) return { url, source: "nn" };
  }
  if (ref.tts) {
    const url = urls.ttsUrl(ref.tts.voice, ref.tts.text);
    if (url) return { url, source: "tts" };
  }
  if (ref.packTts) {
    const url = urls.packUrl(ref.packTts);
    if (url) return { url, source: "tts" };
  }
  return null;
}
