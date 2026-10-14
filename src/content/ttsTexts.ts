// Which of our own texts need synthesized audio (design §5.2), and how they map to cached files.
// Cache key = first 16 hex chars of sha1(voice + "|" + text), same rule as the resource pack.
import type { ContentBundle, TtsManifest, Voice } from "./ownTypes";

export interface OwnText {
  /** audio_id of the item */
  id: string;
  kind: "sentence" | "word" | "example" | "prompt";
  text: string;
  /** Azure voice name */
  voice: string;
  where: string;
  lessonId?: string;
  phonics?: boolean;
}

export function voiceName(tts: TtsManifest, voice: Voice | undefined): string {
  return voice === "male" ? tts.voices.male : tts.voices.default;
}

export function ownTexts(content: ContentBundle): OwnText[] {
  const out: OwnText[] = [];
  const def = content.tts.voices.default;
  for (const w of content.words) {
    out.push({ id: w.id, kind: "word", text: w.lemma, voice: def, where: `words/own.json ${w.id}` });
  }
  for (const [key, lesson] of Object.entries(content.lessons)) {
    const where = `lessons/${key}.json`;
    const phonics = lesson.kind === "phonics";
    for (const s of lesson.sentences ?? []) {
      out.push({
        id: s.id,
        kind: "sentence",
        text: s.nl,
        voice: voiceName(content.tts, s.voice),
        where: `${where} ${s.id}`,
        lessonId: key,
        phonics,
      });
    }
    for (const ex of lesson.exercises ?? []) {
      if (ex.type === "oral_complete") {
        for (const it of ex.items) {
          out.push({ id: `${it.id}-C`, kind: "prompt", text: it.context.nl, voice: def, where: `${where} ${it.id}` });
          out.push({ id: `${it.id}-B`, kind: "prompt", text: it.start.nl, voice: def, where: `${where} ${it.id}` });
          it.sample_answers.forEach((a, i) =>
            out.push({ id: `${it.id}-A${i + 1}`, kind: "prompt", text: a.nl, voice: def, where: `${where} ${it.id}` }),
          );
        }
      }
      if (ex.type === "oral_answer") {
        for (const it of ex.items) {
          out.push({ id: `${it.id}-Q`, kind: "prompt", text: it.question.nl, voice: def, where: `${where} ${it.id}` });
          it.sample_answers.forEach((a, i) =>
            out.push({ id: `${it.id}-A${i + 1}`, kind: "prompt", text: a.nl, voice: def, where: `${where} ${it.id}` }),
          );
        }
      }
    }
  }
  for (const [key, exam] of Object.entries(content.exams ?? {})) {
    const where = `exams/${key}.json`;
    for (const ex of exam.exercises) {
      if (ex.type === "oral_complete")
        for (const it of ex.items) {
          out.push({ id: `${it.id}-C`, kind: "prompt", text: it.context.nl, voice: def, where: `${where} ${it.id}` });
          out.push({ id: `${it.id}-B`, kind: "prompt", text: it.start.nl, voice: def, where: `${where} ${it.id}` });
          it.sample_answers.forEach((a, i) =>
            out.push({ id: `${it.id}-A${i + 1}`, kind: "prompt", text: a.nl, voice: def, where: `${where} ${it.id}` }),
          );
        }
      if (ex.type === "oral_answer")
        for (const it of ex.items) {
          out.push({ id: `${it.id}-Q`, kind: "prompt", text: it.question.nl, voice: def, where: `${where} ${it.id}` });
          it.sample_answers.forEach((a, i) =>
            out.push({ id: `${it.id}-A${i + 1}`, kind: "prompt", text: a.nl, voice: def, where: `${where} ${it.id}` }),
          );
        }
    }
  }
  for (const [key, tip] of Object.entries(content.tips)) {
    for (const ex of tip.examples) {
      out.push({ id: ex.id, kind: "example", text: ex.nl, voice: def, where: `tips/${key}.json ${ex.id}` });
    }
  }
  return out;
}

/** (voice, text) → cache key, from the manifest written by the TTS workflow. */
export function ttsKeyLookup(tts: TtsManifest): (voice: string, text: string) => string | undefined {
  const map = new Map<string, string>();
  for (const [key, e] of Object.entries(tts.entries)) map.set(`${e.voice}|${e.text}`, key);
  return (voice, text) => map.get(`${voice}|${text}`);
}
