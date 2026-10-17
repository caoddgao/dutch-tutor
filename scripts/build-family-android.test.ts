// @vitest-environment node
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { apkName, familyIndex, versionCode } from "./build-family-android.mjs";

it("gives every later build a larger versionCode than Tauri's default and the previous build", () => {
  const first = versionCode(new Date("2026-10-17T12:00:00Z"));
  expect(first).toBe(10_000_000 + 289 * 24 * 60 + 12 * 60);
  expect(versionCode(new Date("2026-10-17T12:01:00Z"))).toBe(first + 1);
  expect(first).toBeGreaterThan(1_001_000);
  expect(versionCode(new Date("2100-01-01T00:00:00Z"))).toBeLessThan(2_100_000_000);
  expect(apkName("1.1.0", first)).toBe(`Dutch Tutor_1.1.0_家庭版_${first}.apk`);
});

it("lists pack and recording files with hashes, skipping pack qa material", () => {
  const family = mkdtempSync(join(tmpdir(), "dutch-family-android-"));
  try {
    mkdirSync(join(family, "nn-pack/lessons"), { recursive: true });
    mkdirSync(join(family, "nn-pack/qa"), { recursive: true });
    mkdirSync(join(family, "recordings"), { recursive: true });
    writeFileSync(join(family, "nn-pack/manifest.json"), "{}");
    writeFileSync(join(family, "nn-pack/lessons/NN21.json"), "{}");
    writeFileSync(join(family, "nn-pack/qa/report.txt"), "debug");
    writeFileSync(join(family, "recordings/voice.webm"), "voice");
    writeFileSync(join(family, "notes.txt"), "not bundled for the app");
    const lines = familyIndex(family).trimEnd().split("\n");
    expect(lines.map((line) => line.split("\t")[0])).toEqual([
      "nn-pack/lessons/NN21.json",
      "nn-pack/manifest.json",
      "recordings/voice.webm",
    ]);
    expect(lines[2].split("\t")[1]).toMatch(/^[0-9a-f]{64}$/);
    expect(familyIndex(join(family, "missing"))).toBe("");
  } finally {
    rmSync(family, { recursive: true, force: true });
  }
});
