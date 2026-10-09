import { createContext, useContext } from "react";
import type { SettingKey, Settings } from "./settings";

export interface SettingsContextValue {
  settings: Settings;
  update: <K extends SettingKey>(key: K, value: Settings[K]) => void;
}

export const SettingsContext = createContext<SettingsContextValue | null>(null);

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used inside SettingsProvider");
  return ctx;
}
