import { createContext, useContext } from "react";
import type { PackBackend, PackInfo } from "../pack/backend";
import type { PackIndex } from "./packTypes";
import type { ContentBundle } from "./ownTypes";
import type { CourseSectionView, Dictionary, RtLesson } from "./model";

/** "outdated": the installed pack has a format version this app does not read; "error": it cannot be read */
export type PackStatus = "loading" | "none" | "ready" | "outdated" | "error";

export interface ContentContextValue {
  bundle: ContentBundle;
  backend: PackBackend;
  packStatus: PackStatus;
  packInfo: PackInfo | null;
  packIndex: PackIndex | null;
  /** created_at of a newer pack found in the folder it was imported from */
  packUpdate: string | null;
  dict: Dictionary;
  course: CourseSectionView[];
  loadLesson(id: string): Promise<RtLesson | null>;
  /** Imports a folder; throws a PackErrorPayload on failure */
  importPack(dir: string): Promise<void>;
  /** Text-to-URL lookup for our own synthesized audio */
  ttsUrl(voice: string, text: string): string | null;
}

export const ContentContext = createContext<ContentContextValue | null>(null);

export function useContent(): ContentContextValue {
  const ctx = useContext(ContentContext);
  if (!ctx) throw new Error("useContent must be used inside ContentProvider");
  return ctx;
}
