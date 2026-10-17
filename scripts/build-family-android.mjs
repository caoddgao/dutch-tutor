// npm run build:family:android — signed family APK with family/ (pack + voice recordings) inside.
// Local only (docs/ANDROID_BUILD.md): never in CI, family/ and the signing key never enter the repo.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Pack folders the app never reads (src-tauri/src/pack.rs SKIP_DIRS): bundled but not extracted. */
const SKIP_PACK_DIRS = ["qa"];
const VERSION_CODE_BASE = 10_000_000;
const VERSION_CODE_EPOCH = Date.UTC(2026, 0, 1);

/** Minutes since 2026-01-01 UTC on top of 10,000,000: every build is newer than the last one
 * (Android refuses to update to a smaller versionCode) without a counter file to lose.
 * @param {Date} now */
export function versionCode(now) {
  return VERSION_CODE_BASE + Math.floor((now.getTime() - VERSION_CODE_EPOCH) / 60_000);
}

/** @param {string} version @param {number} code */
export function apkName(version, code) {
  return `Dutch Tutor_${version}_家庭版_${code}.apk`;
}

/** @param {string} dir @returns {string[]} */
function walk(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path);
    return entry.isFile() ? [path] : [];
  });
}

/** One `path<TAB>sha256` line per file the app extracts (src-tauri/src/family.rs). Paths use `/`.
 * @param {string} family */
export function familyIndex(family) {
  const lines = [];
  for (const part of ["nn-pack", "recordings"]) {
    const root = join(family, part);
    if (!existsSync(root)) continue;
    for (const file of walk(root).sort()) {
      const rel = relative(family, file).split(/[\\/]/);
      if (part === "nn-pack" && SKIP_PACK_DIRS.includes(rel[1]) && rel.length > 2) continue;
      lines.push(`${rel.join("/")}\t${createHash("sha256").update(readFileSync(file)).digest("hex")}`);
    }
  }
  return lines.length ? lines.join("\n") + "\n" : "";
}

/** @param {string} message @returns {never} */
function fail(message) {
  console.error(message);
  process.exit(1);
}

function main() {
  const root = resolve(fileURLToPath(import.meta.url), "../..");
  const family = join(root, "family");
  const signing = process.env.DUTCH_TUTOR_SIGNING ?? join(homedir(), "DutchTutorSigning", "keystore.properties");
  if (!existsSync(signing)) fail(`找不到签名配置：${signing}\n请按 docs/ANDROID_BUILD.md 第五节准备签名文件。`);
  if (!existsSync(join(family, "nn-pack/manifest.json")) && !existsSync(join(family, "recordings"))) {
    fail(
      "family/ 里没有资料包（nn-pack/manifest.json）也没有录音（recordings/），请先按 docs/FAMILY_BUILD.md 第三节放好。",
    );
  }

  const index = familyIndex(family);
  const { version } = JSON.parse(readFileSync(join(root, "src-tauri/tauri.conf.json"), "utf8"));
  const code = versionCode(new Date());
  const work = join(root, "src-tauri/target/family-android");
  mkdirSync(work, { recursive: true });
  writeFileSync(join(work, "family-index.txt"), index);
  const config = join(work, "tauri.family.android.conf.json");
  writeFileSync(
    config,
    JSON.stringify({
      bundle: {
        resources: { "../family/": "family/", "target/family-android/family-index.txt": "family-index.txt" },
        android: { versionCode: code },
      },
    }),
  );
  // Gradle packs whatever sits in assets/: drop leftovers from earlier builds (spike data, old family files).
  rmSync(join(root, "src-tauri/gen/android/app/src/main/assets"), { recursive: true, force: true });

  console.log(
    `打包家庭版 apk：版本 ${version}，versionCode ${code}，${index.split("\n").length - 1} 个资料 / 录音文件`,
  );
  const tauri = join(root, "node_modules/@tauri-apps/cli/tauri.js");
  const build = spawnSync(
    process.execPath,
    [tauri, "android", "build", "--apk", "--target", "aarch64", "--config", config],
    { cwd: root, stdio: "inherit" },
  );
  if (build.status !== 0) fail("打包失败，请把上面的报错发给施工方。");

  const built = join(root, "src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk");
  const sdk = process.env.ANDROID_HOME ?? join(homedir(), "AppData/Local/Android/Sdk");
  const tools = existsSync(join(sdk, "build-tools")) ? readdirSync(join(sdk, "build-tools")).sort().reverse() : [];
  const apksigner = tools.map((v) => join(sdk, "build-tools", v, "lib/apksigner.jar")).find(existsSync);
  if (!apksigner) fail("找不到 apksigner，无法确认 apk 已签名。请按 docs/ANDROID_BUILD.md 第二节安装 build-tools。");
  const java = process.env.JAVA_HOME ? join(process.env.JAVA_HOME, "bin/java") : "java";
  const verify = spawnSync(java, ["-jar", apksigner, "verify", built], { stdio: "inherit" });
  if (verify.status !== 0) fail("apk 没有正确签名，请把上面的报错发给施工方。");

  const out = join(root, "release-apk");
  mkdirSync(out, { recursive: true });
  const target = join(out, apkName(version, code));
  copyFileSync(built, target);
  console.log(`家庭版 apk：${target}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
