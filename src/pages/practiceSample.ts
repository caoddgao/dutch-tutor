// Sample takes and scores still shown on the practice card while the sentences are real (5-5a item 5).
// Removed once the card plays, records and scores for real (items 6, 7).
import type { Assessment } from "../pronunciation/context";

interface Sentence {
  nl: string;
}

export interface SampleTake {
  id: string;
  when: string;
  seconds: number;
  score: number;
}

const WHEN = ["刚才", "今天 09:12", "昨天 20:45"];

/** Up to three recent takes per sentence, newest first. */
export function sampleTakes(sentence: Sentence): SampleTake[] {
  const index = sentence.nl.length;
  const count = index % 4 === 3 ? 0 : 3 - (index % 3 === 2 ? 1 : 0);
  return Array.from({ length: count }, (_, i) => ({
    id: `${sentence.nl}-${i}`,
    when: WHEN[i]!,
    seconds: 1.4 + ((sentence.nl.length + i * 3) % 9) / 4,
    score: 84 - i * 7 - (index % 5) * 2,
  }));
}

/** Score of the newest take; the longest word is the one to practise. */
export function sampleAssessment(sentence: Sentence, total: number): Assessment {
  const words = sentence.nl.replace(/[.,!?]/g, "").split(/\s+/);
  const longest = [...words].sort((a, b) => b.length - a.length)[0] ?? "";
  return {
    total,
    accuracy: Math.min(100, total + 4),
    fluency: Math.max(0, total - 6),
    completeness: 100,
    low_words: longest.length > 4 ? [{ word: longest, accuracy: total - 22 }] : [],
    month_seconds: 0,
  };
}

/** A waveform-like shape so the static bars do not look flat. */
export function samplePeaks(seed: number, bars: number, length = 1): number[] {
  return Array.from({ length: bars }, (_, i) => {
    const t = i / bars;
    if (t > length) return 0.04;
    const envelope = Math.sin((Math.PI * t) / length) ** 0.6;
    const wobble = 0.55 + 0.45 * Math.abs(Math.sin(i * 0.9 + seed) * Math.cos(i * 0.37 + seed * 2));
    return Math.max(0.06, envelope * wobble);
  });
}
