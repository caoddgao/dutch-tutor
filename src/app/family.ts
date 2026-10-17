import { invoke } from "@tauri-apps/api/core";
import { RecordingStore } from "../audio/recordings";
import type { AppServices } from "../services";

interface BundledRecordings {
  dir: string;
  revision: string;
}

/** Complete before providers read the pack/voice index. Best effort; manual imports remain available. */
export async function importFamilyResources(services: Pick<AppServices, "db" | "recordingFiles">): Promise<void> {
  try {
    const bundle = await invoke<BundledRecordings | null>("prepare_family", { now: new Date().toISOString() });
    if (!bundle) return;
    const recordings = new RecordingStore(services.db, services.recordingFiles);
    await recordings.importFolder(bundle.dir, { voiceOnly: true });
    await invoke("finish_family_recordings", { revision: bundle.revision });
  } catch {
    // A malformed resource or failed copy never prevents the window from opening.
    // No receipt on failure: try again next launch; settings still allow a manual import.
  }
}
