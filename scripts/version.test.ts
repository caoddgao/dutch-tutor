import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { releaseVersion, writeTauriVersion } from "./version.mjs";

describe("manual release versions", () => {
  it("accepts an explicit formal or test version across series", () => {
    for (const version of ["1.1.0", "1.1.1", "2.0.0", "0.1.12"]) {
      expect(releaseVersion(version, ["v1.0.0", "v1.0.9"])).toBe(version);
    }
  });

  it("refuses missing, malformed, or already released versions", () => {
    for (const version of [undefined, "", "v1.1.0", "1.1", "1.01.0", "1.1.0-beta", "1.1.0\n", "$(echo x)"]) {
      expect(() => releaseVersion(version)).toThrow();
    }
    expect(() => releaseVersion("1.1.0", ["v1.1.0"])).toThrow("已存在");
    expect(releaseVersion("1.1.0", ["v1.1.01", "v1.1.0-beta"])).toBe("1.1.0");
  });

  it("writes only the version, preserving the application identity and configuration", () => {
    const root = mkdtempSync(join(tmpdir(), "dutch-version-"));
    try {
      const file = join(root, "tauri.conf.json");
      const conf = { version: "1.0.0", identifier: "nl.dutchtutor.app", bundle: { targets: ["nsis"] } };
      writeFileSync(file, JSON.stringify(conf));
      writeTauriVersion("1.1.0", file);
      expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({ ...conf, version: "1.1.0" });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
