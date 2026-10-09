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
}
