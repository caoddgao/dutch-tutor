// Our own content, bundled into the app at build time (content/a1, content/audio/tts).
import type { ContentBundle, CourseDef, FunctionWords, OwnLesson, OwnWord, Tip, TtsManifest } from "./ownTypes";
import course from "../../content/a1/course.json";
import functionWords from "../../content/a1/function-words.json";
import words from "../../content/a1/words/own.json";
import tts from "../../content/audio/tts/manifest.json";

const lessonFiles = import.meta.glob<OwnLesson>("../../content/a1/lessons/*.json", { eager: true, import: "default" });
const tipFiles = import.meta.glob<Tip>("../../content/a1/tips/*.json", { eager: true, import: "default" });
const ttsFiles = import.meta.glob<string>("../../content/audio/tts/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
});

const byId = <T extends { id: string }>(files: Record<string, T>): Record<string, T> =>
  Object.fromEntries(Object.values(files).map((f) => [f.id, f]));

export const CONTENT: ContentBundle = {
  course: course as CourseDef,
  lessons: byId(lessonFiles),
  tips: byId(tipFiles),
  words: words as OwnWord[],
  functionWords: functionWords as FunctionWords,
  tts: tts as TtsManifest,
};

/** cache key (16 hex) → bundled URL */
export const TTS_URLS: Record<string, string> = Object.fromEntries(
  Object.entries(ttsFiles).map(([path, url]) => [path.replace(/^.*\/([0-9a-f]{16})\.mp3$/, "$1"), url]),
);
