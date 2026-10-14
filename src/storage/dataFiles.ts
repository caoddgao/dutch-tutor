// Where exported files go and imported files come from (backups, content reports, Excel tables).
// Desktop app: the system save / open dialogs and small Rust commands (src-tauri/src/backup.rs).
// Browser dev server: a download and a file picker.
import { invoke, isTauri } from "@tauri-apps/api/core";
import { XLSX_MIME } from "./workbook";

export interface DataFiles {
  /** Asks where to save and writes the text; false when the learner cancels. */
  exportText(defaultName: string, text: string, title: string): Promise<boolean>;
  /** Same for an Excel workbook (`.xlsx`). */
  exportWorkbook(defaultName: string, bytes: Uint8Array, title: string): Promise<boolean>;
  /** Asks for a backup file and returns its text; null when the learner cancels. */
  importText(title: string): Promise<string | null>;
  /** Keeps a copy of the current data inside the app data folder before a restore. */
  saveSafetyCopy(stamp: string, text: string): Promise<void>;
}

const JSON_FILTER = [{ name: "备份文件", extensions: ["json"] }];
const XLSX_FILTER = [{ name: "Excel 表格", extensions: ["xlsx"] }];

function download(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function createTauriDataFiles(): DataFiles {
  return {
    async exportText(defaultName, text, title) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({ title, defaultPath: defaultName, filters: JSON_FILTER });
      if (!path) return false;
      await invoke("write_export_file", { path, text });
      return true;
    },
    async exportWorkbook(defaultName, bytes, title) {
      const { save } = await import("@tauri-apps/plugin-dialog");
      const path = await save({ title, defaultPath: defaultName, filters: XLSX_FILTER });
      if (!path) return false;
      await invoke("write_export_file", { path, bytes: Array.from(bytes) });
      return true;
    },
    async importText(title) {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const path = await open({ title, multiple: false, directory: false, filters: JSON_FILTER });
      if (typeof path !== "string") return null;
      return invoke<string>("read_backup_file", { path });
    },
    saveSafetyCopy: (stamp, text) => invoke("save_safety_backup", { stamp, text }),
  };
}

export function createBrowserDataFiles(): DataFiles {
  const safety: string[] = [];
  return {
    async exportText(defaultName, text) {
      download(defaultName, new Blob([text], { type: "application/json" }));
      return true;
    },
    async exportWorkbook(defaultName, bytes) {
      download(defaultName, new Blob([bytes as Uint8Array<ArrayBuffer>], { type: XLSX_MIME }));
      return true;
    },
    importText() {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file";
        input.accept = ".json,application/json";
        input.addEventListener("change", () => {
          const file = input.files?.[0];
          if (!file) resolve(null);
          else file.text().then(resolve, () => resolve(null));
        });
        input.addEventListener("cancel", () => resolve(null));
        input.click();
      });
    },
    async saveSafetyCopy(_stamp, text) {
      safety.push(text);
    },
  };
}

export function createDefaultDataFiles(): DataFiles {
  return isTauri() ? createTauriDataFiles() : createBrowserDataFiles();
}
