// Synthesized audio for our own content (docs/01_DESIGN.md §5.2). Build time only, never at runtime.
//   AZURE_SPEECH_KEY=… AZURE_SPEECH_REGION=… npx tsx scripts/tts.ts      Azure TTS (GitHub Actions workflow)
//   npx tsx scripts/tts.ts --placeholder [--content fixtures/content]     tones instead of speech (tests, dev)
// Cache: content/audio/tts/<sha1(voice|text)[:16]>.mp3 plus manifest.json (text, voice, duration).
// Rate limit: at most one request per 3.2 s (Azure F0: 20 per minute); on HTTP 429 wait 60 s and retry.
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { TtsManifest } from "../src/content/ownTypes";
import { ownTexts } from "../src/content/ttsTexts";
import { DEFAULT_TTS_VOICES, loadContent, REPO_ROOT } from "./lib/contentFiles";

export const MIN_INTERVAL_MS = 3200;
const RETRY_WAIT_MS = 60_000;
const MAX_RETRIES = 5;

export function ttsKey(voice: string, text: string): string {
  return createHash("sha1").update(`${voice}|${text}`).digest("hex").slice(0, 16);
}

export function ssml(voice: string, text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<speak version="1.0" xml:lang="nl-NL"><voice name="${voice}">${esc}</voice></speak>`;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function probeSeconds(file: string): number {
  const out = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]);
  return Number(Number(out.toString().trim()).toFixed(2));
}

/** Converts whatever we got to MP3 mono 44.1 kHz 128 kbps, the format used everywhere in the app. */
function normalize(input: string, output: string, kbps: number) {
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-i",
    input,
    "-ac",
    "1",
    "-ar",
    "44100",
    "-b:a",
    `${kbps}k`,
    output,
  ]);
}

function placeholder(text: string, output: string) {
  const seconds = (0.5 + text.split(/\s+/).length * 0.3).toFixed(2);
  const freq = 200 + (parseInt(ttsKey("p", text).slice(0, 4), 16) % 200);
  execFileSync("ffmpeg", [
    "-loglevel",
    "error",
    "-y",
    "-f",
    "lavfi",
    "-i",
    `sine=frequency=${freq}:sample_rate=44100:duration=${seconds}`,
    "-af",
    "volume='0.15+0.7*abs(sin(PI*3*t))':eval=frame",
    "-ac",
    "1",
    "-ar",
    "44100",
    "-b:a",
    "32k",
    output,
  ]);
}

async function azure(voice: string, text: string, output: string, region: string, key: string): Promise<void> {
  const url = `https://${region}.tts.speech.microsoft.com/cognitiveservices/v1`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "application/ssml+xml",
        "X-Microsoft-OutputFormat": "audio-48khz-192kbitrate-mono-mp3",
        "User-Agent": "dutch-tutor-tts",
      },
      body: ssml(voice, text),
    });
    if (res.status === 429 && attempt < MAX_RETRIES) {
      console.log(`  429, waiting 60 s`);
      await sleep(RETRY_WAIT_MS);
      continue;
    }
    if (!res.ok) throw new Error(`Azure TTS failed: HTTP ${res.status} for "${text}"`);
    const raw = `${output}.raw.mp3`;
    writeFileSync(raw, Buffer.from(await res.arrayBuffer()));
    normalize(raw, output, 128);
    unlinkSync(raw);
    return;
  }
}

async function main() {
  const contentDir = resolve(arg("--content") ?? join(REPO_ROOT, "content"));
  const usePlaceholder = process.argv.includes("--placeholder");
  const { bundle, loader } = loadContent(contentDir);
  if (!bundle) {
    for (const i of loader.issues) console.error(`${i.where}: ${i.msg}`);
    throw new Error("content could not be loaded");
  }
  const dir = join(contentDir, "audio/tts");
  mkdirSync(dir, { recursive: true });
  const manifestPath = join(dir, "manifest.json");
  const manifest: TtsManifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : { voices: DEFAULT_TTS_VOICES, entries: {} };

  const todo = new Map<string, { voice: string; text: string }>();
  for (const item of ownTexts(bundle)) {
    const key = ttsKey(item.voice, item.text);
    if (manifest.entries[key] && existsSync(join(dir, `${key}.mp3`))) continue;
    todo.set(key, { voice: item.voice, text: item.text });
  }
  console.log(`${todo.size} texts to synthesize${usePlaceholder ? " (placeholder tones)" : ""}`);

  const key = process.env.AZURE_SPEECH_KEY;
  const region = process.env.AZURE_SPEECH_REGION;
  if (!usePlaceholder && todo.size > 0 && (!key || !region))
    throw new Error("AZURE_SPEECH_KEY and AZURE_SPEECH_REGION must be set (or use --placeholder)");

  let last = 0;
  let done = 0;
  for (const [hash, { voice, text }] of todo) {
    const out = join(dir, `${hash}.mp3`);
    if (usePlaceholder) placeholder(text, out);
    else {
      const wait = last + MIN_INTERVAL_MS - Date.now();
      if (wait > 0) await sleep(wait);
      last = Date.now();
      await azure(voice, text, out, region!, key!);
    }
    manifest.entries[hash] = { text, voice, duration: probeSeconds(out) };
    done += 1;
    console.log(`  [${done}/${todo.size}] ${hash} ${text}`);
    // save as we go, so an interrupted run keeps what it has
    writeFileSync(manifestPath, JSON.stringify(sortEntries(manifest), null, 2) + "\n");
  }
  writeFileSync(manifestPath, JSON.stringify(sortEntries(manifest), null, 2) + "\n");
}

function sortEntries(m: TtsManifest): TtsManifest {
  return {
    voices: m.voices,
    entries: Object.fromEntries(Object.entries(m.entries).sort(([a], [b]) => a.localeCompare(b))),
  };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(import.meta.filename)) {
  main().catch((e: unknown) => {
    console.error((e as Error).message);
    process.exitCode = 1;
  });
}
