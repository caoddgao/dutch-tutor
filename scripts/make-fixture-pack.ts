// Builds fixtures/nn-pack/: a fake resource pack in the exact pack format (docs/03_PACK_FORMAT.md),
// with content we wrote ourselves (no Naar Nederland text) and placeholder tones instead of speech.
// Usage: npx tsx scripts/make-fixture-pack.ts && npx prettier --write fixtures   (needs ffmpeg on PATH)
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type {
  PackExercise,
  PackExerciseItem,
  PackExerciseType,
  PackKeyword,
  PackLesson,
  PackSentence,
  PackWord,
  Pos,
  SentenceFlag,
  SentenceRole,
  Trilingual,
  VerbForms,
} from "../src/content/packTypes";

const ROOT = join(import.meta.dirname, "..");
const OUT = join(ROOT, "fixtures/nn-pack");
const FENNA = "nl-NL-FennaNeural";

const t = (nl: string, zh: string, en: string): Trilingual => ({ nl, zh, en });
const ttsPath = (text: string) =>
  `audio/tts/${createHash("sha1").update(`${FENNA}|${text}`).digest("hex").slice(0, 16)}.mp3`;

/** Audio files to generate: path → seconds */
const audio = new Map<string, number>();

// ---------------------------------------------------------------- words
interface WordExtra {
  /** null: the official list lacks the word (03 §7) */
  zh_nn?: string | null;
  en_nn?: string | null;
  first?: string;
  lessons?: string[];
  flags?: string[];
  audio?: string | null;
  audio_source?: string;
  fields?: Partial<PackWord>;
}

const words: PackWord[] = [];
function word(id: string, lemma: string, pos: Pos, zh: string, en: string, extra: WordExtra = {}): PackWord {
  const w: PackWord = {
    id,
    lemma,
    pos,
    article: null,
    plural: null,
    verb_forms: null,
    separable: null,
    forms_seen: [],
    zh,
    en,
    zh_nn: extra.zh_nn === undefined ? zh : extra.zh_nn,
    en_nn: extra.en_nn === undefined ? en : extra.en_nn,
    first_lesson: extra.first ?? "NN21",
    lessons: extra.lessons ?? [extra.first ?? "NN21"],
    audio: `audio/words/${id}.mp3`,
    audio_source: `tts:${FENNA}`,
    flags: extra.flags ?? [],
    ...extra.fields,
  };
  words.push(w);
  if (extra.audio !== undefined) {
    w.audio = extra.audio;
    w.audio_source = extra.audio_source;
  } else audio.set(`audio/words/${id}.mp3`, 0.4 + lemma.length * 0.06);
  return w;
}
const noun = (
  id: string,
  lemma: string,
  article: "de" | "het",
  plural: string | null,
  zh: string,
  en: string,
  extra: WordExtra = {},
) => word(id, lemma, "zn", zh, en, { ...extra, fields: { article, plural, ...extra.fields } });
const verb = (
  id: string,
  lemma: string,
  forms: VerbForms,
  seen: string[],
  zh: string,
  en: string,
  extra: WordExtra = {},
) => word(id, lemma, "ww", zh, en, { ...extra, fields: { verb_forms: forms, forms_seen: seen, ...extra.fields } });

// NN05 keywords
const NN05 = { first: "NN05" };
noun("w_tas", "tas", "de", "tassen", "包", "bag", NN05);
noun("w_pan", "pan", "de", "pannen", "锅", "pan", NN05);
noun("w_net", "net", "het", "netten", "网", "net", NN05);
noun("w_bed", "bed", "het", "bedden", "床", "bed", NN05);
noun("w_vis", "vis", "de", "vissen", "鱼", "fish", NN05);
noun("w_pin", "pin", "de", "pinnen", "大头针；刷卡机", "pin; card terminal", NN05);
word("w_de", "de", "lidw", "（定冠词，用于 de 词）", "the", { first: "NN05", lessons: ["NN05", "NN21", "NN22"] });
word("w_het", "het", "lidw", "（定冠词，用于 het 词）；它", "the; it", { first: "NN05", lessons: ["NN05", "NN22"] });
word("w_in", "in", "vz", "在……里", "in", { first: "NN05", lessons: ["NN05", "NN22"] });
verb(
  "w_zijn",
  "zijn",
  { ik: "ben", jij: "bent", hij: "is", wij: "zijn", pp: "geweest", aux: "zijn" },
  ["is"],
  "是",
  "to be",
  { first: "NN05", lessons: ["NN05", "NN21", "NN22"] },
);

// NN21
word("w_goedemorgen", "goedemorgen", "tw", "早上好", "good morning");
noun("w_mevrouw", "mevrouw", "de", "mevrouwen", "女士，太太", "madam, Mrs");
word("w_wat", "wat", "vnw", "什么", "what");
verb(
  "w_willen",
  "willen",
  { ik: "wil", jij: "wilt", hij: "wil", wij: "willen", pp: "gewild", aux: "hebben" },
  ["wilt"],
  "想要",
  "to want",
);
word("w_u", "u", "vnw", "您", "you (polite)");
word("w_een", "een", "lidw", "一个（不定冠词）", "a, an", { lessons: ["NN21", "NN22"] });
word("w_bruin", "bruin", "bn", "棕色的", "brown");
noun("w_brood", "brood", "het", "broden", "面包", "bread");
word("w_alstublieft", "alstublieft", "tw", "请；给您", "please; here you are", { zh_nn: "请", en_nn: "please" });
word("w_anders_nog_iets", "anders nog iets", "uitdr", "还要别的吗", "anything else");
word("w_nee", "nee", "tw", "不，不是", "no");
word("w_dank_u_wel", "dank u wel", "uitdr", "非常感谢（礼貌）", "thank you very much");
word("w_dank_u", "dank u", "uitdr", "谢谢您", "thank you (polite)");
word("w_dat", "dat", "vnw", "那，那个", "that");
word("w_drie", "drie", "telw", "三", "three");
noun("w_euro", "euro", "de", "euro's", "欧元", "euro");
word("w_tot_ziens", "tot ziens", "uitdr", "再见", "goodbye");
word("w_vier", "vier", "telw", "四", "four", { audio: "audio/NN21/S10.mp3", audio_source: "nn:NN21-S10" });
word("w_vijf", "vijf", "telw", "五", "five", { audio: "audio/NN21/S11.mp3", audio_source: "nn:NN21-S11" });

// NN22
const N22 = { first: "NN22" };
word("w_dit", "dit", "vnw", "这，这个", "this", N22);
word("w_mijn", "mijn", "vnw", "我的", "my", N22);
noun("w_buurman", "buurman", "de", "buren", "（男）邻居", "neighbour (man)", N22);
word("w_karel", "Karel", "eigen", "卡雷尔（人名）", "Karel (name)", N22);
word("w_hij", "hij", "vnw", "他", "he", N22);
verb(
  "w_wonen",
  "wonen",
  { ik: "woon", jij: "woont", hij: "woont", wij: "wonen", pp: "gewoond", aux: "hebben" },
  ["woont", "woon"],
  "居住，住",
  "to live",
  { ...N22, zh_nn: "住", en_nn: "live" },
);
word("w_utrecht", "Utrecht", "eigen", "乌得勒支（城市）", "Utrecht (city)", N22);
verb(
  "w_werken",
  "werken",
  { ik: "werk", jij: "werkt", hij: "werkt", wij: "werken", pp: "gewerkt", aux: "hebben" },
  ["werkt"],
  "工作",
  "to work",
  N22,
);
word("w_bij", "bij", "vz", "在……（处）", "at", N22);
noun("w_bank", "bank", "de", "banken", "银行；沙发", "bank; sofa", N22);
word("w_elk", "elk", "vnw", "每个", "every, each", { ...N22, fields: { forms_seen: ["elke"] } });
noun("w_ochtend", "ochtend", "de", "ochtenden", "早上", "morning", N22);
verb(
  "w_fietsen",
  "fietsen",
  { ik: "fiets", jij: "fietst", hij: "fietst", wij: "fietsen", pp: "gefietst", aux: "hebben" },
  ["fietst"],
  "骑自行车",
  "to cycle",
  N22,
);
word("w_naar", "naar", "vz", "去，往", "to", N22);
word("w_zijn_vnw", "zijn", "vnw", "他的", "his", N22);
noun("w_werk", "werk", "het", null, "工作", "work", N22);
verb(
  "w_opbellen",
  "opbellen",
  { ik: "bel op", jij: "belt op", hij: "belt op", wij: "bellen op", pp: "opgebeld", aux: "hebben" },
  ["belt", "op"],
  "打电话给",
  "to call (on the phone)",
  { ...N22, fields: { separable: "op|bellen" } },
);
word("w_mij", "mij", "vnw", "我（宾格）", "me", N22);
word("w_vaak", "vaak", "bw", "经常", "often", { ...N22, en_nn: null });
word("w_aardig", "aardig", "bn", "友善的，和气的", "kind, nice", N22);
word("w_en", "en", "vw", "和", "and", N22);
word("w_grappig", "grappig", "bn", "有趣的，好笑的", "funny", {
  ...N22,
  zh_nn: null,
  en_nn: null,
  flags: ["not_in_nn_list"],
});
word("w_ik", "ik", "vnw", "我", "I", N22);
word("w_jij", "jij", "vnw", "你", "you (informal)", N22);

const wordById = new Map(words.map((w) => [w.id, w]));

// ---------------------------------------------------------------- sentences
function tokens(spec: string[][]) {
  return spec.map(([tt, id]) => {
    if (!wordById.has(id)) throw new Error(`unknown word ${id}`);
    return { t: tt, word_id: id };
  });
}

interface SentenceSpec extends Trilingual {
  role?: SentenceRole;
  speaker?: string;
  tokens?: string[][];
  duration?: number;
  align?: number;
  flags?: SentenceFlag[];
}

function lessonSentences(lessonId: string, list: SentenceSpec[]): PackSentence[] {
  let cursor = 0.6;
  return list.map((s, i) => {
    const sid = `${lessonId}-S${String(i).padStart(2, "0")}`;
    const words = s.nl.split(/\s+/).length;
    const duration = s.duration ?? Number((0.7 + words * 0.38).toFixed(2));
    const start = Number(cursor.toFixed(2));
    const end = Number((cursor + duration).toFixed(2));
    cursor = end + 0.45;
    const path = `audio/${lessonId}/S${String(i).padStart(2, "0")}.mp3`;
    audio.set(path, duration + 0.3);
    const out: PackSentence = {
      id: sid,
      role: s.role ?? "line",
      nl: s.nl,
      zh: s.zh,
      en: s.en,
      speaker: s.speaker ?? null,
      audio: path,
      start,
      end,
      duration,
      align_score: s.align ?? 0.97,
      flags: [],
    };
    if (s.role !== "title") out.tokens = tokens(s.tokens ?? []);
    out.flags = s.flags ?? [];
    return out;
  });
}

const nn21Sentences = lessonSentences("NN21", [
  { role: "title", ...t("Les 21. Bij de bakker.", "第 21 课。在面包店。", "Lesson 21. At the baker's."), align: 0.99 },
  { speaker: "A", ...t("Goedemorgen!", "早上好！", "Good morning!"), tokens: [["Goedemorgen", "w_goedemorgen"]] },
  {
    speaker: "B",
    ...t("Goedemorgen, mevrouw. Wat wilt u?", "早上好，女士。您要什么？", "Good morning, madam. What would you like?"),
    tokens: [
      ["Goedemorgen", "w_goedemorgen"],
      ["mevrouw", "w_mevrouw"],
      ["Wat", "w_wat"],
      ["wilt", "w_willen"],
      ["u", "w_u"],
    ],
  },
  {
    speaker: "A",
    ...t("Een bruin brood, alstublieft.", "请给我一个黑面包。", "A brown loaf, please."),
    tokens: [
      ["Een", "w_een"],
      ["bruin", "w_bruin"],
      ["brood", "w_brood"],
      ["alstublieft", "w_alstublieft"],
    ],
  },
  {
    speaker: "B",
    ...t("Anders nog iets?", "还要别的吗？", "Anything else?"),
    tokens: [["Anders nog iets", "w_anders_nog_iets"]],
  },
  {
    speaker: "A",
    ...t("Nee, dank u wel.", "不用了，谢谢。", "No, thank you very much."),
    tokens: [
      ["Nee", "w_nee"],
      ["dank u wel", "w_dank_u_wel"],
    ],
    align: 0.86,
    flags: ["low_align", "manual_fixed"],
  },
  {
    speaker: "B",
    ...t(
      "Dat is drie euro, mevrouw. De euro, niet de dollar!",
      "一共三欧元，女士。是欧元，不是美元！",
      "That is three euros, madam. Euros, not dollars!",
    ),
    tokens: [
      ["Dat", "w_dat"],
      ["is", "w_zijn"],
      ["drie", "w_drie"],
      ["euro", "w_euro"],
      ["mevrouw", "w_mevrouw"],
      ["De", "w_de"],
      ["euro", "w_euro"],
    ],
    duration: 5.3,
    flags: ["over_5s"],
  },
  { speaker: "A", ...t("Alstublieft.", "给您。", "Here you are."), tokens: [["Alstublieft", "w_alstublieft"]] },
  {
    speaker: "B",
    ...t("Dank u. Tot ziens!", "谢谢您。再见！", "Thank you. Goodbye!"),
    tokens: [
      ["Dank u", "w_dank_u"],
      ["Tot ziens", "w_tot_ziens"],
    ],
  },
  {
    speaker: "B",
    ...t("Tot ziens!", "再见！", "Goodbye!"),
    tokens: [["Tot ziens", "w_tot_ziens"]],
    flags: ["no_audio"],
  },
  { role: "extra", ...t("vier", "四", "four"), tokens: [["vier", "w_vier"]] },
  { role: "extra", ...t("vijf", "五", "five"), tokens: [["vijf", "w_vijf"]] },
]);
// "De euro, niet de dollar" uses "niet" and "dollar": give them entries too.
wordById.set("w_niet", word("w_niet", "niet", "bw", "不", "not", { lessons: ["NN21"] }));
wordById.set("w_dollar", noun("w_dollar", "dollar", "de", "dollars", "美元", "dollar", { flags: ["not_in_nn_list"] }));
nn21Sentences[6].tokens!.push(
  { t: "niet", word_id: "w_niet" },
  { t: "de", word_id: "w_de" },
  { t: "dollar", word_id: "w_dollar" },
);
// a sentence that is not in the recording
const noAudio = nn21Sentences[9];
audio.delete(noAudio.audio!);
noAudio.audio = null;
delete noAudio.start;
delete noAudio.end;
delete noAudio.duration;
delete noAudio.align_score;

const nn22Sentences = lessonSentences("NN22", [
  { role: "title", ...t("Les 22. Mijn buurman.", "第 22 课。我的邻居。", "Lesson 22. My neighbour.") },
  {
    ...t("Dit is mijn buurman Karel.", "这是我的邻居卡雷尔。", "This is my neighbour Karel."),
    tokens: [
      ["Dit", "w_dit"],
      ["is", "w_zijn"],
      ["mijn", "w_mijn"],
      ["buurman", "w_buurman"],
      ["Karel", "w_karel"],
    ],
  },
  {
    ...t("Hij woont in Utrecht.", "他住在乌得勒支。", "He lives in Utrecht."),
    tokens: [
      ["Hij", "w_hij"],
      ["woont", "w_wonen"],
      ["in", "w_in"],
      ["Utrecht", "w_utrecht"],
    ],
  },
  {
    ...t("Hij werkt bij een bank.", "他在一家银行工作。", "He works at a bank."),
    tokens: [
      ["Hij", "w_hij"],
      ["werkt", "w_werken"],
      ["bij", "w_bij"],
      ["een", "w_een"],
      ["bank", "w_bank"],
    ],
  },
  {
    ...t("Elke ochtend fietst hij naar zijn werk.", "他每天早上骑车去上班。", "Every morning he cycles to work."),
    tokens: [
      ["Elke", "w_elk"],
      ["ochtend", "w_ochtend"],
      ["fietst", "w_fietsen"],
      ["hij", "w_hij"],
      ["naar", "w_naar"],
      ["zijn", "w_zijn_vnw"],
      ["werk", "w_werk"],
    ],
  },
  {
    ...t("Hij belt mij vaak op.", "他经常给我打电话。", "He often calls me."),
    tokens: [
      ["Hij", "w_hij"],
      ["belt", "w_opbellen"],
      ["mij", "w_mij"],
      ["vaak", "w_vaak"],
      ["op", "w_opbellen"],
    ],
  },
  {
    ...t("Karel is aardig en grappig.", "卡雷尔人很好，也很风趣。", "Karel is kind and funny."),
    tokens: [
      ["Karel", "w_karel"],
      ["is", "w_zijn"],
      ["aardig", "w_aardig"],
      ["en", "w_en"],
      ["grappig", "w_grappig"],
    ],
  },
]);

function tts(text: string) {
  const p = ttsPath(text);
  audio.set(p, 0.6 + text.split(/\s+/).length * 0.35);
  return p;
}

const nn22Extras = [
  {
    id: "NN22-X1",
    pdf_page: 999,
    sentences: (
      [
        [
          "Ik woon in Utrecht.",
          "我住在乌得勒支。",
          "I live in Utrecht.",
          [
            ["Ik", "w_ik"],
            ["woon", "w_wonen"],
            ["in", "w_in"],
            ["Utrecht", "w_utrecht"],
          ],
        ],
        [
          "Jij woont in Utrecht.",
          "你住在乌得勒支。",
          "You live in Utrecht.",
          [
            ["Jij", "w_jij"],
            ["woont", "w_wonen"],
            ["in", "w_in"],
            ["Utrecht", "w_utrecht"],
          ],
        ],
        [
          "Woon jij in Utrecht?",
          "你住在乌得勒支吗？",
          "Do you live in Utrecht?",
          [
            ["Woon", "w_wonen"],
            ["jij", "w_jij"],
            ["in", "w_in"],
            ["Utrecht", "w_utrecht"],
          ],
        ],
      ] as [string, string, string, string[][]][]
    ).map(([nl, zh, en, toks], i) => ({
      id: `NN22-X1-${i + 1}`,
      nl,
      zh,
      en,
      audio: tts(nl),
      audio_source: `tts:${FENNA}`,
      tokens: tokens(toks),
    })),
  },
];

// ---------------------------------------------------------------- exercises
const instr = {
  tf: t("Waar of niet waar?", "对还是不对？", "True or false?"),
  circle: t("Omcirkel het goede antwoord.", "圈出正确答案。", "Circle the correct answer."),
  match: t("Wat hoort bij elkaar?", "把相配的连起来。", "Match the pairs."),
  fill: t("Vul in.", "选词填空。", "Fill in the blanks."),
  order: t("Zet in de goede volgorde.", "按正确顺序排列。", "Put in the right order."),
  oral: t("Geef antwoord.", "口头回答。", "Answer aloud."),
  listen: t("Luister en kies.", "听录音，选出正确的写法。", "Listen and choose."),
  other: t("Teken de route.", "画出路线。", "Draw the route."),
  photo: t("Kijk naar de foto.", "看照片。", "Look at the photo."),
};
interface ExMore {
  bank?: string[];
  extra?: boolean;
  skip?: boolean;
  skip_reason?: string;
}
const ex = (
  id: string,
  n: number,
  type: PackExerciseType,
  instruction: Trilingual,
  items: Omit<PackExerciseItem, "id">[],
  more: ExMore = {},
): PackExercise => ({
  id,
  nn_number: n,
  type,
  instruction,
  ...(more.bank ? { bank: more.bank } : {}),
  ...(more.extra ? { extra: true } : {}),
  items: items.map((it, i) => ({ id: `${id}-${i + 1}`, ...it })),
  skip: more.skip ?? false,
  skip_reason: more.skip_reason ?? null,
});
const TF = ["waar", "niet waar"];

const nn21Exercises = [
  ex("NN21-E1", 1, "true_false", instr.tf, [
    {
      prompt: "De vrouw wil een brood.",
      options: TF,
      answer: "waar",
      zh: "这位女士要一个面包。",
      en: "The woman wants a loaf.",
      audio: null,
    },
    {
      prompt: "Het brood kost vijf euro.",
      options: TF,
      answer: "niet waar",
      zh: "面包要五欧元。",
      en: "The bread costs five euros.",
      audio: null,
    },
  ]),
  ex("NN21-E2", 2, "choose_one", instr.circle, [
    { prompt: "Goedemorgen, ..... .", options: ["meneer", "mevrouw"], answer: "mevrouw", example: true },
    { prompt: "Wat ..... u?", options: ["wil", "wilt"], answer: "wilt", zh: "您要什么？", en: "What would you like?" },
    { prompt: "Een ..... brood.", options: ["bruin", "drie"], answer: "bruin", extra: true },
  ]),
  ex("NN21-E3", 3, "match", instr.match, [
    {
      left: ["Goedemorgen!", "Dank u wel.", "Anders nog iets?"],
      right: ["Nee, dank u.", "Goedemorgen!", "Graag gedaan."],
      pairs: [
        [0, 1],
        [1, 2],
        [2, 0],
      ],
    },
  ]),
  ex(
    "NN21-E4",
    4,
    "fill_choice",
    instr.fill,
    [
      { prompt: "..... u wel.", answer: "Dank", example: true },
      { prompt: "Wat ..... u?", answer: "wilt" },
      { prompt: "Dat ..... drie euro.", answer: "is", answer_by: "DS" },
    ],
    { bank: ["Dank", "wilt", "is"] },
  ),
  ex("NN21-E5", 5, "order", instr.order, [
    { tokens: ["Wat", "wilt", "u?"] },
    { tokens: ["Een", "bruin", "brood,", "alstublieft."] },
  ]),
  ex("NN21-E6", 6, "answer_oral", instr.oral, [
    {
      prompt: "Wat wilt u?",
      sample_answers: ["Een brood, alstublieft.", "Een bruin brood, graag."],
      zh: "您要什么？",
      en: "What would you like?",
      audio: tts("Wat wilt u?"),
    },
  ]),
  ex("NN21-E7", 7, "other", instr.other, [{ raw: "Teken de route van huis naar de bakker." }], {
    skip: true,
    skip_reason: "unsupported",
  }),
  ex(
    "NN21-E8",
    8,
    "choose_one",
    instr.photo,
    [{ prompt: "Foto 1: .....", options: ["brood", "euro"], answer: "brood" }],
    {
      skip: true,
      skip_reason: "needs_image",
    },
  ),
];

const nn22Exercises = [
  ex(
    "NN22-E1",
    1,
    "true_false",
    instr.tf,
    [
      {
        prompt: "Karel woont in Utrecht.",
        options: TF,
        answer: "waar",
        zh: "卡雷尔住在乌得勒支。",
        en: "Karel lives in Utrecht.",
      },
      {
        prompt: "Karel werkt bij een bakker.",
        options: TF,
        answer: "niet waar",
        zh: "卡雷尔在面包店工作。",
        en: "Karel works at a baker's.",
      },
    ],
    { extra: true },
  ),
  ex("NN22-E2", 2, "choose_one", instr.circle, [
    { prompt: "Hij ..... in Utrecht.", options: ["woon", "woont", "wonen"], answer: "woont", answer_by: "DS" },
    { prompt: "Karel is .....", options: ["aardig", "bank", "ochtend"], answer: "aardig" },
  ]),
  // two word banks printed in the book: the second one sits on its items (03 §4)
  ex(
    "NN22-E3",
    3,
    "fill_choice",
    instr.fill,
    [
      { prompt: "Karel ..... in Utrecht.", answer: "woont" },
      { prompt: "Hij ..... bij een bank.", answer: "werkt" },
      { prompt: "Hij belt mij ..... op.", answer: "vaak", bank: ["aardig", "vaak"] },
      { prompt: "Karel is ..... en grappig.", answer: "aardig", bank: ["aardig", "vaak"] },
    ],
    { bank: ["woont", "werkt"] },
  ),
];

const nn05Keywords: PackKeyword[] = [
  ["K01", "tas", "w_tas"],
  ["K02", "pan", "w_pan"],
  ["K03", "net", "w_net"],
  ["K04", "bed", "w_bed"],
  ["K05", "vis", "w_vis"],
  ["K06", "pin", "w_pin"],
].map(([k, nl, wid], i) => {
  const path = `audio/NN05/${k}.mp3`;
  audio.set(path, 0.9);
  const start = Number((3 + i * 2.1).toFixed(2));
  return {
    id: `NN05-${k}`,
    nl,
    word_id: wid,
    audio: k === "K06" ? null : path,
    start,
    end: Number((start + 0.8).toFixed(2)),
    align_score: 0.95,
    flags: k === "K06" ? (["no_audio"] as SentenceFlag[]) : [],
  };
});
audio.delete("audio/NN05/K06.mp3");

const nn05Sentences = lessonSentences("NN05", [
  { role: "title", ...t("Les 5. Klinkers.", "第 5 课。元音。", "Lesson 5. Vowels.") },
  {
    ...t("De vis is in het net.", "鱼在网里。", "The fish is in the net."),
    tokens: [
      ["De", "w_de"],
      ["vis", "w_vis"],
      ["is", "w_zijn"],
      ["in", "w_in"],
      ["het", "w_het"],
      ["net", "w_net"],
    ],
  },
]);

const nn05Exercises = [
  ex("NN05-E1", 1, "listen_choose", instr.listen, [
    { audio: "audio/NN05/K01.mp3", options: ["tas", "tes", "tis"], answer: "tas" },
    { audio: "audio/NN05/K03.mp3", options: ["nat", "net", "nit"], answer: "net" },
    { audio: tts("vis"), options: ["vas", "ves", "vis"], answer: "vis", example: true },
  ]),
  ex("NN05-E2", 2, "other", instr.other, [{ raw: "Schrijf de letters." }], { skip: true, skip_reason: "unsupported" }),
];

// ---------------------------------------------------------------- lessons
const firstSeenOrder = (sentences: PackSentence[], extraIds: string[] = []) => {
  const ids: string[] = [];
  for (const s of sentences) for (const tok of s.tokens ?? []) if (!ids.includes(tok.word_id)) ids.push(tok.word_id);
  for (const id of extraIds) if (!ids.includes(id)) ids.push(id);
  return ids;
};

audio.set("audio/NN21/full.mp3", nn21Sentences.filter((s) => s.end).at(-1)!.end! + 0.6);
audio.set("audio/NN22/full.mp3", nn22Sentences.at(-1)!.end! + 0.6);
audio.set("audio/NN05/full.mp3", 16);

const lessons: Record<string, PackLesson> = {
  NN05: {
    id: "NN05",
    nn_lesson: 5,
    kind: "phonics",
    title: t("Klinkers: a, e, i", "元音 a、e、i", "Vowels a, e, i"),
    pdf_pages: [30, 33],
    audio_full: "audio/NN05/full.mp3",
    sounds: [
      { grapheme: "a", keywords: ["K01", "K02"], note_zh: "" },
      { grapheme: "e", keywords: ["K03", "K04"], note_zh: "" },
      { grapheme: "i", keywords: ["K05", "K06"], note_zh: "" },
    ],
    keywords: nn05Keywords,
    sentences: nn05Sentences,
    word_ids: firstSeenOrder(nn05Sentences, ["w_tas", "w_pan", "w_bed", "w_pin"]),
    exercises: nn05Exercises,
  },
  NN21: {
    id: "NN21",
    nn_lesson: 21,
    kind: "main",
    title: t("Bij de bakker", "在面包店", "At the baker's"),
    pdf_pages: [900, 903],
    text_type: "dialogue",
    audio_full: "audio/NN21/full.mp3",
    sentences: nn21Sentences,
    word_ids: firstSeenOrder(nn21Sentences),
    exercises: nn21Exercises,
    extras: [],
    notes: "Fixture: self-written content for tests.",
  },
  NN22: {
    id: "NN22",
    nn_lesson: 22,
    kind: "main",
    title: t("Mijn buurman", "我的邻居", "My neighbour"),
    pdf_pages: [904, 906],
    text_type: "text",
    audio_full: "audio/NN22/full.mp3",
    sentences: nn22Sentences,
    word_ids: firstSeenOrder(nn22Sentences, ["w_ik", "w_jij"]),
    exercises: nn22Exercises,
    extras: nn22Extras,
    notes: "",
  },
};

// ---------------------------------------------------------------- index + manifest
const r2 = (n: number) => Number(n.toFixed(2));
const index = {
  format_version: 1,
  lessons: Object.values(lessons).map((l) => {
    const lines = l.sentences.filter((s) => s.role !== "title");
    const durations = l.sentences.map((s) => s.duration ?? 0);
    const newWords = (l.word_ids ?? []).filter((id) => wordById.get(id)!.first_lesson === l.id);
    return {
      id: l.id,
      kind: l.kind,
      title: l.title,
      sentence_count: lines.length,
      new_word_count: newWords.length,
      total_seconds: r2(durations.reduce((a, b) => a + b, 0)),
      max_sentence_seconds: r2(Math.max(0, ...durations)),
      over_5s_count: l.sentences.filter((s) => s.flags.includes("over_5s")).length,
      exercise_count: l.exercises.length,
      skipped_exercises: l.exercises.filter((e) => e.skip).length,
      new_lemmas: newWords.map((id) => wordById.get(id)!.lemma),
    };
  }),
};

const manifest = {
  format_version: 1,
  source: "Dutch Tutor test fixture (self-written content, placeholder audio)",
  created_at: "2026-10-09T12:00:00+02:00",
  producer: "fixture",
  lessons: Object.keys(lessons),
  counts: {
    lessons: Object.keys(lessons).length,
    sentences: Object.values(lessons).reduce((n, l) => n + l.sentences.length, 0),
    words: words.length,
    exercises: Object.values(lessons).reduce((n, l) => n + l.exercises.length, 0),
    audio_files: audio.size,
  },
  tts_voices: { default: FENNA, male: "nl-NL-MaartenNeural" },
};

// ---------------------------------------------------------------- write
rmSync(OUT, { recursive: true, force: true });
const write = (rel: string, data: unknown) => {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  writeFileSync(p, JSON.stringify(data, null, 2) + "\n");
};
write("manifest.json", manifest);
write("index.json", index);
write("words.json", words);
for (const l of Object.values(lessons)) write(`lessons/${l.id}.json`, l);
write("qa/qa_report.md", "# QA\n\nFixture pack, no alignment data.\n");

let n = 0;
for (const [rel, seconds] of [...audio].sort()) {
  const p = join(OUT, rel);
  mkdirSync(dirname(p), { recursive: true });
  const seed = parseInt(createHash("md5").update(rel).digest("hex").slice(0, 4), 16);
  const freq = 180 + (seed % 220);
  const wobble = 2 + (seed % 5);
  execFileSync(
    "ffmpeg",
    [
      "-loglevel",
      "error",
      "-y",
      "-f",
      "lavfi",
      "-i",
      `sine=frequency=${freq}:sample_rate=44100:duration=${seconds.toFixed(2)}`,
      "-af",
      `volume='0.15+0.7*abs(sin(PI*${wobble}*t))':eval=frame,afade=t=in:d=0.01,afade=t=out:st=${Math.max(0, seconds - 0.01).toFixed(2)}:d=0.01`,
      "-ac",
      "1",
      "-ar",
      "44100",
      "-b:a",
      "32k",
      p,
    ],
    { stdio: "inherit" },
  );
  n += 1;
}
console.log(`fixtures/nn-pack: ${Object.keys(lessons).length} lessons, ${words.length} words, ${n} audio files`);
