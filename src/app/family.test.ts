// @vitest-environment node
import { invoke } from "@tauri-apps/api/core";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RecordingStore, type RecordingFiles } from "../audio/recordings";
import { createTestDb } from "../storage/testDb";
import { importFamilyResources } from "./family";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn(), convertFileSrc: (path: string) => path }));

const bundle = { dir: "/resources/family/recordings", revision: "revision-1" };
const transfer = (path = "/recordings/new.webm") => ({
  recordings: [{ audio_id: "P01-S01", file_name: "voice.webm", file_path: path, duration: 2 }],
  marks: [{ target_id: "P01-S02", target_type: "sentence" }],
});
const files = (): RecordingFiles => ({
  write: vi.fn(async () => "/unused"),
  remove: vi.fn(async () => undefined),
  url: (path) => path,
});

beforeEach(() => vi.resetAllMocks());

describe("family startup", () => {
  it("leaves ordinary installs alone without even opening the database", async () => {
    vi.mocked(invoke).mockResolvedValue(null);
    const db = vi.fn();
    await importFamilyResources({ db, recordingFiles: files() });
    expect(db).not.toHaveBeenCalled();
    expect(invoke).toHaveBeenCalledExactlyOnceWith("prepare_family", { now: expect.any(String) });
  });

  it("imports first-install voice audio and acknowledges it only after it is indexed", async () => {
    const { db, raw } = createTestDb();
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "prepare_family") return bundle;
      if (command === "import_recording_folder") return transfer();
      return undefined;
    });
    await importFamilyResources({ db: async () => db, recordingFiles: files() });
    expect(raw.prepare("SELECT kind, file_path FROM recordings").all()).toEqual([
      { kind: "voice", file_path: "/recordings/new.webm" },
    ]);
    expect(invoke).toHaveBeenLastCalledWith("finish_family_recordings", { revision: bundle.revision });
    expect(raw.prepare("SELECT * FROM feedback").all()).toEqual([]);
  });

  it("replaces matching voice recordings while preserving practice, other voices and all learning data", async () => {
    const { db, raw } = createTestDb();
    raw.exec(`
      INSERT INTO recordings (audio_id, kind, file_path, assessment)
        VALUES ('P01-S01', 'practice', '/recordings/practice.webm', '{"total":90}'),
               ('P01-S01', 'voice', '/recordings/old.webm', NULL),
               ('P01-S03', 'voice', '/recordings/other.webm', NULL);
      INSERT INTO lesson_progress (lesson_id, status) VALUES ('P01', 'studied');
      INSERT INTO review_items (item_id, item_type, lesson_id, due_at) VALUES ('P01-S01', 'sentence', 'P01', '2026-10-20');
      INSERT INTO review_log (item_id, mode, result, source, reviewed_at) VALUES ('P01-S01', 'R1', 'good', 'daily', '2026-10-17');
      INSERT INTO study_days (day, sentences_learned) VALUES ('2026-10-17', 5);
      INSERT INTO feedback (target_type, target_id, category) VALUES ('sentence', 'P01-S04', 'unnatural');
      INSERT INTO settings (key, value) VALUES ('theme', '"dark"');
    `);
    const tables = [
      "lesson_progress",
      "review_items",
      "review_log",
      "study_days",
      "feedback",
      "settings",
      "exam_results",
      "hard_sentences",
    ];
    const dump = () => tables.map((table) => raw.prepare(`SELECT * FROM ${table}`).all());
    const before = dump();
    const practice = raw.prepare("SELECT * FROM recordings WHERE kind = 'practice'").all();
    const recordingFiles = files();
    let update = 1;
    vi.mocked(invoke).mockImplementation(async (command) => {
      if (command === "prepare_family") return { ...bundle, revision: `revision-${update}` };
      if (command === "import_recording_folder") return transfer(`/recordings/new-${update}.webm`);
    });
    const services = { db: async () => db, recordingFiles };
    await importFamilyResources(services);
    update = 2;
    await importFamilyResources(services);
    expect(raw.prepare("SELECT file_path FROM recordings WHERE audio_id = 'P01-S01' AND kind = 'voice'").all()).toEqual(
      [{ file_path: "/recordings/new-2.webm" }],
    );
    expect(raw.prepare("SELECT * FROM recordings WHERE kind = 'practice'").all()).toEqual(practice);
    expect(raw.prepare("SELECT file_path FROM recordings WHERE audio_id = 'P01-S03'").get()).toEqual({
      file_path: "/recordings/other.webm",
    });
    expect(dump()).toEqual(before);
    expect(recordingFiles.remove).toHaveBeenCalledTimes(2);
    expect(recordingFiles.remove).toHaveBeenNthCalledWith(1, "/recordings/old.webm");
    expect(recordingFiles.remove).toHaveBeenNthCalledWith(2, "/recordings/new-1.webm");
  });

  it("settles after resource, copy or database failures, without acknowledging a failed import", async () => {
    for (const failure of ["prepare_family", "import_recording_folder", "database"]) {
      vi.mocked(invoke)
        .mockReset()
        .mockImplementation(async (command) => {
          if (command === failure) throw new Error("unavailable");
          if (command === "prepare_family") return bundle;
          if (command === "import_recording_folder") return transfer();
        });
      const db = vi.fn().mockRejectedValue(new Error("database"));
      await expect(importFamilyResources({ db, recordingFiles: files() })).resolves.toBeUndefined();
      expect(vi.mocked(invoke).mock.calls.some(([command]) => command === "finish_family_recordings")).toBe(false);
    }
  });

  it("keeps manual folder imports available with their existing marks behavior", async () => {
    const { db, raw } = createTestDb();
    vi.mocked(invoke).mockResolvedValue(transfer());
    await new RecordingStore(async () => db, files()).importFolder("/manual/export");
    expect(invoke).toHaveBeenCalledWith("import_recording_folder", { dir: "/manual/export" });
    expect(raw.prepare("SELECT target_id, category FROM feedback").all()).toEqual([
      { target_id: "P01-S02", category: "unnatural" },
    ]);
  });
});
