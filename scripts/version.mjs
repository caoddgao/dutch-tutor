// Manual releases: require x.y.z; x.y.0 is formal, other patch versions are test builds.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

/** Validate an explicitly requested release; never guess or increment a version. */
export function releaseVersion(version, tags = []) {
  if (typeof version !== "string" || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version)) {
    throw new Error("请指定版本号，例如 --version 1.1.0（x.y.0 正式版，其余测试版）");
  }
  if (tags.some((tag) => tag.trim() === `v${version}`)) {
    throw new Error(`版本 v${version} 已存在，请使用新的版本号`);
  }
  return version;
}

/** @param {string} version */
export function writeTauriVersion(version, file = "src-tauri/tauri.conf.json") {
  const conf = JSON.parse(readFileSync(file, "utf8"));
  conf.version = version;
  writeFileSync(file, JSON.stringify(conf, null, 2) + "\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const { values } = parseArgs({ options: { version: { type: "string" }, write: { type: "boolean" } } });
  const tags = execFileSync("git", ["tag", "--list"], { encoding: "utf8" }).split("\n");
  const version = releaseVersion(values.version, tags);
  if (values.write) writeTauriVersion(version);
  process.stdout.write(version + "\n");
}
