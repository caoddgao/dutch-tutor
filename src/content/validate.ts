// Content checks, docs/01_DESIGN.md §11 rules 1–7. Pure: the CLI (scripts/validate-content.ts) loads files,
// runs JSON Schema checks and passes everything in here.
import type { ContentBundle, CourseLessonRef, OwnLesson, OwnWord } from "./ownTypes";
import { lineCount, packLessonParts, partRefs, suggestedParts } from "./split";
import type { PackExercise, PackIndex, PackLesson, PackManifest, PackSentence, PackWord } from "./packTypes";
import { fillBank, PACK_FORMAT_VERSION } from "./packTypes";
import { buildFormIndex, isLetter, tokenize, uncoveredWords } from "./tokenize";
import { ownTexts, ttsKeyLookup } from "./ttsTexts";

export type Rule = "schema" | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Issue {
  level: "error" | "warn";
  rule: Rule;
  where: string;
  msg: string;
}

export interface LessonStat {
  id: string;
  sentences: number;
  newWords: number;
  /** Rule 5: words used but neither new here, taught earlier, nor function words */
  unknownWords: string[];
  overFiveSeconds: string[];
}

export interface SplitBoundary {
  /** Course lesson the part belongs to, e.g. NN24b */
  id: string;
  /** Last sentence of the previous part and first sentence of this one (Dutch) */
  before: string;
  after: string;
}

export interface Report {
  issues: Issue[];
  lessons: LessonStat[];
  missingTts: number;
  /** Where split lessons are cut (only with a pack), for checking that no exchange is cut in half */
  splits?: SplitBoundary[];
}

export interface PackData {
  manifest: PackManifest;
  index: PackIndex;
  words: PackWord[];
  lessons: Record<string, PackLesson>;
  fileExists(relPath: string): boolean;
}

export interface ValidateInput {
  content: ContentBundle;
  pack?: PackData;
  /** content/a1/nn-index.json: lets the check without a pack still resolve course.json's pack lessons */
  nnIndex?: PackIndex;
  ttsFileExists(hash: string): boolean;
}

/** Own sentences: ≤ 5 s; phonics lessons ≤ 4 s (rule 3). */
export const MAX_OWN_SECONDS = 5;
export const MAX_PHONICS_SECONDS = 4;

const CHOICE_TYPES = new Set(["true_false", "choose_one", "listen_choose"]);

export function validateContent({ content, pack, nnIndex, ttsFileExists }: ValidateInput): Report {
  const issues: Issue[] = [];
  const err = (rule: Rule, where: string, msg: string) => issues.push({ level: "error", rule, where, msg });
  const warn = (rule: Rule, where: string, msg: string) => issues.push({ level: "warn", rule, where, msg });

  // ---------- dictionary ----------
  const ownWords = new Map<string, OwnWord>();
  for (const w of content.words) {
    if (ownWords.has(w.id)) err(1, `words/own.json`, `词条 id 重复：${w.id}`);
    ownWords.set(w.id, w);
    checkWordFields(w, "words/own.json", err);
  }
  const packWords = new Map<string, PackWord>();
  if (pack) {
    for (const w of pack.words) {
      if (packWords.has(w.id)) err(1, "words.json", `词条 id 重复：${w.id}`);
      packWords.set(w.id, w);
      checkWordFields(w, "words.json", err);
      if (w.audio && !pack.fileExists(w.audio)) err(1, `words.json ${w.id}`, `音频文件不存在：${w.audio}`);
      const own = ownWords.get(w.id);
      if (own && own.lemma !== w.lemma)
        err(1, `words/own.json ${w.id}`, `与资料包同 id 的词条原形不同：${own.lemma} / ${w.lemma}`);
    }
    // the app merges an own word into the pack entry with the same lemma and part of speech (model.ts)
    const packByKey = new Map(pack.words.map((w) => [`${w.lemma.toLowerCase()}|${w.pos}`, w.id]));
    for (const w of content.words) {
      const same = packByKey.get(`${w.lemma.toLowerCase()}|${w.pos}`);
      if (same && same !== w.id && !packWords.has(w.id))
        warn(1, `words/own.json ${w.id}`, `资料包里已有同一个词 ${same}，程序会用资料包的词条`);
    }
  }
  const allWords = new Map<string, { id: string; lemma: string; pos: string; flags?: string[]; first_lesson?: string }>(
    [...ownWords, ...packWords],
  );
  const formIndex = buildFormIndex([...ownWords.values(), ...packWords.values()]);
  const functionLemmas = new Set(content.functionWords.lemmas.map((l) => l.toLowerCase()));
  const wordRef = (id: string, where: string) => {
    if (allWords.has(id)) return true;
    err(1, where, `找不到词条：${id}`);
    return false;
  };

  // ---------- tips ----------
  const seenIds = new Set<string>();
  const uniqueId = (id: string, where: string) => {
    if (seenIds.has(id)) err(1, where, `id 重复：${id}`);
    seenIds.add(id);
  };
  for (const [key, tip] of Object.entries(content.tips)) {
    if (tip.id !== key) err(1, `tips/${key}.json`, `文件名和 id 不一致：${tip.id}`);
    uniqueId(tip.id, `tips/${key}.json`);
    for (const ex of tip.examples) {
      uniqueId(ex.id, `tips/${key}.json`);
      checkTrilingual(ex, `tips/${key}.json ${ex.id}`, err);
    }
  }

  // ---------- course ----------
  const courseIds = new Set<string>();
  const missingInPack = new Set<string>();
  const packRefs = new Map<string, CourseLessonRef[]>();
  for (const section of content.course.sections) {
    for (const ref of section.lessons) {
      if (courseIds.has(ref.id)) err(1, "course.json", `课程重复：${ref.id}`);
      courseIds.add(ref.id);
      if (ref.source === "own" && !content.lessons[ref.id])
        err(1, "course.json", `找不到课程文件 lessons/${ref.id}.json`);
      if (ref.source === "own" && ref.part) err(1, "course.json", `${ref.id}：只有资料包的课可以拆分`);
      if (ref.source !== "pack") continue;
      const packId = ref.pack_id ?? ref.id;
      packRefs.set(packId, [...(packRefs.get(packId) ?? []), ref]);
      if (pack && !pack.lessons[packId]) missingInPack.add(packId);
      if (!pack && nnIndex && !nnIndex.lessons.some((l) => l.id === packId))
        err(1, "course.json", `${ref.id}：nn-index.json 里没有 ${packId}`);
    }
  }
  if (missingInPack.size > 0)
    warn(1, "course.json", `资料包里还没有这些课（${missingInPack.size} 课）：${[...missingInPack].join(" ")}`);
  // split lessons (design §2.1): parts 1…of, one entry each
  for (const [packId, refs] of packRefs) {
    const parts = refs.map((r) => r.part);
    if (refs.length === 1 && !parts[0]) continue;
    const of = refs.length;
    const ns = parts.map((p) => p?.n).sort((a, b) => (a ?? 0) - (b ?? 0));
    if (parts.some((p) => !p || p.of !== of) || ns.some((n, i) => n !== i + 1))
      err(1, "course.json", `${packId} 的拆分不完整：${refs.map((r) => r.id).join("、")} 应该是第 1–${of} 部分`);
    const packLesson = pack?.lessons[packId];
    if (packLesson) {
      const lines = new Set(packLesson.sentences.filter((x) => x.role === "line").map((x) => x.id));
      for (const r of refs)
        if (r.part?.from && !lines.has(r.part.from))
          err(1, "course.json", `${r.id}：${packId} 里没有课文句 ${r.part.from}`);
    }
  }
  if (!pack && nnIndex) {
    for (const l of nnIndex.lessons.filter((x) => x.kind === "main")) {
      const want = suggestedParts(l, content.course.limits);
      const have = packRefs.get(l.id)?.length ?? 0;
      if (have > 0 && have < want)
        warn(7, l.id, `课文 ${lineCount(l)} 句、新词 ${l.new_word_count} 个，建议拆成 ${want} 部分（现在 ${have}）`);
    }
  }
  for (const id of Object.keys(content.lessons)) {
    if (!courseIds.has(id)) err(1, `lessons/${id}.json`, "课程编排 course.json 里没有这一课");
  }

  // ---------- own lessons ----------
  const ownSentenceIds = new Set<string>();
  for (const [key, lesson] of Object.entries(content.lessons)) {
    const where = `lessons/${key}.json`;
    if (lesson.id !== key) err(1, where, `文件名和 id 不一致：${lesson.id}`);
    for (const s of lesson.sentences ?? []) {
      uniqueId(s.id, where);
      ownSentenceIds.add(s.id);
      checkTrilingual(s, `${where} ${s.id}`, err);
      // rule 4: every word maps to an entry
      if (pack || ownWords.size > 0) {
        for (const tok of tokenize(s.nl, formIndex)) {
          if (!tok.word_id) err(4, `${where} ${s.id}`, `“${tok.t}”找不到对应词条`);
        }
      }
    }
    for (const id of lesson.word_ids ?? []) wordRef(id, where);
    for (const sound of lesson.sounds ?? []) {
      if (!sound.note_zh.trim()) err(2, where, `音 ${sound.grapheme} 缺少中文发音说明`);
      for (const id of sound.word_ids) wordRef(id, `${where} 音 ${sound.grapheme}`);
    }
    for (const t of lesson.tips ?? []) if (!content.tips[t]) err(1, where, `找不到小贴士 ${t}`);
    if (lesson.kind === "main") {
      if (!lesson.pack_lesson) err(1, where, "正课需要 pack_lesson");
      const ref = content.course.sections.flatMap((x) => x.lessons).find((r) => r.id === key);
      if (ref && lesson.pack_lesson && (ref.pack_id ?? ref.id) !== lesson.pack_lesson)
        err(1, where, `pack_lesson ${lesson.pack_lesson} 和课程编排里的 ${ref.pack_id ?? ref.id} 不一致`);
      const packLesson = pack && lesson.pack_lesson ? pack.lessons[lesson.pack_lesson] : undefined;
      if (pack && lesson.pack_lesson && !packLesson) warn(1, where, `资料包里没有 ${lesson.pack_lesson}`);
      if (packLesson) {
        const ids = new Set(packLesson.sentences.map((s) => s.id));
        for (const id of lesson.sentence_ids ?? []) if (!ids.has(id)) err(1, where, `资料包里没有句子 ${id}`);
      }
      if ((lesson.sentences?.length ?? 0) > 5) warn(7, where, "补充短句超过 5 句");
    }
    if (pack) {
      for (const nn of lesson.nn_lessons ?? []) if (!pack.lessons[nn]) warn(1, where, `资料包里没有 ${nn}`);
    } else if (nnIndex) {
      for (const nn of lesson.nn_lessons ?? [])
        if (!nnIndex.lessons.some((l) => l.id === nn)) err(1, where, `nn-index.json 里没有 ${nn}`);
    }
    if (lesson.reading) checkReading(lesson, where);
    checkOwnExercises(lesson, where, {
      err,
      wordRef,
      sentenceExists: (id) =>
        (lesson.sentences ?? []).some((s) => s.id === id) ||
        (!!pack && !!lesson.pack_lesson && !!pack.lessons[lesson.pack_lesson]?.sentences.some((s) => s.id === id)) ||
        (!pack && lesson.kind === "main"),
      uniqueId: (id) => uniqueId(id, where),
    });
  }

  function checkReading(lesson: OwnLesson, where: string) {
    const id = lesson.reading!;
    if (lesson.kind !== "phonics") err(1, where, "只有发音入门课可以带认读小文");
    const other = Object.values(content.lessons).find((l) => l.id !== lesson.id && l.reading === id);
    if (other && other.id < lesson.id) err(1, where, `认读小文 ${id} 已经用在 ${other.id}`);
    if (pack) {
      const r = pack.lessons[id];
      if (!r) warn(1, where, `资料包里没有认读小文 ${id}`);
      else if (r.kind !== "reading") err(1, where, `${id} 不是认读小文（kind 是 ${r.kind}）`);
      else if (!r.sentences.some((x) => x.role === "line")) err(1, where, `认读小文 ${id} 没有课文句`);
    } else if (nnIndex) {
      const r = nnIndex.lessons.find((l) => l.id === id);
      if (!r) err(1, where, `nn-index.json 里没有认读小文 ${id}`);
      else if (r.kind !== "reading") err(1, where, `${id} 不是认读小文（kind 是 ${r.kind}）`);
    }
  }

  // ---------- own audio (rules 1, 3) ----------
  const lookup = ttsKeyLookup(content.tts);
  let missingTts = 0;
  const ownOverLimit = new Map<string, string[]>();
  for (const item of ownTexts(content)) {
    const key = lookup(item.voice, item.text);
    if (!key || !ttsFileExists(key)) {
      missingTts += 1;
      continue;
    }
    const seconds = content.tts.entries[key].duration;
    const limit = item.phonics ? MAX_PHONICS_SECONDS : MAX_OWN_SECONDS;
    if (item.kind === "sentence" && seconds > limit) {
      err(3, item.where, `录音 ${seconds.toFixed(2)} 秒，超过 ${limit} 秒：${item.text}`);
      ownOverLimit.set(item.lessonId ?? "", [...(ownOverLimit.get(item.lessonId ?? "") ?? []), item.id]);
    }
  }
  if (missingTts > 0) warn(1, "content/audio/tts", `${missingTts} 条合成音还没有生成（运行"生成合成音"工作流）`);
  for (const [hash, entry] of Object.entries(content.tts.entries)) {
    if (!ttsFileExists(hash)) err(1, "content/audio/tts/manifest.json", `缺少音频文件 ${hash}.mp3（${entry.text}）`);
  }

  // ---------- pack ----------
  if (pack) validatePack(pack, { err, warn, wordRef, functionLemmas });

  // ---------- rules 5 and 7 per course lesson ----------
  const isLetterId = (id: string) => {
    const w = allWords.get(id);
    return !!w && isLetter(w);
  };
  const lessonStats: LessonStat[] = [];
  const splits: SplitBoundary[] = [];
  const known = new Set<string>();
  const { max_sentences, max_new_words } = content.course.limits;
  for (const section of content.course.sections) {
    for (const ref of section.lessons) {
      const own = content.lessons[ref.id];
      const packLesson = ref.source === "pack" && pack ? pack.lessons[ref.pack_id ?? ref.id] : undefined;
      if (ref.source === "pack" && !packLesson) continue;
      const siblings = packLesson ? partRefs(content.course, packLesson.id) : [];
      const view = packLesson
        ? packLessonParts(packLesson, ref.part ? siblings.map((r) => ({ from: r.part?.from })) : [{}])[
            ref.part ? Math.max(0, siblings.indexOf(ref)) : 0
          ]
        : undefined;
      // a phonics lesson's reading text counts as part of the lesson (rules 3, 5, 7)
      const reading =
        own?.reading && pack?.lessons[own.reading]?.kind === "reading" ? pack.lessons[own.reading] : undefined;
      if (packLesson && ref.part && view && !view.sentences.some((s) => s.role === "line"))
        err(1, ref.id, `这一部分没有课文句（${packLesson.id} 的课文句比部分少）`);
      if (packLesson && ref.part && ref.part.n > 1 && view?.sentences[0]) {
        const prev = packLesson.sentences[packLesson.sentences.indexOf(view.sentences[0]) - 1];
        splits.push({ id: ref.id, before: prev?.nl ?? "", after: view.sentences[0].nl });
      }
      const taught = taughtWordIds(own, packLesson, [...(view?.wordIds ?? []), ...(reading?.word_ids ?? [])]);
      const used = usedWordIds(own, [...(view?.sentences ?? []), ...(reading?.sentences ?? [])], formIndex);
      const unknown = [...used].filter(
        (id) =>
          !taught.has(id) &&
          !known.has(id) &&
          allWords.get(id)?.pos !== "eigen" &&
          !functionLemmas.has((allWords.get(id)?.lemma ?? "").toLowerCase()),
      );
      const newWords = packLesson
        ? (view?.wordIds ?? []).filter((id) => packWords.get(id)?.first_lesson === packLesson.id).length
        : [...taught].filter((id) => !known.has(id) && !isLetterId(id)).length;
      const sentences =
        [...(view?.sentences ?? []), ...(reading?.sentences ?? [])].filter((s) => s.role === "line").length +
        (own?.sentences?.length ?? 0);
      const over = [
        ...[...(view?.full ?? []), ...(reading?.sentences ?? [])]
          .filter((s) => (s.duration ?? 0) > MAX_OWN_SECONDS)
          .map((s) => s.id),
        ...(ownOverLimit.get(ref.id) ?? []),
      ];
      lessonStats.push({
        id: ref.id,
        sentences,
        newWords,
        unknownWords: unknown.map((id) => allWords.get(id)?.lemma ?? id),
        overFiveSeconds: over,
      });
      if (unknown.length > 0) warn(5, ref.id, `${unknown.length} 个词不是本课新词、前面学过的词或功能词`);
      if (sentences > max_sentences) warn(7, ref.id, `课文 ${sentences} 句，超过 ${max_sentences}，建议拆分`);
      if (newWords > max_new_words) warn(7, ref.id, `新词 ${newWords} 个，超过 ${max_new_words}，建议拆分`);
      for (const id of taught) known.add(id);
    }
  }

  return { issues, lessons: lessonStats, missingTts, splits };
}

function taughtWordIds(
  own: OwnLesson | undefined,
  packLesson: PackLesson | undefined,
  partWordIds: string[] = [],
): Set<string> {
  const ids = new Set<string>(own?.word_ids ?? []);
  for (const s of own?.sounds ?? []) for (const id of s.word_ids) ids.add(id);
  for (const id of partWordIds) ids.add(id);
  for (const k of packLesson?.keywords ?? []) ids.add(k.word_id);
  return ids;
}

function usedWordIds(
  own: OwnLesson | undefined,
  packSentences: PackSentence[] | undefined,
  formIndex: Map<string, string>,
): Set<string> {
  const ids = new Set<string>();
  for (const s of packSentences ?? []) {
    if (s.role === "title") continue;
    for (const t of s.tokens ?? []) ids.add(t.word_id);
  }
  for (const s of own?.sentences ?? []) {
    for (const t of tokenize(s.nl, formIndex)) if (t.word_id) ids.add(t.word_id);
  }
  return ids;
}

type Report2 = (rule: Rule, where: string, msg: string) => void;

function checkTrilingual(s: { nl: string; zh: string; en: string }, where: string, err: Report2) {
  for (const k of ["nl", "zh", "en"] as const) {
    if (!s[k] || !s[k].trim()) err(2, where, `缺少${k === "nl" ? "荷兰语" : k === "zh" ? "中文" : "英文"}`);
  }
}

function checkWordFields(
  w: { id: string; lemma: string; pos: string; zh: string; en: string; article?: string | null },
  where: string,
  err: Report2,
) {
  if (!w.pos) err(2, `${where} ${w.id}`, "缺少词性");
  if (!w.zh?.trim()) err(2, `${where} ${w.id}`, "缺少中文释义");
  if (!w.en?.trim()) err(2, `${where} ${w.id}`, "缺少英文释义");
  if (w.pos === "zn" && !w.article) err(2, `${where} ${w.id}`, `名词 ${w.lemma} 缺少冠词`);
}

function checkOwnExercises(
  lesson: OwnLesson,
  where: string,
  ctx: {
    err: Report2;
    wordRef: (id: string, where: string) => boolean;
    sentenceExists: (id: string) => boolean;
    uniqueId: (id: string) => void;
  },
) {
  for (const ex of lesson.exercises ?? []) {
    ctx.uniqueId(ex.id);
    const w = `${where} ${ex.id}`;
    for (const item of ex.items) ctx.uniqueId(item.id);
    switch (ex.type) {
      case "listen_choose":
        for (const it of ex.items) {
          ctx.wordRef(it.word_id, w);
          checkChoice(it.options, it.answer, `${w} ${it.id}`, ctx.err);
        }
        break;
      case "choose_audio":
        for (const it of ex.items) {
          ctx.wordRef(it.word_id, w);
          for (const o of it.options) ctx.wordRef(o, w);
          checkChoice(it.options, it.word_id, `${w} ${it.id}`, ctx.err);
        }
        break;
      case "order":
        for (const it of ex.items)
          if (!ctx.sentenceExists(it.sentence_id)) ctx.err(1, w, `找不到句子 ${it.sentence_id}`);
        break;
      case "oral_complete":
        for (const it of ex.items) {
          checkTrilingual(it.context, `${w} ${it.id} 情景句`, ctx.err);
          checkTrilingual(it.start, `${w} ${it.id} 句子开头`, ctx.err);
          if (it.sample_answers.length === 0) ctx.err(6, `${w} ${it.id}`, "没有参考答案");
          it.sample_answers.forEach((a) => checkTrilingual(a, `${w} ${it.id} 参考答案`, ctx.err));
        }
        break;
      case "oral_answer":
        for (const it of ex.items) {
          checkTrilingual(it.question, `${w} ${it.id} 问题`, ctx.err);
          if (it.sample_answers.length === 0) ctx.err(6, `${w} ${it.id}`, "没有参考答案");
          it.sample_answers.forEach((a) => checkTrilingual(a, `${w} ${it.id} 参考答案`, ctx.err));
        }
        break;
    }
  }
}

/** Rule 6: exactly one correct option, no duplicate options. */
function checkChoice(options: string[] | undefined, answer: string | undefined, where: string, err: Report2) {
  if (!options || options.length < 2) {
    err(6, where, "选项少于 2 个");
    return;
  }
  const norm = options.map((o) => o.trim().toLowerCase());
  if (new Set(norm).size !== norm.length) err(6, where, `选项重复：${options.join(" / ")}`);
  const hits = norm.filter((o) => o === (answer ?? "").trim().toLowerCase()).length;
  if (hits !== 1) err(6, where, hits === 0 ? `答案“${answer}”不在选项里` : `答案“${answer}”出现了 ${hits} 次`);
}

function validatePack(
  pack: PackData,
  ctx: {
    err: Report2;
    warn: Report2;
    wordRef: (id: string, where: string) => boolean;
    functionLemmas: Set<string>;
  },
) {
  const { err, warn } = ctx;
  if (pack.manifest.format_version !== PACK_FORMAT_VERSION)
    err(1, "manifest.json", `格式版本 ${pack.manifest.format_version}，程序只认 ${PACK_FORMAT_VERSION}`);
  if (pack.index.format_version !== PACK_FORMAT_VERSION) err(1, "index.json", `格式版本 ${pack.index.format_version}`);

  const listed = new Set(pack.manifest.lessons);
  for (const id of listed) if (!pack.lessons[id]) err(1, "manifest.json", `列出了 ${id}，但没有 lessons/${id}.json`);
  for (const id of Object.keys(pack.lessons))
    if (!listed.has(id)) err(1, `lessons/${id}.json`, "manifest.json 里没有列出");
  const indexed = new Set(pack.index.lessons.map((l) => l.id));
  for (const id of Object.keys(pack.lessons)) if (!indexed.has(id)) err(1, "index.json", `缺少 ${id}`);
  for (const id of indexed) if (!pack.lessons[id]) err(1, "index.json", `列出了不存在的 ${id}`);

  const ids = new Set<string>();
  const unique = (id: string, where: string) => {
    if (ids.has(id)) err(1, where, `id 重复：${id}`);
    ids.add(id);
  };
  const audio = (path: string | null | undefined, where: string, required: boolean) => {
    if (!path) {
      if (required) err(1, where, "缺少音频");
      return;
    }
    if (!pack.fileExists(path)) err(1, where, `音频文件不存在：${path}`);
  };

  for (const [key, lesson] of Object.entries(pack.lessons)) {
    const where = `lessons/${key}.json`;
    if (lesson.id !== key) err(1, where, `文件名和 id 不一致：${lesson.id}`);
    unique(lesson.id, where);
    if (lesson.kind === "main" && !lesson.text_type) err(2, where, "缺少 text_type");
    if (lesson.audio_full) audio(lesson.audio_full, where, true);
    for (const s of lesson.sentences) {
      const sw = `${where} ${s.id}`;
      unique(s.id, where);
      checkTrilingual(s, sw, err);
      audio(s.audio, sw, !s.flags.includes("no_audio"));
      if (lesson.text_type === "text" && s.speaker !== null) err(2, sw, "短文的 speaker 应为 null");
      if ((s.duration ?? 0) > MAX_OWN_SECONDS && !s.flags.includes("over_5s"))
        warn(3, sw, `${s.duration} 秒，但没有标 over_5s`);
      checkTokens(s, sw, ctx);
    }
    for (const id of lesson.word_ids ?? []) ctx.wordRef(id, `${where} word_ids`);
    for (const x of lesson.extras ?? []) {
      unique(x.id, where);
      for (const s of x.sentences) {
        const sw = `${where} ${s.id}`;
        unique(s.id, where);
        checkTrilingual(s, sw, err);
        audio(s.audio, sw, true);
        checkTokens({ ...s, role: "extra" }, sw, ctx);
      }
    }
    const keywordIds = new Set<string>();
    for (const k of lesson.keywords ?? []) {
      unique(k.id, where);
      keywordIds.add(k.id);
      ctx.wordRef(k.word_id, `${where} ${k.id}`);
      audio(k.audio, `${where} ${k.id}`, !k.flags.includes("no_audio"));
    }
    for (const s of lesson.sounds ?? []) {
      for (const k of s.keywords) {
        if (!keywordIds.has(`${lesson.id}-${k}`)) err(1, `${where} 音 ${s.grapheme}`, `找不到关键词 ${k}`);
      }
    }
    for (const ex of lesson.exercises) checkPackExercise(ex, lesson, where, { ...ctx, unique, audio });
  }
}

function checkTokens(
  s: Pick<PackSentence, "nl" | "tokens" | "role">,
  where: string,
  ctx: { err: Report2; wordRef: (id: string, where: string) => boolean },
) {
  if (s.role === "title") return;
  if (!s.tokens) {
    ctx.err(4, where, "缺少 tokens");
    return;
  }
  for (const t of s.tokens) ctx.wordRef(t.word_id, where);
  const missing = uncoveredWords(s.nl, s.tokens);
  if (missing.length > 0) ctx.err(4, where, `这些词没有对应词条：${missing.join("、")}`);
}

function checkPackExercise(
  ex: PackExercise,
  lesson: PackLesson,
  where: string,
  ctx: {
    err: Report2;
    unique: (id: string, where: string) => void;
    audio: (path: string | null | undefined, where: string, required: boolean) => void;
  },
) {
  const w = `${where} ${ex.id}`;
  ctx.unique(ex.id, where);
  for (const it of ex.items) ctx.unique(it.id, where);
  if (ex.type === "other" && !ex.skip) ctx.err(6, w, "type 为 other 的练习必须 skip");
  if (ex.skip) return;
  for (const it of ex.items) {
    const iw = `${w} ${it.id}`;
    if (it.audio) ctx.audio(it.audio, iw, true);
    switch (ex.type) {
      case "true_false":
        if (it.options?.length !== 2) ctx.err(6, iw, "判断题应有两个选项");
        checkChoice(it.options, it.answer, iw, ctx.err);
        break;
      case "choose_one":
        checkChoice(it.options, it.answer, iw, ctx.err);
        break;
      case "listen_choose":
        checkChoice(it.options, it.answer, iw, ctx.err);
        if (!it.audio) ctx.err(1, iw, "听音选择题缺少音频");
        break;
      case "fill_choice": {
        const bank = fillBank(ex, it);
        if (bank.length === 0) ctx.err(6, iw, "选词填空缺少词库");
        else if (!bank.some((b) => b.trim().toLowerCase() === (it.answer ?? "").trim().toLowerCase()))
          ctx.err(6, iw, `答案“${it.answer}”不在${it.bank?.length ? "这一小题的" : ""}词库里`);
        if (!it.prompt?.includes(".....")) ctx.err(6, iw, "题干里没有空位 .....");
        break;
      }
      case "match": {
        const left = it.left ?? [];
        const right = it.right ?? [];
        const pairs = it.pairs ?? [];
        if (left.length === 0 || left.length !== right.length) ctx.err(6, iw, "连线两边数量不一致");
        const ls = new Set(pairs.map((p) => p[0]));
        const rs = new Set(pairs.map((p) => p[1]));
        if (pairs.length !== left.length || ls.size !== left.length || rs.size !== right.length)
          ctx.err(6, iw, "连线答案必须一一对应");
        if (pairs.some(([l, r]) => l < 0 || l >= left.length || r < 0 || r >= right.length))
          ctx.err(6, iw, "连线答案的序号越界");
        break;
      }
      case "order":
        if ((it.tokens?.length ?? 0) < 2) ctx.err(6, iw, "排序题至少要两块");
        break;
      case "answer_oral":
        if (!it.sample_answers || it.sample_answers.length === 0) ctx.err(6, iw, "没有参考答案");
        break;
    }
  }
  if (CHOICE_TYPES.has(ex.type) && lesson.kind !== "phonics" && ex.type === "listen_choose")
    ctx.err(6, w, "listen_choose 只用于发音课");
}
