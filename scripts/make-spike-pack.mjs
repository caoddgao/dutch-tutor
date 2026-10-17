// android-spike only (batch 2): writes a fake ~350 MB pack to spike-pack/ (git-ignored) so the
// APK size, install and first-launch copy can be measured without the real Naar Nederland pack.
// Usage: node scripts/make-spike-pack.mjs [megabytes]
import { createHash, randomBytes } from "node:crypto";
import { copyFileSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = "spike-pack";
const megabytes = Number(process.argv[2] ?? 350);
// about the size of a sentence recording; random bytes do not compress, like real mp3
const FILE_SIZE = 194_000;
const count = Math.round((megabytes * 1024 * 1024) / FILE_SIZE);

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, "audio"), { recursive: true });
/** @type {string[]} */
const index = [];
/** @param {string} rel @param {Buffer} data */
const put = (rel, data) => {
  writeFileSync(join(OUT, rel), data);
  index.push(`${rel}\t${createHash("sha256").update(data).digest("hex")}`);
};

put("manifest.json", Buffer.from(JSON.stringify({ spike: true, files: count + 2 })));
// one real, playable clip (our own synthesized audio) for the <audio> test
const tts = readdirSync("content/audio/tts").find((f) => f.endsWith(".mp3"));
if (!tts) throw new Error("no mp3 in content/audio/tts");
copyFileSync(join("content/audio/tts", tts), join(OUT, "audio/sample.mp3"));
index.push(
  `audio/sample.mp3\t${createHash("sha256")
    .update(readFileSync(join(OUT, "audio/sample.mp3")))
    .digest("hex")}`,
);
for (let i = 0; i < count; i++) put(`audio/fake-${String(i).padStart(4, "0")}.mp3`, randomBytes(FILE_SIZE));
writeFileSync(join(OUT, "index.txt"), index.join("\n") + "\n");
console.log(`${OUT}/: ${index.length} files, ${((count * FILE_SIZE) / 1024 / 1024).toFixed(0)} MB`);
