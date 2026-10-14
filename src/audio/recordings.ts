// Learner recordings: practice takes (last 3 per item, design §5.3) and real-voice sources (priority 1, §5.1).
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import type { SqlDb } from "../storage/db";
import { extensionFor, type Recording } from "./recorder";

export const KEEP_TAKES = 3;

export interface Take {
  id: number;
  audioId: string;
  url: string;
  duration: number;
  createdAt: string;
}

/** Where recording files go. */
export interface RecordingFiles {
  /** Stores the bytes, returns what goes into recordings.file_path */
  write(name: string, blob: Blob): Promise<string>;
  remove(filePath: string): Promise<void>;
  url(filePath: string): string;
}

export function createTauriRecordingFiles(): RecordingFiles {
  return {
    async write(name, blob) {
      const bytes = new Uint8Array(await blob.arrayBuffer());
      return invoke<string>("save_recording", bytes, { headers: { "x-name": name } });
    },
    async remove(filePath) {
      const name = filePath.split(/[\\/]/).pop() ?? "";
      await invoke("delete_recording", { name });
    },
    url: (filePath) => convertFileSrc(filePath),
  };
}

/** Browser dev server and tests: object URLs, gone after a reload. */
export function createMemoryRecordingFiles(): RecordingFiles {
  return {
    async write(_name, blob) {
      return URL.createObjectURL(blob);
    },
    async remove(filePath) {
      if (filePath.startsWith("blob:")) URL.revokeObjectURL(filePath);
    },
    url: (filePath) => filePath,
  };
}

export function createDefaultRecordingFiles(): RecordingFiles {
  return isTauri() ? createTauriRecordingFiles() : createMemoryRecordingFiles();
}

interface Row {
  id: number;
  audio_id: string;
  file_path: string;
  duration: number | null;
  created_at: string;
}

interface MarkRow {
  target_id: string;
  target_type: "sentence" | "word";
}
interface TransferEntry {
  audio_id: string;
  file_name: string;
  file_path?: string;
  duration: number | null;
}
interface TransferMark {
  target_id: string;
  target_type: "sentence" | "word";
}
interface ImportResult {
  recordings: TransferEntry[];
  marks: TransferMark[];
}

const safeId = (audioId: string) => audioId.replace(/[^A-Za-z0-9_-]/g, "_");

export class RecordingStore {
  constructor(
    private readonly db: () => Promise<SqlDb>,
    private readonly files: RecordingFiles,
  ) {}

  private toTake(r: Row): Take {
    return {
      id: r.id,
      audioId: r.audio_id,
      url: this.files.url(r.file_path),
      duration: r.duration ?? 0,
      createdAt: r.created_at,
    };
  }

  async takes(audioId: string): Promise<Take[]> {
    const db = await this.db();
    const rows = await db.select<Row[]>(
      "SELECT id, audio_id, file_path, duration, created_at FROM recordings WHERE audio_id = $1 AND kind = 'practice' ORDER BY id DESC",
      [audioId],
    );
    return rows.map((r) => this.toTake(r));
  }

  /** Saves a practice take and keeps only the newest three. */
  async savePractice(audioId: string, rec: Recording): Promise<Take> {
    const db = await this.db();
    const name = `${safeId(audioId)}_${Date.now()}.${extensionFor(rec.mime)}`;
    const path = await this.files.write(name, rec.blob);
    await db.execute("INSERT INTO recordings (audio_id, kind, file_path, duration) VALUES ($1, 'practice', $2, $3)", [
      audioId,
      path,
      rec.duration,
    ]);
    const rows = await db.select<Row[]>(
      "SELECT id, audio_id, file_path, duration, created_at FROM recordings WHERE audio_id = $1 AND kind = 'practice' ORDER BY id DESC",
      [audioId],
    );
    for (const old of rows.slice(KEEP_TAKES)) {
      await this.files.remove(old.file_path).catch(() => undefined);
      await db.execute("DELETE FROM recordings WHERE id = $1", [old.id]);
    }
    return this.toTake(rows[0]);
  }

  /** Newest real-voice recording per audio_id (recording mode, stage 5). */
  async voiceUrls(): Promise<Map<string, string>> {
    const db = await this.db();
    const rows = await db.select<Row[]>(
      "SELECT id, audio_id, file_path, duration, created_at FROM recordings WHERE kind = 'voice' ORDER BY id",
    );
    const map = new Map<string, string>();
    for (const r of rows) map.set(r.audio_id, this.files.url(r.file_path));
    return map;
  }

  /** One approved voice per audio ID; practice takes are unaffected. */
  async saveVoice(audioId: string, rec: Recording): Promise<Take> {
    const db = await this.db();
    const name = `${safeId(audioId)}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${extensionFor(rec.mime)}`;
    const path = await this.files.write(name, rec.blob);
    try {
      const previous = await db.select<Row[]>(
        "SELECT id, audio_id, file_path, duration, created_at FROM recordings WHERE audio_id = $1 AND kind = 'voice'",
        [audioId],
      );
      await db.execute("INSERT INTO recordings (audio_id, kind, file_path, duration) VALUES ($1, 'voice', $2, $3)", [
        audioId,
        path,
        rec.duration,
      ]);
      for (const old of previous) {
        await db.execute("DELETE FROM recordings WHERE id = $1", [old.id]);
        await this.files.remove(old.file_path).catch(() => undefined);
      }
      const [row] = await db.select<Row[]>(
        "SELECT id, audio_id, file_path, duration, created_at FROM recordings WHERE audio_id = $1 AND kind = 'voice' ORDER BY id DESC LIMIT 1",
        [audioId],
      );
      return this.toTake(row);
    } catch (error) {
      await this.files.remove(path).catch(() => undefined);
      throw error;
    }
  }

  async unnaturalIds(): Promise<Set<string>> {
    const db = await this.db();
    const rows = await db.select<MarkRow[]>("SELECT target_id, target_type FROM feedback WHERE category = 'unnatural'");
    return new Set(rows.map((r) => r.target_id));
  }

  async markUnnatural(audioId: string, kind: "sentence" | "word", marked: boolean): Promise<void> {
    const db = await this.db();
    if (marked) {
      const rows = await db.select<MarkRow[]>(
        "SELECT target_id, target_type FROM feedback WHERE category = 'unnatural' AND target_id = $1",
        [audioId],
      );
      if (!rows.length)
        await db.execute("INSERT INTO feedback (target_type, target_id, category) VALUES ($1, $2, 'unnatural')", [
          kind,
          audioId,
        ]);
    } else {
      await db.execute("DELETE FROM feedback WHERE category = 'unnatural' AND target_id = $1", [audioId]);
    }
  }

  async exportFolder(dir: string): Promise<void> {
    const db = await this.db();
    const rows = await db.select<Row[]>(
      "SELECT id, audio_id, file_path, duration, created_at FROM recordings WHERE kind = 'voice' ORDER BY id",
    );
    const latest = new Map(rows.map((r) => [r.audio_id, r]));
    const marks = await db.select<MarkRow[]>(
      "SELECT target_id, target_type FROM feedback WHERE category = 'unnatural'",
    );
    await invoke("export_recording_folder", {
      dir,
      recordings: [...latest.values()].map((r) => ({
        audio_id: r.audio_id,
        file_name: r.file_path.split(/[\\/]/).pop()!,
        duration: r.duration,
      })),
      marks,
    });
  }

  async importFolder(dir: string): Promise<void> {
    const result = await invoke<ImportResult>("import_recording_folder", { dir });
    const db = await this.db();
    for (const row of result.recordings) {
      if (!row.file_path) continue;
      const old = await db.select<Row[]>(
        "SELECT id, audio_id, file_path, duration, created_at FROM recordings WHERE kind = 'voice' AND audio_id = $1",
        [row.audio_id],
      );
      await db.execute("INSERT INTO recordings (audio_id, kind, file_path, duration) VALUES ($1, 'voice', $2, $3)", [
        row.audio_id,
        row.file_path,
        row.duration,
      ]);
      for (const previous of old) {
        await db.execute("DELETE FROM recordings WHERE id = $1", [previous.id]);
        await this.files.remove(previous.file_path).catch(() => undefined);
      }
    }
    for (const mark of result.marks) await this.markUnnatural(mark.target_id, mark.target_type, true);
  }
}
