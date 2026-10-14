import { describe, expect, it, vi } from "vitest";
import { createTestDb } from "../storage/testDb";
import { computePeaks } from "./peaks";
import { AudioPlayer } from "./player";
import { KEEP_TAKES, RecordingStore, type RecordingFiles } from "./recordings";
import { resolveAudio, type AudioUrls } from "./resolve";

const urls = (voice: Record<string, string> = {}, tts: Record<string, string> = {}): AudioUrls => ({
  voiceUrl: (id) => voice[id],
  packUrl: (rel) => `pack/${rel}`,
  ttsUrl: (v, t) => tts[`${v}|${t}`] ?? null,
});

describe("audio source priority (design §5.1)", () => {
  const ref = {
    id: "NN21-S01",
    nn: "audio/NN21/S01.mp3",
    tts: { voice: "F", text: "Dag" },
    packTts: "audio/tts/x.mp3",
  };

  it("real voice > original > synthesized > none", () => {
    expect(resolveAudio(ref, urls({ "NN21-S01": "voice.webm" }))).toEqual({ url: "voice.webm", source: "voice" });
    expect(resolveAudio(ref, urls())).toEqual({ url: "pack/audio/NN21/S01.mp3", source: "nn" });
    expect(resolveAudio({ ...ref, nn: undefined }, urls({}, { "F|Dag": "tts.mp3" }))).toEqual({
      url: "tts.mp3",
      source: "tts",
    });
    expect(resolveAudio({ id: "x", packTts: "audio/tts/x.mp3" }, urls())).toEqual({
      url: "pack/audio/tts/x.mp3",
      source: "tts",
    });
    expect(resolveAudio({ id: "x", tts: { voice: "F", text: "nope" } }, urls())).toBeNull();
    expect(resolveAudio(null, urls())).toBeNull();
  });

  it("skips the pack when it is not installed", () => {
    const none: AudioUrls = { ...urls(), packUrl: () => "" };
    expect(resolveAudio({ id: "x", nn: "a.mp3" }, none)).toBeNull();
  });
});

describe("waveform peaks", () => {
  it("takes the max per bucket and normalizes", () => {
    const samples = new Float32Array([0, 0.1, -0.5, 0.2, 0.25, 0, 0, -0.05]);
    expect(computePeaks(samples, 4).map((v) => Number(v.toFixed(3)))).toEqual([0.2, 1, 0.5, 0.1]);
    expect(computePeaks(new Float32Array(), 3)).toEqual([0, 0, 0]);
  });
});

describe("player", () => {
  it("plays slowly with pitch preserved and reports the end", async () => {
    const play = vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const p = new AudioPlayer();
    const states: boolean[] = [];
    p.subscribe((s) => states.push(s.playing));
    const done = p.play("a.mp3", { rate: 0.75, tag: "t" });
    const el = (p as unknown as { el: HTMLAudioElement }).el;
    expect(el.playbackRate).toBe(0.75);
    expect(el.preservesPitch).toBe(true);
    expect(p.getState()).toMatchObject({ playing: true, tag: "t" });
    el.dispatchEvent(new Event("ended"));
    await done;
    expect(p.getState().playing).toBe(false);
    expect(states).toEqual([true, false]);
    play.mockRestore();
  });

  it("a stopped sequence does not go on to the next item", async () => {
    vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue();
    vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => undefined);
    const p = new AudioPlayer();
    const seq = p.playSequence([{ url: "orig.mp3" }, { url: "mine.webm" }]);
    p.stop();
    await seq;
    expect(p.getState().url).toBe("orig.mp3");
  });
});

describe("recording store", () => {
  it("keeps the newest three takes per item and deletes older files", async () => {
    const { db } = createTestDb();
    const removed: string[] = [];
    let n = 0;
    const files: RecordingFiles = {
      write: async (name) => `/rec/${name}#${n++}`,
      remove: async (p) => void removed.push(p),
      url: (p) => `url:${p}`,
    };
    const store = new RecordingStore(async () => db, files);
    const rec = { blob: new Blob(["x"]), mime: "audio/webm;codecs=opus", duration: 1.5 };
    for (let i = 0; i < 5; i++) await store.savePractice("NN21-S01", rec);
    await store.savePractice("NN21-S02", rec);
    const takes = await store.takes("NN21-S01");
    expect(takes).toHaveLength(KEEP_TAKES);
    expect(takes[0].url).toMatch(/#4$/);
    expect(removed).toHaveLength(2);
    expect(removed[0]).toMatch(/#0$/);
    expect(takes[0].url).toMatch(/NN21-S01_\d+\.webm/);
  });

  it("finds real-voice recordings for the source priority", async () => {
    const { db, raw } = createTestDb();
    raw.exec("INSERT INTO recordings (audio_id, kind, file_path) VALUES ('NN21-S01', 'voice', '/v/a.webm')");
    const store = new RecordingStore(async () => db, { write: async () => "", remove: async () => {}, url: (p) => p });
    expect([...(await store.voiceUrls())]).toEqual([["NN21-S01", "/v/a.webm"]]);
  });

  it("replaces one approved voice without touching practice takes, and stores marks independently", async () => {
    const { db } = createTestDb();
    const removed: string[] = [];
    let n = 0;
    const store = new RecordingStore(async () => db, {
      write: async () => `/rec/${++n}.webm`,
      remove: async (path) => {
        removed.push(path);
      },
      url: (path) => path,
    });
    const rec = { blob: new Blob(["voice"]), mime: "audio/webm", duration: 1 };
    await store.markUnnatural("NN21-S01", "sentence", true);
    expect(await store.unnaturalIds()).toEqual(new Set(["NN21-S01"]));
    await store.savePractice("NN21-S01", rec);
    await store.saveVoice("NN21-S01", rec);
    await store.saveVoice("NN21-S01", rec);
    expect([...(await store.voiceUrls())]).toEqual([["NN21-S01", "/rec/3.webm"]]);
    expect(await store.takes("NN21-S01")).toHaveLength(1);
    expect(removed).toEqual(["/rec/2.webm"]);
    await store.markUnnatural("NN21-S01", "sentence", false);
    expect(await store.unnaturalIds()).toEqual(new Set());
  });
});
