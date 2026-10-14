// Test doubles for AppServices: fixture pack read from disk, in-memory SQLite, memory settings.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createMemoryRecordingFiles } from "../audio/recordings";
import type { ContentBundle } from "../content/ownTypes";
import { CONTENT } from "../content/bundle";
import type { PackBackend } from "../pack/backend";
import type { PackManifest } from "../content/packTypes";
import type { AppServices } from "../services";
import type { DataFiles } from "../storage/dataFiles";
import { createTestDb } from "../storage/testDb";
import { memoryStore } from "./memoryStore";
import { loadContent } from "../../scripts/lib/contentFiles";

export const FIXTURE_PACK_DIR = join(import.meta.dirname, "../../fixtures/nn-pack");
export const FIXTURE_CONTENT_DIR = join(import.meta.dirname, "../../fixtures/content");

export function fsPackBackend(dir: string | null = FIXTURE_PACK_DIR, extra: Partial<PackBackend> = {}): PackBackend {
  const read = (rel: string) => {
    if (!dir) throw { code: "io", detail: rel };
    return readFileSync(join(dir, rel), "utf8");
  };
  return {
    canImport: true,
    info: async () => ({
      dir: dir ?? "",
      manifest: dir ? (JSON.parse(read("manifest.json")) as PackManifest) : null,
      source_dir: null,
      imported_at: null,
    }),
    readText: async (rel) => read(rel),
    audioUrl: (rel) => `pack://${rel}`,
    inspect: async () => JSON.parse(read("manifest.json")) as PackManifest,
    importFrom: async () => {
      throw { code: "io", detail: "" };
    },
    pickFolder: async () => null,
    ...extra,
  };
}

export function fixtureContent(): ContentBundle {
  const { bundle } = loadContent(FIXTURE_CONTENT_DIR);
  if (!bundle) throw new Error("fixture content failed to load");
  return bundle;
}

export function testServices(over: Partial<AppServices> & { settingsData?: Record<string, unknown> } = {}) {
  const { store, data } = memoryStore(over.settingsData);
  const { db, raw } = createTestDb();
  const services: AppServices = {
    settings: store,
    db: async () => db,
    pack: fsPackBackend(),
    content: CONTENT,
    ttsUrls: {},
    recordingFiles: createMemoryRecordingFiles(),
    dataFiles: memoryDataFiles(),
    ...over,
  };
  return { services, settingsData: data, db, raw };
}

/** Exports land in `saved`; `nextImport` is what the next import returns; safety copies in `safety`. */
export function memoryDataFiles(): DataFiles & {
  saved: { name: string; text: string }[];
  safety: string[];
  nextImport: string | null;
} {
  const files = {
    saved: [] as { name: string; text: string }[],
    safety: [] as string[],
    nextImport: null as string | null,
    async exportText(name: string, text: string) {
      files.saved.push({ name, text });
      return true;
    },
    async importText() {
      return files.nextImport;
    },
    async saveSafetyCopy(_stamp: string, text: string) {
      files.safety.push(text);
    },
  };
  return files;
}
