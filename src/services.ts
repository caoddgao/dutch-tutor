import type { RecordingFiles } from "./audio/recordings";
import type { ContentBundle } from "./content/ownTypes";
import type { PackBackend } from "./pack/backend";
import type { SqlDb } from "./storage/db";
import type { SettingsStore } from "./storage/settingsStore";

/** Everything the app talks to outside React; tests pass in-memory versions. */
export interface AppServices {
  settings: SettingsStore;
  /** Learning data (progress, reviews, recordings) */
  db: () => Promise<SqlDb>;
  pack: PackBackend;
  content: ContentBundle;
  /** Our synthesized audio: cache key → URL */
  ttsUrls: Record<string, string>;
  recordingFiles: RecordingFiles;
}
