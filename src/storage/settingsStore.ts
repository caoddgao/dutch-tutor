import type { SettingKey, Settings } from "../settings/settings";

/** Persistence for settings. Values are stored as JSON. */
export interface SettingsStore {
  load(): Promise<Partial<Record<string, unknown>>>;
  save<K extends SettingKey>(key: K, value: Settings[K]): Promise<void>;
}

const LOCAL_KEY = "dutch-tutor.settings";
/** A copy of the last known settings, read synchronously at startup to avoid a theme flash. */
const CACHE_KEY = "dutch-tutor.settings-cache";

function readJson(key: string): Partial<Record<string, unknown>> {
  try {
    const raw = window.localStorage.getItem(key);
    const parsed: unknown = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function writeJson(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage unavailable: settings still apply for this session
  }
}

/** Used when running outside the desktop shell (browser dev server, tests). */
export function createLocalSettingsStore(): SettingsStore {
  return {
    async load() {
      return readJson(LOCAL_KEY);
    },
    async save(key, value) {
      writeJson(LOCAL_KEY, { ...readJson(LOCAL_KEY), [key]: value });
    },
  };
}

export function readCachedSettings(): Partial<Record<string, unknown>> {
  return readJson(CACHE_KEY);
}

export function writeCachedSettings(settings: Settings): void {
  writeJson(CACHE_KEY, settings);
}
