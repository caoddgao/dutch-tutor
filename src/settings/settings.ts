export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export interface Settings {
  theme: ThemePreference;
  /** Font scale for Dutch text, 0.8–1.5 */
  scaleNl: number;
  /** Font scale for Chinese text (and the interface), 0.8–1.5 */
  scaleZh: number;
  /** Font scale for English text, 0.8–1.5 */
  scaleEn: number;
  showEnglish: boolean;
  /** Default playback speed */
  playbackRate: number;
  /** Today's review: at most this many items a day (design §4.4) */
  dailyReviewLimit: number;
  /** Review modes in rotation (design §4.2); at least one stays on */
  reviewR1: boolean;
  reviewR2: boolean;
  reviewR3: boolean;
}

export type SettingKey = keyof Settings;

export const SCALE_MIN = 0.8;
export const SCALE_MAX = 1.5;
export const SCALE_STEP = 0.05;
export const PLAYBACK_RATES = [1, 0.75] as const;
export const REVIEW_LIMIT_MIN = 10;
export const REVIEW_LIMIT_MAX = 200;
export const REVIEW_LIMIT_STEP = 10;

export const DEFAULT_SETTINGS: Settings = {
  theme: "system",
  scaleNl: 1,
  scaleZh: 1,
  scaleEn: 1,
  showEnglish: true,
  playbackRate: 1,
  dailyReviewLimit: 50,
  reviewR1: true,
  reviewR2: true,
  reviewR3: true,
};

export const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS) as SettingKey[];

export function clampScale(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return 1;
  // snap to the slider step, then clamp; toFixed removes float noise like 1.1500000000000001
  const snapped = Math.round(n / SCALE_STEP) * SCALE_STEP;
  return Number(Math.min(SCALE_MAX, Math.max(SCALE_MIN, snapped)).toFixed(2));
}

export function clampReviewLimit(value: unknown): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return DEFAULT_SETTINGS.dailyReviewLimit;
  const snapped = Math.round(n / REVIEW_LIMIT_STEP) * REVIEW_LIMIT_STEP;
  return Math.min(REVIEW_LIMIT_MAX, Math.max(REVIEW_LIMIT_MIN, snapped));
}

const bool = (v: unknown, fallback: boolean) => (typeof v === "boolean" ? v : fallback);

/** Turns untrusted stored values into a complete, valid Settings object. */
export function normalizeSettings(raw: Partial<Record<string, unknown>>): Settings {
  const theme = raw.theme;
  const rate = Number(raw.playbackRate);
  return {
    theme: theme === "light" || theme === "dark" || theme === "system" ? theme : DEFAULT_SETTINGS.theme,
    scaleNl: raw.scaleNl === undefined ? DEFAULT_SETTINGS.scaleNl : clampScale(raw.scaleNl),
    scaleZh: raw.scaleZh === undefined ? DEFAULT_SETTINGS.scaleZh : clampScale(raw.scaleZh),
    scaleEn: raw.scaleEn === undefined ? DEFAULT_SETTINGS.scaleEn : clampScale(raw.scaleEn),
    showEnglish: typeof raw.showEnglish === "boolean" ? raw.showEnglish : DEFAULT_SETTINGS.showEnglish,
    playbackRate: (PLAYBACK_RATES as readonly number[]).includes(rate) ? rate : DEFAULT_SETTINGS.playbackRate,
    dailyReviewLimit:
      raw.dailyReviewLimit === undefined ? DEFAULT_SETTINGS.dailyReviewLimit : clampReviewLimit(raw.dailyReviewLimit),
    ...reviewModes(raw),
  };
}

export function resolveTheme(pref: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (pref === "system") return systemPrefersDark ? "dark" : "light";
  return pref;
}

/** Writes settings to the document: theme attribute, English visibility and font-scale variables. */
export function applySettings(root: HTMLElement, settings: Settings, systemPrefersDark: boolean): void {
  root.dataset.theme = resolveTheme(settings.theme, systemPrefersDark);
  root.dataset.showEn = String(settings.showEnglish);
  root.style.setProperty("--scale-nl", String(settings.scaleNl));
  root.style.setProperty("--scale-zh", String(settings.scaleZh));
  root.style.setProperty("--scale-en", String(settings.scaleEn));
}

export function formatPercent(scale: number): string {
  return `${Math.round(scale * 100)}%`;
}

function reviewModes(raw: Partial<Record<string, unknown>>): Pick<Settings, "reviewR1" | "reviewR2" | "reviewR3"> {
  const modes = {
    reviewR1: bool(raw.reviewR1, true),
    reviewR2: bool(raw.reviewR2, true),
    reviewR3: bool(raw.reviewR3, true),
  };
  // never all off: fall back to R1
  if (!modes.reviewR1 && !modes.reviewR2 && !modes.reviewR3) modes.reviewR1 = true;
  return modes;
}
