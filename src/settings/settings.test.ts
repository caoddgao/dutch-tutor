import { describe, expect, it } from "vitest";
import { applySettings, clampScale, DEFAULT_SETTINGS, normalizeSettings, resolveTheme } from "./settings";

describe("clampScale", () => {
  it("keeps values within 80%–150%", () => {
    expect(clampScale(0.5)).toBe(0.8);
    expect(clampScale(2)).toBe(1.5);
    expect(clampScale(1.2)).toBe(1.2);
  });

  it("snaps to 5% steps without float noise", () => {
    expect(clampScale(1.1500000000000001)).toBe(1.15);
    expect(clampScale(1.03)).toBe(1.05);
  });

  it("falls back to 100% for garbage", () => {
    expect(clampScale("abc")).toBe(1);
    expect(clampScale(Number.NaN)).toBe(1);
  });
});

describe("normalizeSettings", () => {
  it("fills defaults for an empty store", () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SETTINGS);
  });

  it("rejects invalid values", () => {
    const s = normalizeSettings({ theme: "blue", showEnglish: "yes", playbackRate: 3, scaleNl: 9 });
    expect(s.theme).toBe("system");
    expect(s.showEnglish).toBe(true);
    expect(s.playbackRate).toBe(1);
    expect(s.scaleNl).toBe(1.5);
  });

  it("keeps valid values", () => {
    const s = normalizeSettings({ theme: "dark", showEnglish: false, playbackRate: 0.75, scaleZh: 1.3 });
    expect(s).toMatchObject({ theme: "dark", showEnglish: false, playbackRate: 0.75, scaleZh: 1.3 });
  });
});

describe("resolveTheme", () => {
  it("follows the system only when set to system", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });
});

describe("applySettings", () => {
  it("writes theme, English visibility and scale variables", () => {
    const root = document.createElement("html");
    applySettings(root, { ...DEFAULT_SETTINGS, theme: "system", showEnglish: false, scaleEn: 1.25 }, true);
    expect(root.dataset.theme).toBe("dark");
    expect(root.dataset.showEn).toBe("false");
    expect(root.style.getPropertyValue("--scale-en")).toBe("1.25");
  });
});

describe("review settings", () => {
  it("daily limit defaults to 50 and stays within 10–200 in steps of 10", () => {
    expect(normalizeSettings({}).dailyReviewLimit).toBe(50);
    expect(normalizeSettings({ dailyReviewLimit: 3 }).dailyReviewLimit).toBe(10);
    expect(normalizeSettings({ dailyReviewLimit: 999 }).dailyReviewLimit).toBe(200);
    expect(normalizeSettings({ dailyReviewLimit: 74 }).dailyReviewLimit).toBe(70);
  });

  it("keeps at least one review mode on", () => {
    const s = normalizeSettings({ reviewR1: false, reviewR2: false, reviewR3: false });
    expect([s.reviewR1, s.reviewR2, s.reviewR3]).toEqual([true, false, false]);
    expect(normalizeSettings({ reviewR2: false }).reviewR2).toBe(false);
  });
});
