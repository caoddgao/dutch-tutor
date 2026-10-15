// Release version helpers: 1.0.x, where x is one more than the highest existing v1.0.* tag
// (v1.0.0 is the first formal release; later builds from main are 1.0.1, 1.0.2 … pre-releases).
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

export const SERIES = "1.0";

/** @param {string[]} tags */
export function nextVersion(tags, series = SERIES) {
  const prefix = `v${series}.`;
  let max = -1;
  for (const tag of tags) {
    const t = tag.trim();
    if (!t.startsWith(prefix)) continue;
    const rest = t.slice(prefix.length);
    if (!/^\d+$/.test(rest)) continue;
    max = Math.max(max, Number(rest));
  }
  return `${series}.${max + 1}`;
}

/** @param {string} version */
export function writeTauriVersion(version, file = "src-tauri/tauri.conf.json") {
  const conf = JSON.parse(readFileSync(file, "utf8"));
  conf.version = version;
  writeFileSync(file, JSON.stringify(conf, null, 2) + "\n");
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const tags = execFileSync("git", ["tag", "--list", `v${SERIES}.*`], { encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
  const version = nextVersion(tags);
  if (process.argv.includes("--write")) writeTauriVersion(version);
  process.stdout.write(version + "\n");
}
