// Runtime course model: our own content (content/a1) merged with the resource pack (design §10).
import type { ContentBundle, CourseLessonRef, OwnExercise, OwnLesson, Tip } from "./ownTypes";
import type { PackExercise, PackIndex, PackLesson, PackToken, PackWord, Pos, Trilingual, VerbForms } from "./packTypes";
import { buildFormIndex, tokenize } from "./tokenize";
import { voiceName } from "./ttsTexts";

/** One playable item and its candidate sources, in the priority order of design §5.1. */
export interface AudioRef {
  /** audio_id; real-voice recordings are stored under it (priority 1) */
  id: string;
  /** Naar Nederland original, pack-relative path (priority 2) */
  nn?: string;
  /** Our synthesized audio, found by voice + text in content/audio/tts (priority 3) */
  tts?: { voice: string; text: string };
  /** Synthesized audio shipped in the pack (priority 3) */
  packTts?: string;
}

export interface RtWord {
  id: string;
  lemma: string;
  pos: Pos;
  article: "de" | "het" | "de/het" | null;
  plural: string | null;
  verbForms: VerbForms | null;
  separable: string | null;
  zh: string;
  en: string;
  zhNn?: string;
  enNn?: string;
  firstLesson?: string;
  audio: AudioRef;
}

export interface RtSentence extends Trilingual {
  id: string;
  kind: "title" | "line" | "extra" | "added" | "example";
  speaker: string | null;
  audio: AudioRef;
  tokens: PackToken[];
  /** Position in the full recording, seconds */
  start?: number;
  end?: number;
  flags: string[];
}

export interface RtSound {
  grapheme: string;
  noteZh: string;
  noteEn?: string;
  wordIds: string[];
}

export interface RtTip {
  id: string;
  title: { zh: string; en?: string };
  bodyZh: string[];
  bodyEn?: string[];
  examples: RtSentence[];
  table?: { head: string[]; rows: string[][] };
}

export interface RtExtraBox {
  id: string;
  sentences: RtSentence[];
}

export type LessonKind = "phonics" | "main" | "test";

export interface RtPackExercise {
  /** Pack lesson the exercise comes from (for audio paths) */
  lessonId: string;
  exercise: PackExercise;
}

export interface RtLesson {
  id: string;
  kind: LessonKind;
  code: string;
  title: Trilingual;
  textType?: "dialogue" | "text" | "mixed";
  /** Step ① plays this; sentences with start/end can be highlighted */
  fullAudio?: AudioRef;
  /** Everything in the full recording, in order (title included) */
  fullSentences: RtSentence[];
  /** Step ②: one sentence per screen */
  sentences: RtSentence[];
  /** The lesson's word list, in order, with lesson-specific audio */
  words: RtWord[];
  /** Words first taught in this lesson */
  newWordIds: string[];
  sounds: RtSound[];
  tips: RtTip[];
  extras: RtExtraBox[];
  packExercises: RtPackExercise[];
  ownExercises: OwnExercise[];
  /** Past participles are shown only after tip G14 (design §6) */
  showPastParticiple: boolean;
}

export interface Dictionary {
  words: Map<string, RtWord>;
  formIndex: Map<string, string>;
}

export interface CourseLesson {
  id: string;
  section: "phonics" | "main" | "tests";
  kind: LessonKind;
  code: string;
  title: Trilingual | null;
  source: "own" | "pack";
  packId?: string;
  /** Own lessons always; pack lessons when the pack contains them */
  available: boolean;
}

export interface CourseSectionView {
  id: "phonics" | "main" | "tests";
  title: string;
  lessons: CourseLesson[];
  /** Pack lessons the installed pack does not contain (shown as one line, not as cards) */
  missing: CourseLesson[];
}

const SECTION_KIND: Record<CourseSectionView["id"], LessonKind> = { phonics: "phonics", main: "main", tests: "test" };

export function lessonCode(section: CourseSectionView["id"], id: string): string {
  const n = Number(id.replace(/^\D+/, ""));
  if (section === "main" && Number.isFinite(n)) return `第 ${n} 课`;
  if (section === "tests" && Number.isFinite(n)) return `测验 ${n}`;
  return id;
}

export function buildCourseView(bundle: ContentBundle, packIndex: PackIndex | null): CourseSectionView[] {
  const indexed = new Map((packIndex?.lessons ?? []).map((l) => [l.id, l]));
  return bundle.course.sections.map((section) => {
    const all: CourseLesson[] = section.lessons.map((ref) => {
      const own = bundle.lessons[ref.id];
      const packId = ref.source === "pack" ? (ref.pack_id ?? ref.id) : undefined;
      const packEntry = packId ? indexed.get(packId) : undefined;
      return {
        id: ref.id,
        section: section.id,
        kind: SECTION_KIND[section.id],
        code: lessonCode(section.id, ref.id),
        title: own?.title ?? packEntry?.title ?? null,
        source: ref.source,
        packId,
        available: ref.source === "own" ? !!own : !!packEntry,
      };
    });
    return {
      id: section.id,
      title: section.title,
      lessons: all.filter((l) => l.available),
      missing: all.filter((l) => !l.available),
    };
  });
}

export function findCourseRef(
  bundle: ContentBundle,
  id: string,
): { ref: CourseLessonRef; section: CourseSectionView["id"] } | null {
  for (const s of bundle.course.sections) {
    const ref = s.lessons.find((l) => l.id === id);
    if (ref) return { ref, section: s.id };
  }
  return null;
}

/** Ids in course order. */
export function courseOrder(bundle: ContentBundle): string[] {
  return bundle.course.sections.flatMap((s) => s.lessons.map((l) => l.id));
}

function packAudio(path: string | null | undefined, source?: string): Partial<AudioRef> {
  if (!path) return {};
  if (source?.startsWith("tts:") || (!source && path.startsWith("audio/tts/"))) return { packTts: path };
  return { nn: path };
}

export function buildDictionary(bundle: ContentBundle, packWords: PackWord[] = []): Dictionary {
  const voice = voiceName(bundle.tts, "default");
  const words = new Map<string, RtWord>();
  const nnByLemma = new Map<string, string>();
  for (const w of packWords) {
    if (w.audio && w.audio_source?.startsWith("nn:")) nnByLemma.set(w.lemma.toLowerCase(), w.audio);
  }
  for (const w of bundle.words) {
    words.set(w.id, {
      id: w.id,
      lemma: w.lemma,
      pos: w.pos,
      article: w.article ?? null,
      plural: w.plural ?? null,
      verbForms: w.verb_forms ?? null,
      separable: w.separable ?? null,
      zh: w.zh,
      en: w.en,
      audio: { id: w.id, nn: nnByLemma.get(w.lemma.toLowerCase()), tts: { voice, text: w.lemma } },
    });
  }
  for (const w of packWords) {
    const own = words.get(w.id);
    words.set(w.id, {
      id: w.id,
      lemma: w.lemma,
      pos: w.pos,
      article: w.article,
      plural: w.plural,
      verbForms: w.verb_forms,
      separable: w.separable,
      zh: w.zh,
      en: w.en,
      zhNn: w.zh_nn ?? undefined,
      enNn: w.en_nn ?? undefined,
      firstLesson: w.first_lesson,
      audio: { id: w.id, ...packAudio(w.audio, w.audio_source), tts: own?.audio.tts },
    });
  }
  const formIndex = buildFormIndex([...bundle.words, ...packWords.map((w) => ({ ...w, verb_forms: w.verb_forms }))]);
  return { words, formIndex };
}

function ownSentence(
  bundle: ContentBundle,
  dict: Dictionary,
  s: { id: string; nl: string; zh: string; en: string; speaker?: string | null; voice?: "default" | "male" },
  kind: RtSentence["kind"],
): RtSentence {
  return {
    id: s.id,
    nl: s.nl,
    zh: s.zh,
    en: s.en,
    kind,
    speaker: s.speaker ?? null,
    audio: { id: s.id, tts: { voice: voiceName(bundle.tts, s.voice), text: s.nl } },
    tokens: tokenize(s.nl, dict.formIndex).filter((t): t is PackToken => t.word_id !== null),
    flags: [],
  };
}

function tipView(bundle: ContentBundle, dict: Dictionary, tip: Tip): RtTip {
  return {
    id: tip.id,
    title: tip.title,
    bodyZh: tip.body_zh,
    bodyEn: tip.body_en,
    examples: tip.examples.map((e) => ownSentence(bundle, dict, e, "example")),
    table: tip.table,
  };
}

function packSentenceView(s: PackLesson["sentences"][number]): RtSentence {
  return {
    id: s.id,
    nl: s.nl,
    zh: s.zh,
    en: s.en,
    kind: s.role,
    speaker: s.speaker,
    audio: { id: s.id, ...packAudio(s.audio) },
    tokens: s.tokens ?? [],
    start: s.start,
    end: s.end,
    flags: s.flags ?? [],
  };
}

function showPastParticiple(bundle: ContentBundle, lessonId: string): boolean {
  const order = courseOrder(bundle);
  const g14 = order.findIndex((id) => bundle.lessons[id]?.tips?.includes("G14"));
  return g14 >= 0 && order.indexOf(lessonId) >= g14;
}

export interface LessonSources {
  own?: OwnLesson;
  /** The lesson's own pack lesson (main / test) */
  pack?: PackLesson;
  /** Phonics: linked NN lessons (keyword audio, exercises) */
  linked?: PackLesson[];
}

export function buildLesson(
  bundle: ContentBundle,
  dict: Dictionary,
  id: string,
  sources: LessonSources,
): RtLesson | null {
  const found = findCourseRef(bundle, id);
  if (!found) return null;
  const { section } = found;
  const { own, pack, linked = [] } = sources;
  if (found.ref.source === "own" && !own) return null;
  if (found.ref.source === "pack" && !pack) return null;
  const kind = SECTION_KIND[section];
  const title = own?.title ?? pack?.title ?? { nl: id, zh: id, en: id };

  const tips = (own?.tips ?? [])
    .map((t) => bundle.tips[t])
    .filter(Boolean)
    .map((t) => tipView(bundle, dict, t));
  const added = (own?.sentences ?? []).map((s) => ownSentence(bundle, dict, s, kind === "phonics" ? "line" : "added"));

  // Words: phonics → sound keywords then the rest; pack lessons → word_ids order
  const wordIds: string[] = [];
  const pushId = (wid: string) => {
    if (!wordIds.includes(wid) && dict.words.has(wid)) wordIds.push(wid);
  };
  for (const s of own?.sounds ?? []) s.word_ids.forEach(pushId);
  (own?.word_ids ?? []).forEach(pushId);
  (pack?.word_ids ?? []).forEach(pushId);

  // Phonics lessons reuse the original keyword recordings of the linked NN lessons
  const keywordAudio = new Map<string, string>();
  for (const l of linked) {
    for (const k of l.keywords ?? []) {
      const lemma = dict.words.get(k.word_id)?.lemma.toLowerCase() ?? k.nl.toLowerCase();
      if (k.audio && !keywordAudio.has(lemma)) keywordAudio.set(lemma, k.audio);
    }
  }
  const words = wordIds.map((wid) => {
    const w = dict.words.get(wid)!;
    const nn = keywordAudio.get(w.lemma.toLowerCase());
    return nn && !w.audio.nn ? { ...w, audio: { ...w.audio, nn } } : w;
  });
  const newWordIds = pack ? wordIds.filter((wid) => dict.words.get(wid)?.firstLesson === pack.id) : [...wordIds];

  const fullSentences = (pack?.sentences ?? []).map(packSentenceView);
  let taught: RtSentence[];
  if (pack && own?.sentence_ids) {
    const byId = new Map(fullSentences.map((s) => [s.id, s]));
    taught = own.sentence_ids.map((sid) => byId.get(sid)).filter((s): s is RtSentence => !!s);
  } else {
    taught = fullSentences.filter((s) => s.kind === "line" || s.kind === "extra");
  }
  taught = [...taught, ...added];

  const extras: RtExtraBox[] = (pack?.extras ?? []).map((x) => ({
    id: x.id,
    sentences: (x.sentences ?? []).map((s) => ({
      id: s.id,
      nl: s.nl,
      zh: s.zh,
      en: s.en,
      kind: "example",
      speaker: null,
      audio: { id: s.id, ...packAudio(s.audio, s.audio_source) },
      tokens: s.tokens ?? [],
      flags: [],
    })),
  }));

  const packExercises: RtPackExercise[] = [...(pack ? [pack] : []), ...linked].flatMap((l) =>
    (l.exercises ?? [])
      .filter((e) => !e.skip && e.type !== "other" && Array.isArray(e.items))
      .map((exercise) => ({ lessonId: l.id, exercise })),
  );

  return {
    id,
    kind,
    code: lessonCode(section, id),
    title,
    textType: pack?.text_type,
    fullAudio: pack?.audio_full ? { id: `${pack.id}-full`, nn: pack.audio_full } : undefined,
    fullSentences,
    sentences: taught,
    words,
    newWordIds,
    sounds: (own?.sounds ?? []).map((s) => ({
      grapheme: s.grapheme,
      noteZh: s.note_zh,
      noteEn: s.note_en,
      wordIds: s.word_ids,
    })),
    tips,
    extras,
    packExercises,
    ownExercises: own?.exercises ?? [],
    showPastParticiple: showPastParticiple(bundle, id),
  };
}

/** The pack lessons a course lesson needs: its own one, or the linked NN lessons of a phonics lesson. */
export function packLessonsFor(bundle: ContentBundle, id: string): { main?: string; linked: string[] } {
  const found = findCourseRef(bundle, id);
  if (!found) return { linked: [] };
  const own = bundle.lessons[id];
  return {
    main: found.ref.source === "pack" ? (found.ref.pack_id ?? found.ref.id) : undefined,
    linked: own?.nn_lessons ?? [],
  };
}
