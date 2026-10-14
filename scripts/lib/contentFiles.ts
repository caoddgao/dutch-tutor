// Node-side loading of content/ and of a resource pack, with JSON Schema checks (ajv).
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Ajv2020, type ValidateFunction } from "ajv/dist/2020.js";
import type { ContentBundle, TtsManifest } from "../../src/content/ownTypes";
import type { PackIndex } from "../../src/content/packTypes";
import type { PackData, Issue } from "../../src/content/validate";

export const REPO_ROOT = join(import.meta.dirname, "../..");
export const SCHEMA_DIR = join(REPO_ROOT, "content/schema");

export const DEFAULT_TTS_VOICES = { default: "nl-NL-FennaNeural", male: "nl-NL-MaartenNeural" };

let ajv: Ajv2020 | null = null;
const compiled = new Map<string, ValidateFunction>();

function schema(name: string): ValidateFunction {
  if (!ajv) {
    ajv = new Ajv2020({ allErrors: true, strict: false });
    for (const f of readdirSync(SCHEMA_DIR).filter((f) => f.endsWith(".schema.json"))) {
      ajv.addSchema(JSON.parse(readFileSync(join(SCHEMA_DIR, f), "utf8")));
    }
  }
  let fn = compiled.get(name);
  if (!fn) {
    fn = ajv.getSchema(name)!;
    if (!fn) throw new Error(`unknown schema ${name}`);
    compiled.set(name, fn);
  }
  return fn;
}

export class Loader {
  issues: Issue[] = [];

  constructor(private readonly root: string) {}

  /** Reads JSON and checks it against a schema; returns undefined when the file is missing or broken. */
  json<T>(rel: string, schemaName: string, required = true): T | undefined {
    const path = join(this.root, rel);
    if (!existsSync(path)) {
      if (required) this.issues.push({ level: "error", rule: 1, where: rel, msg: "文件不存在" });
      return undefined;
    }
    let data: unknown;
    try {
      data = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""));
    } catch (e) {
      this.issues.push({ level: "error", rule: "schema", where: rel, msg: `不是合法的 JSON：${(e as Error).message}` });
      return undefined;
    }
    const validate = schema(schemaName);
    if (!validate(data)) {
      for (const e of (validate.errors ?? []).slice(0, 20)) {
        this.issues.push({
          level: "error",
          rule: "schema",
          where: `${rel} ${e.instancePath || "/"}`,
          msg: `${e.message ?? "格式不对"}${e.params ? " " + JSON.stringify(e.params) : ""}`,
        });
      }
      return undefined;
    }
    return data as T;
  }

  jsonDir<T>(relDir: string, schemaName: string): Record<string, T> {
    const dir = join(this.root, relDir);
    const out: Record<string, T> = {};
    if (!existsSync(dir)) return out;
    for (const f of readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort()) {
      const data = this.json<T>(`${relDir}/${f}`, schemaName);
      if (data) out[f.replace(/\.json$/, "")] = data;
    }
    return out;
  }

  private listings = new Map<string, Set<string>>();

  /**
   * Is `rel` a file, with exactly this spelling? Windows and macOS ignore case, Android does not, so a
   * path that only matches in another case is reported as missing on every system.
   */
  exists(rel: string): boolean {
    const parts = rel.split(/[\\/]/).filter(Boolean);
    let dir = this.root;
    for (const name of parts) {
      let names = this.listings.get(dir);
      if (!names) {
        names = new Set(existsSync(dir) && statSync(dir).isDirectory() ? readdirSync(dir) : []);
        this.listings.set(dir, names);
      }
      if (!names.has(name)) return false;
      dir = join(dir, name);
    }
    return parts.length > 0 && statSync(dir).isFile();
  }
}

export function loadContent(dir: string): {
  bundle?: ContentBundle;
  nnIndex?: PackIndex;
  loader: Loader;
  ttsDir: string;
} {
  const loader = new Loader(dir);
  const course = loader.json<ContentBundle["course"]>("a1/course.json", "course.schema.json");
  const lessons = loader.jsonDir<ContentBundle["lessons"][string]>("a1/lessons", "own-lesson.schema.json");
  const exams = loader.jsonDir<NonNullable<ContentBundle["exams"]>[string]>("a1/exams", "exam.schema.json");
  const tips = loader.jsonDir<ContentBundle["tips"][string]>("a1/tips", "tip.schema.json");
  const words = loader.json<ContentBundle["words"]>("a1/words/own.json", "own-words.schema.json") ?? [];
  const functionWords = loader.json<ContentBundle["functionWords"]>(
    "a1/function-words.json",
    "function-words.schema.json",
  ) ?? { lemmas: [] };
  const tts =
    loader.json<TtsManifest>("audio/tts/manifest.json", "tts-manifest.schema.json", false) ??
    ({ voices: DEFAULT_TTS_VOICES, entries: {} } satisfies TtsManifest);
  const nnIndex = loader.json<PackIndex>("a1/nn-index.json", "pack-index.schema.json", false);
  const ttsDir = join(dir, "audio/tts");
  if (!course) return { loader, ttsDir };
  return { bundle: { course, lessons, exams, tips, words, functionWords, tts }, nnIndex, loader, ttsDir };
}

export function loadPack(dir: string): { pack?: PackData; loader: Loader } {
  const loader = new Loader(dir);
  const manifest = loader.json<PackData["manifest"]>("manifest.json", "pack-manifest.schema.json");
  const index = loader.json<PackData["index"]>("index.json", "pack-index.schema.json");
  const words = loader.json<PackData["words"]>("words.json", "pack-words.schema.json");
  const lessons = loader.jsonDir<PackData["lessons"][string]>("lessons", "pack-lesson.schema.json");
  if (!manifest || !index || !words) return { loader };
  return { pack: { manifest, index, words, lessons, fileExists: (rel) => loader.exists(rel) }, loader };
}
