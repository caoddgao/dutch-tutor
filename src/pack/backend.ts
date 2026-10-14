// Where the resource pack comes from at runtime.
// Desktop app: the copy in the app data folder (Rust commands + asset protocol).
// Browser dev server: the self-written fixture pack, served by vite.config.ts at /__dev/pack/.
import { convertFileSrc, invoke, isTauri } from "@tauri-apps/api/core";
import type { PackManifest } from "../content/packTypes";

export interface PackInfo {
  /** Absolute folder of the installed pack */
  dir: string;
  manifest: PackManifest | null;
  source_dir: string | null;
  imported_at: string | null;
}

export interface PackErrorPayload {
  code: "not_a_pack" | "format_version" | "incomplete" | "same_dir" | "bad_json" | "bad_path" | "io" | "cancelled";
  detail: string;
}

export interface PackBackend {
  /** Can the user import a folder here? (false in the browser dev server) */
  canImport: boolean;
  info(): Promise<PackInfo>;
  readText(relPath: string): Promise<string>;
  /** URL an <audio> element can play */
  audioUrl(relPath: string): string;
  /** Reads a candidate folder's manifest (checks the format version) */
  inspect(dir: string): Promise<PackManifest>;
  importFrom(dir: string): Promise<PackInfo>;
  /** Folder picker; null when cancelled */
  pickFolder(): Promise<string | null>;
}

export function packErrorMessage(err: unknown): string {
  const e = err as Partial<PackErrorPayload> | undefined;
  switch (e?.code) {
    case "not_a_pack":
      return "这个文件夹不是资料包。请选择整理好的资料包文件夹（一般叫 nn-pack）。";
    case "format_version":
      return "这份资料包和现在的程序不配套。请更新程序，或换一份新整理的资料包。";
    case "incomplete":
      return "资料包不完整，缺了一些文件。请换一份完整的资料包再导入。";
    case "same_dir":
      return "选中的是程序里已导入的那份资料包，请选择原来的资料包文件夹。";
    case "bad_json":
      return "资料包里有文件读不出来，可能已损坏。请换一份资料包再导入。";
    default:
      return "导入失败：无法复制文件，请确认文件夹可以访问、磁盘空间足够。";
  }
}

function joinPath(dir: string, rel: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${sep}${rel.split("/").join(sep)}`;
}

export function createTauriPackBackend(): PackBackend {
  let dirPromise: Promise<string> | null = null;
  let dir = "";
  const info = async () => {
    const i = await invoke<PackInfo>("pack_info");
    dir = i.dir;
    return i;
  };
  return {
    canImport: true,
    info,
    readText: (path) => invoke<string>("read_pack_file", { path }),
    audioUrl(rel) {
      if (!dir) {
        dirPromise ??= info().then((i) => i.dir);
        return "";
      }
      return convertFileSrc(joinPath(dir, rel));
    },
    inspect: (d) => invoke<PackManifest>("inspect_pack", { dir: d }),
    importFrom: (d) => invoke<PackInfo>("import_pack", { dir: d, now: new Date().toISOString() }),
    async pickFolder() {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const picked = await open({ directory: true, multiple: false, title: "选择资料包文件夹（nn-pack）" });
      return typeof picked === "string" ? picked : null;
    },
  };
}

export const DEV_PACK_BASE = "/__dev/pack/";

/** Browser dev server: the fixture pack, always "installed". */
export function createHttpPackBackend(base = DEV_PACK_BASE): PackBackend {
  const readText = async (rel: string) => {
    const res = await fetch(base + rel);
    if (!res.ok) throw { code: "io", detail: `${res.status} ${rel}` } satisfies PackErrorPayload;
    return res.text();
  };
  return {
    canImport: false,
    async info() {
      const manifest = JSON.parse(await readText("manifest.json")) as PackManifest;
      return { dir: base, manifest, source_dir: null, imported_at: null };
    },
    readText,
    audioUrl: (rel) => base + rel,
    inspect: async () => {
      throw { code: "io", detail: "not available" } satisfies PackErrorPayload;
    },
    importFrom: async () => {
      throw { code: "io", detail: "not available" } satisfies PackErrorPayload;
    },
    pickFolder: async () => null,
  };
}

/** No pack at all (production build opened in a plain browser). */
export function createEmptyPackBackend(): PackBackend {
  return {
    canImport: false,
    info: async () => ({ dir: "", manifest: null, source_dir: null, imported_at: null }),
    readText: async (rel) => {
      throw { code: "io", detail: rel } satisfies PackErrorPayload;
    },
    audioUrl: () => "",
    inspect: async () => {
      throw { code: "io", detail: "" } satisfies PackErrorPayload;
    },
    importFrom: async () => {
      throw { code: "io", detail: "" } satisfies PackErrorPayload;
    },
    pickFolder: async () => null,
  };
}

export function createDefaultPackBackend(): PackBackend {
  if (isTauri()) return createTauriPackBackend();
  if (import.meta.env.DEV) return createHttpPackBackend();
  return createEmptyPackBackend();
}
