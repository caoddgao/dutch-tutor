// Sample data for the static version of the practice page (5-5a). Replaced by real lessons, takes and
// scores once the page is wired up. Sentences come from our own P lessons and the self-made fixture pack.
import type { Assessment } from "../pronunciation/context";

export interface SampleLesson {
  id: string;
  label: string;
  short: string;
}

export interface SampleSentence {
  id: string;
  lessonId: string;
  nl: string;
  zh: string;
  en: string;
}

export interface SampleTake {
  id: string;
  when: string;
  seconds: number;
  score: number;
}

export const SAMPLE_LESSONS: SampleLesson[] = [
  { id: "P01", label: "P01 · 短元音 a、e、i", short: "P01" },
  { id: "P02", label: "P02 · 长元音 aa、ee", short: "P02" },
  { id: "P03", label: "P03 · 短元音 o、u", short: "P03" },
  { id: "NN21", label: "第 21 课 · 在面包店", short: "第 21 课" },
  { id: "NN22a", label: "第 22 课 a · 我的邻居", short: "第 22 课 a" },
];

const rows: [string, string, string, string][] = [
  ["P01", "Dag, Anna!", "你好，安娜！", "Hello, Anna!"],
  ["P01", "Ik ben Sam.", "我是萨姆。", "I am Sam."],
  ["P01", "Wat is dat?", "那是什么？", "What is that?"],
  ["P01", "Dat is een kam.", "那是一把梳子。", "That is a comb."],
  ["P02", "Wat is uw naam?", "您叫什么名字？", "What is your name?"],
  ["P02", "Mijn naam is Sam.", "我的名字是萨姆。", "My name is Sam."],
  ["P02", "Twee thee, graag.", "请来两杯茶。", "Two teas, please."],
  ["P02", "Ik leer Nederlands.", "我在学荷兰语。", "I am learning Dutch."],
  ["P03", "Is dat uw tas?", "那是您的包吗？", "Is that your bag?"],
  ["P03", "Nee, dat is niet mijn tas.", "不，那不是我的包。", "No, that is not my bag."],
  ["P03", "Het is druk in de bus.", "公交车上人很多。", "It is crowded on the bus."],
  ["P03", "Pas op, een mug!", "小心，有蚊子！", "Watch out, a mosquito!"],
  [
    "NN21",
    "Goedemorgen, mevrouw. Wat wilt u?",
    "早上好，女士。您要什么？",
    "Good morning, madam. What would you like?",
  ],
  ["NN21", "Een bruin brood, alstublieft.", "请给我一个黑面包。", "A brown loaf, please."],
  ["NN21", "Anders nog iets?", "还要别的吗？", "Anything else?"],
  ["NN21", "Dank u. Tot ziens!", "谢谢您。再见！", "Thank you. Goodbye!"],
  ["NN22a", "Dit is mijn buurman Karel.", "这是我的邻居卡雷尔。", "This is my neighbour Karel."],
  ["NN22a", "Hij woont in Utrecht.", "他住在乌得勒支。", "He lives in Utrecht."],
  ["NN22a", "Elke ochtend fietst hij naar zijn werk.", "他每天早上骑车去上班。", "Every morning he cycles to work."],
  ["NN22a", "Karel is aardig en grappig.", "卡雷尔人很好，也很风趣。", "Karel is kind and funny."],
];

const counters = new Map<string, number>();
export const SAMPLE_SENTENCES: SampleSentence[] = rows.map(([lessonId, nl, zh, en]) => {
  const n = (counters.get(lessonId) ?? 0) + 1;
  counters.set(lessonId, n);
  return { id: `${lessonId}-S${String(n).padStart(2, "0")}`, lessonId, nl, zh, en };
});

/** Sentences starred as "my hard sentences" in the sample. */
export const SAMPLE_HARD = ["P03-S02", "NN21-S01", "NN21-S02", "NN22a-S03"];

const WHEN = ["刚才", "今天 09:12", "昨天 20:45"];

/** Up to three recent takes per sentence, newest first. */
export function sampleTakes(sentence: SampleSentence): SampleTake[] {
  const index = SAMPLE_SENTENCES.indexOf(sentence);
  const count = index % 4 === 3 ? 0 : 3 - (index % 3 === 2 ? 1 : 0);
  return Array.from({ length: count }, (_, i) => ({
    id: `${sentence.id}-${i}`,
    when: WHEN[i]!,
    seconds: 1.4 + ((sentence.nl.length + i * 3) % 9) / 4,
    score: 84 - i * 7 - (index % 5) * 2,
  }));
}

/** Score of the newest take; the longest word is the one to practise. */
export function sampleAssessment(sentence: SampleSentence, total: number): Assessment {
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
