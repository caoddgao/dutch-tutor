// android-spike only (batch 2): temporary page that exercises the real commands on the phone.
import { convertFileSrc, invoke } from "@tauri-apps/api/core";
import Database from "@tauri-apps/plugin-sql";
import { startRecording } from "../src/audio/recorder";
import { recordingToWav } from "../src/pronunciation/wav";

const pageMs = performance.now();
const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const show = (id: string, text: string, ok?: boolean) => {
  const el = $(id);
  el.textContent = text;
  el.className = ok === undefined ? "" : ok ? "ok" : "bad";
};
const fmt = (e: unknown) => (e instanceof Error ? `${e.name}: ${e.message}` : JSON.stringify(e));
const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;

let recordingPath = "";
let packDir = "";

$("env").textContent = `${navigator.userAgent}\n${innerWidth}×${innerHeight} @${devicePixelRatio}x`;

// G: timings once the page script runs (the cold-start figure is since_process_ms)
invoke<Record<string, number | null>>("spike_startup", { pageMs })
  .then((t) => {
    const s = (v: number | null | undefined) => (v == null ? "?" : `${(v / 1000).toFixed(2)} 秒`);
    show(
      "g",
      `从进程启动到页面脚本运行：${s(t.since_process_ms)}\n` +
        `Rust 启动→窗口：${s(t.setup_ms)}；→开始加载页面：${s(t.page_start_ms)}；页面自身：${s(t.page_ms)}`,
      true,
    );
  })
  .catch((e) => show("g", fmt(e), false));

// B: the real DB URL, so the app's migrations run; a launch counter shows persistence
(async () => {
  try {
    const db = await Database.load("sqlite:dutchtutor.db");
    const migrations = await db.select<{ version: number }[]>("SELECT version FROM _sqlx_migrations ORDER BY version");
    await db.execute(
      `INSERT INTO settings (key, value) VALUES ('spike_launches', '1')
       ON CONFLICT(key) DO UPDATE SET value = CAST(value AS INTEGER) + 1,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`,
    );
    const [row] = await db.select<{ value: string; updated_at: string }[]>(
      "SELECT value, updated_at FROM settings WHERE key = 'spike_launches'",
    );
    show(
      "b",
      `迁移已执行：${migrations.map((m) => m.version).join(", ")}\n第 ${row.value} 次打开（关掉再开应加 1）\n${row.updated_at}`,
      true,
    );
  } catch (e) {
    show("b", fmt(e), false);
  }
})();

// C: the app's own recorder and WAV conversion
$("c-run").onclick = async () => {
  try {
    show("c", "请求麦克风…");
    const active = await startRecording();
    show("c", "录音中，请说话（3 秒）…");
    await new Promise((r) => setTimeout(r, 3000));
    const rec = await active.stop();
    const raw = $<HTMLAudioElement>("c-raw");
    raw.src = URL.createObjectURL(rec.blob);
    raw.hidden = false;
    let text = `原始格式：${rec.mime}，${(rec.blob.size / 1024).toFixed(1)} KB，${rec.duration.toFixed(2)} 秒`;
    try {
      const wav = await recordingToWav(rec.blob);
      const rate = new DataView(wav.bytes.buffer).getUint32(24, true);
      text += `\n转 WAV：${rate} Hz，${(wav.bytes.length / 1024).toFixed(1)} KB，${wav.duration.toFixed(2)} 秒`;
      const audio = $<HTMLAudioElement>("c-wav");
      audio.src = URL.createObjectURL(new Blob([wav.bytes as BlobPart], { type: "audio/wav" }));
      audio.hidden = false;
      recordingPath = await invoke<string>("save_recording", wav.bytes, { headers: { "x-name": "spike-test.wav" } });
      text += `\n已存：${recordingPath}`;
      show("c", text, true);
    } catch (e) {
      show("c", `${text}\n转 WAV 失败：${fmt(e)}`, false);
    }
  } catch (e) {
    show("c", fmt(e), false);
  }
};

// D: APK asset → app data, through the NDK AssetManager
interface CopyReport {
  resource_dir: string;
  std_fs: string;
  dest: string;
  files: number;
  bytes: number;
  copy_ms: number;
  verify_ms: number;
  bad: string[];
}
$("d-run").onclick = async () => {
  show("d", "复制中…");
  try {
    const r = await invoke<CopyReport>("spike_copy_pack");
    packDir = r.dest;
    show(
      "d",
      `${r.files} 个文件，${mb(r.bytes)}\n复制 ${(r.copy_ms / 1000).toFixed(1)} 秒；校验 ${(r.verify_ms / 1000).toFixed(1)} 秒；` +
        `校验不符 ${r.bad.length} 个${r.bad.length ? `（${r.bad.slice(0, 3).join(", ")}）` : ""}\n` +
        `目标：${r.dest}\nresource_dir：${r.resource_dir}\nstd::fs 读 resource_dir：${r.std_fs}`,
      r.bad.length === 0,
    );
  } catch (e) {
    show("d", fmt(e), false);
  }
};

// E: the real Azure connection test with a fake key (no real key leaves this machine)
$("e-run").onclick = async () => {
  show("e", "连接中…");
  try {
    await invoke("save_azure_config", { region: "westeurope", key: "spike-fake-key-0000", enabled: false });
    await invoke("test_azure_connection");
    show("e", "意外：假密钥被接受", false);
  } catch (e) {
    const code = (e as { code?: string }).code;
    show("e", code === "invalid_key" ? "通：服务器回答“密钥无效”（invalid_key）" : `失败：${fmt(e)}`, code === "invalid_key");
  } finally {
    await invoke("clear_azure_key").catch(() => {});
  }
};

// F: <audio> on files in app data, through the asset protocol scope in tauri.conf.json
const tryPlay = (id: string, path: string) =>
  new Promise<string>((resolve) => {
    const audio = $<HTMLAudioElement>(id);
    const url = convertFileSrc(path);
    audio.hidden = false;
    audio.onerror = () => resolve(`✗ ${path}\n  ${url}\n  错误码 ${audio.error?.code}`);
    audio.onplaying = () => resolve(`✓ 正在播放 ${path}\n  ${url}`);
    audio.src = url;
    audio.play().catch((e) => resolve(`✗ play(): ${fmt(e)}\n  ${url}`));
  });
$("f-run").onclick = async () => {
  const lines: string[] = [];
  lines.push(recordingPath ? await tryPlay("f-rec", recordingPath) : "（没有录音：先做 C）");
  lines.push(packDir ? await tryPlay("f-pack", `${packDir}/audio/sample.mp3`) : "（没有示例音频：先做 D）");
  show("f", lines.join("\n"), lines.every((l) => l.startsWith("✓")));
};
