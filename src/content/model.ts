// Runtime course model: our own content (content/a1) merged with the resource pack (design §10).
import type { ContentBundle, CourseLessonRef, OwnExercise, OwnLesson, Tip } from "./ownTypes";
import type { PackExercise, PackIndex, PackLesson, PackToken, PackWord, Pos, Trilingual, VerbForms } from "./packTypes";
import { packLessonParts, partLetter, partRefs } from "./split";
import { buildFormIndex, isLetter, tokenize } from "./tokenize";
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
  /** Course lesson where the word is first taught (see firstTaught); words never taught have none */
  firstLesson?: string;
  /** A letter of the alphabet (P09): shown with the sounds, not a word card or a review item */
  letter?: boolean;
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

/** A phonics lesson's reading text (NN14–19): listen to the original, then shadow it sentence by sentence. */
export interface RtReading {
  /** Pack lesson id */
  id: string;
  title: Trilingual;
  textType?: "dialogue" | "text" | "mixed";
  fullAudio?: AudioRef;
  /** Everything in the recording, title included */
  fullSentences: RtSentence[];
  /** The text sentences, one per screen */
  sentences: RtSentence[];
  /** The text's word list */
  words: RtWord[];
  /** Words first taught in the reading text */
  newWordIds: string[];
}

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
  /** Split lessons: the stretch of the full recording this part covers, seconds */
  fullSegment?: { start: number; end: number };
  /** Split lessons: which part this is */
  part?: { n: number; of: number };
  /** Everything in the full recording (split lessons: this part's stretch), in order, title included */
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
  /** Phonics: the reading text at the end of the lesson (needs the pack) */
  reading?: RtReading;
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
  part?: { n: number; of: number };
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

/** "第 21 课", split lessons "第 24 课 a" (design §2.1), "测验 1"; own lessons keep their id (P01). */
export function lessonCode(section: CourseSectionView["id"], ref: CourseLessonRef): string {
  const n = Number((ref.pack_id ?? ref.id).replace(/^\D+/, ""));
  if (section === "main" && Number.isFinite(n)) return ref.part ? `第 ${n} 课 ${partLetter(ref.part.n)}` : `第 ${n} 课`;
  if (section === "tests" && Number.isFinite(n)) return `测验 ${n}`;
  return ref.id;
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
        code: lessonCode(section.id, ref),
        title: own?.title ?? packEntry?.title ?? null,
        source: ref.source,
        packId,
        part: ref.part ? { n: ref.part.n, of: ref.part.of } : undefined,
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

/**
 * NN word list + words/own.json (design §6). The pack entry wins: an own word with the same id, or with the
 * same lemma and part of speech, becomes an alias of the pack entry, so lessons and review items that use
 * the own id open the pack's entry; the own synthesized audio stays as a fallback. Every inflected form
 * points to its entry's id (woont → w_wonen).
 */
export function buildDictionary(bundle: ContentBundle, packWords: PackWord[] = []): Dictionary {
  const voice = voiceName(bundle.tts, "default");
  const words = new Map<string, RtWord>();
  const nnByLemma = new Map<string, string>();
  const packByKey = new Map<string, PackWord>();
  const key = (w: { lemma: string; pos: string }) => `${w.lemma.toLowerCase()}|${w.pos}`;
  for (const w of packWords) {
    if (w.audio && w.audio_source?.startsWith("nn:")) nnByLemma.set(w.lemma.toLowerCase(), w.audio);
    if (!packByKey.has(key(w))) packByKey.set(key(w), w);
  }
  const packIds = new Set(packWords.map((w) => w.id));
  const aliases = new Map<string, string>();
  const ownTts = new Map<string, AudioRef["tts"]>();
  const letters = new Set<string>();
  for (const w of bundle.words) {
    const tts = { voice, text: w.lemma };
    const same = packIds.has(w.id) ? w.id : packByKey.get(key(w))?.id;
    if (same) {
      if (same !== w.id) aliases.set(w.id, same);
      if (!ownTts.has(same)) ownTts.set(same, tts);
      if (isLetter(w)) letters.add(same);
      continue;
    }
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
      letter: isLetter(w) || undefined,
      audio: { id: w.id, nn: nnByLemma.get(w.lemma.toLowerCase()), tts },
    });
  }
  for (const w of packWords) {
    if (words.has(w.id)) continue;
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
      letter: isLetter(w) || letters.has(w.id) || undefined,
      audio: { id: w.id, ...packAudio(w.audio, w.audio_source), tts: ownTts.get(w.id) },
    });
  }
  for (const [ownId, packId] of aliases) words.set(ownId, words.get(packId)!);
  for (const [wid, lesson] of firstTaught(bundle, words, packWords)) words.get(wid)!.firstLesson = lesson;
  // our own sentences are written against own.json: every form of an own word (or of the pack entry it merged
  // into) wins over the pack's other entries with that form (dag the greeting / de dag; drink of drinken)
  const formIndex = new Map([...buildFormIndex(packWords), ...buildFormIndex(bundle.words)]);
  for (const [form, id] of formIndex) if (aliases.has(id)) formIndex.set(form, aliases.get(id)!);
  return { words, formIndex };
}

/**
 * Where each word (dictionary id) is first taught: the earlier, in course order, of our own lessons' word
 * lists (sounds + word_ids) and the pack's first_lesson. A pack lesson counts as its (first) course entry, a
 * reading text as the phonics lesson that reads it; the NN lessons a phonics lesson only links (nn_lessons)
 * teach nothing by themselves. New words, word cards and review items all go by this.
 */
function firstTaught(bundle: ContentBundle, words: Map<string, RtWord>, packWords: PackWord[]): Map<string, string> {
  const order = courseOrder(bundle);
  const position = new Map(order.map((id, i) => [id, i]));
  const out = new Map<string, string>();
  for (const cid of order) {
    const l = bundle.lessons[cid];
    for (const wid of [...(l?.sounds ?? []).flatMap((s) => s.word_ids), ...(l?.word_ids ?? [])]) {
      const resolved = words.get(wid)?.id;
      if (resolved && !out.has(resolved)) out.set(resolved, cid);
    }
  }
  const refs = bundle.course.sections.flatMap((s) => s.lessons);
  const placeOf = new Map<string, string | undefined>();
  const place = (nn: string) => {
    if (!placeOf.has(nn))
      placeOf.set(
        nn,
        refs.find((r) => r.source === "pack" && (r.pack_id ?? r.id) === nn)?.id ??
          order.find((cid) => bundle.lessons[cid]?.reading === nn),
      );
    return placeOf.get(nn);
  };
  for (const w of packWords) {
    const at = w.first_lesson ? place(w.first_lesson) : undefined;
    const own = out.get(w.id);
    if (at && (!own || position.get(at)! < position.get(own)!)) out.set(w.id, at);
  }
  return out;
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
  /** Phonics: the reading text (own.reading) */
  reading?: PackLesson;
}

export function buildLesson(
  bundle: ContentBundle,
  dict: Dictionary,
  id: string,
  sources: LessonSources,
): RtLesson | null {
  const found = findCourseRef(bundle, id);
  if (!found) return null;
  const { section, ref } = found;
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
    const resolved = dict.words.get(wid)?.id;
    if (resolved && !wordIds.includes(resolved)) wordIds.push(resolved);
  };
  for (const s of own?.sounds ?? []) s.word_ids.forEach(pushId);
  (own?.word_ids ?? []).forEach(pushId);
  // split lessons: each part teaches its stretch of the text and the words first met there (split.ts)
  const siblings = pack ? partRefs(bundle.course, pack.id) : [];
  const partIndex = ref.part ? Math.max(0, siblings.indexOf(ref)) : 0;
  const view = pack
    ? packLessonParts(pack, ref.part ? siblings.map((r) => ({ from: r.part?.from })) : [{}])[partIndex]
    : undefined;
  (view?.wordIds ?? []).forEach(pushId);

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
  // a split pack lesson's word first met in this part was first taught in the lesson's first part
  const newWordIds = wordIds.filter((wid) => isNewIn(dict, wid, pack ? siblings.map((r) => r.id) : [id]));

  const fullSentences = (view?.full ?? []).map(packSentenceView);
  let taught: RtSentence[];
  if (pack && own?.sentence_ids) {
    const byId = new Map(pack.sentences.map((s) => [s.id, s]));
    taught = own.sentence_ids
      .map((sid) => byId.get(sid))
      .filter((s): s is PackLesson["sentences"][number] => !!s)
      .map(packSentenceView);
  } else {
    taught = (view?.sentences ?? []).map(packSentenceView);
  }
  const bookPart = !view || view.last;
  taught = [...taught, ...added];

  const extras: RtExtraBox[] = (bookPart ? (pack?.extras ?? []) : []).map((x) => ({
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

  // an NN lesson linked to several phonics lessons gives its exercises to the first of them only
  const exerciseSources = linked.filter((l) => firstLinkingLesson(bundle, l.id) === id);
  const packExercises: RtPackExercise[] = [...(pack && bookPart ? [pack] : []), ...exerciseSources].flatMap((l) =>
    (l.exercises ?? [])
      .filter((e) => !e.skip && e.type !== "other" && Array.isArray(e.items))
      .map((exercise) => ({ lessonId: l.id, exercise })),
  );

  return {
    id,
    kind,
    code: lessonCode(section, ref),
    title,
    textType: pack?.text_type,
    fullAudio: pack?.audio_full ? { id: `${pack.id}-full`, nn: pack.audio_full } : undefined,
    fullSegment: ref.part ? view?.segment : undefined,
    part: ref.part ? { n: ref.part.n, of: ref.part.of } : undefined,
    fullSentences,
    sentences: taught,
    words,
    newWordIds,
    sounds: (own?.sounds ?? []).map((s) => ({
      grapheme: s.grapheme,
      noteZh: s.note_zh,
      noteEn: s.note_en,
      wordIds: s.word_ids.map((wid) => dict.words.get(wid)?.id ?? wid),
    })),
    tips,
    extras,
    packExercises,
    ownExercises: own?.exercises ?? [],
    reading:
      sources.reading && own?.reading === sources.reading.id ? readingView(dict, sources.reading, id) : undefined,
    showPastParticiple: showPastParticiple(bundle, id),
  };
}

/** A word is new in the course lesson where it is first taught; letters of the alphabet never are. */
export function isNewIn(dict: Dictionary, wordId: string, lessonIds: string[]): boolean {
  const w = dict.words.get(wordId);
  return !!w && !w.letter && !!w.firstLesson && lessonIds.includes(w.firstLesson);
}

/** The own lesson (in course order) that first lists an NN lesson in nn_lessons. */
function firstLinkingLesson(bundle: ContentBundle, nnId: string): string | undefined {
  return courseOrder(bundle).find((cid) => bundle.lessons[cid]?.nn_lessons?.includes(nnId));
}

function readingView(dict: Dictionary, pack: PackLesson, lessonId: string): RtReading {
  const full = pack.sentences.map(packSentenceView);
  const ids: string[] = [];
  for (const wid of pack.word_ids ?? []) {
    const resolved = dict.words.get(wid)?.id;
    if (resolved && !ids.includes(resolved)) ids.push(resolved);
  }
  return {
    id: pack.id,
    title: pack.title,
    textType: pack.text_type,
    fullAudio: pack.audio_full ? { id: `${pack.id}-full`, nn: pack.audio_full } : undefined,
    fullSentences: full,
    sentences: full.filter((s) => s.kind === "line"),
    words: ids.map((wid) => dict.words.get(wid)!),
    newWordIds: ids.filter((wid) => isNewIn(dict, wid, [lessonId])),
  };
}

/**
 * The pack lessons a course lesson needs: its own one, or the linked NN lessons and the reading text of a
 * phonics lesson.
 */
export function packLessonsFor(
  bundle: ContentBundle,
  id: string,
): { main?: string; linked: string[]; reading?: string } {
  const found = findCourseRef(bundle, id);
  if (!found) return { linked: [] };
  const own = bundle.lessons[id];
  return {
    main: found.ref.source === "pack" ? (found.ref.pack_id ?? found.ref.id) : undefined,
    linked: own?.nn_lessons ?? [],
    reading: own?.reading,
  };
}
