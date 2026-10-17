// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";

it("labels only the current Windows installer without changing its contents or installed product identity", () => {
  const root = mkdtempSync(join(tmpdir(), "dutch-family-installer-"));
  try {
    const dir = join(root, "src-tauri/target/release/bundle/nsis");
    mkdirSync(dir, { recursive: true });
    const config = { version: "1.1.0", productName: "Dutch Tutor", identifier: "nl.dutchtutor.app" };
    const conf = join(root, "src-tauri/tauri.conf.json");
    writeFileSync(conf, JSON.stringify(config));
    writeFileSync(join(dir, "Dutch Tutor_1.1.0_x64-setup.exe"), "fixture installer");
    writeFileSync(join(dir, "Dutch Tutor_1.0.0_x64-setup.exe"), "older installer");
    execFileSync(process.execPath, [join(import.meta.dirname, "name-family-installer.mjs")], { cwd: root });
    expect(readFileSync(join(dir, "Dutch Tutor_1.1.0_x64-家庭版-setup.exe"), "utf8")).toBe("fixture installer");
    expect(readFileSync(join(dir, "Dutch Tutor_1.0.0_x64-setup.exe"), "utf8")).toBe("older installer");
    expect(JSON.parse(readFileSync(conf, "utf8"))).toEqual(config);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
