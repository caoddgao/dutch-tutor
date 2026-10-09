import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { readCachedSettings, writeCachedSettings, type SettingsStore } from "../storage/settingsStore";
import { SettingsContext } from "./context";
import { applySettings, DEFAULT_SETTINGS, normalizeSettings, type SettingKey, type Settings } from "./settings";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function systemPrefersDark(): boolean {
  return typeof window.matchMedia === "function" && window.matchMedia(DARK_QUERY).matches;
}

export function SettingsProvider({ store, children }: { store: SettingsStore; children: ReactNode }) {
  const [settings, setSettings] = useState<Settings>(() => normalizeSettings(readCachedSettings()));
  const [systemDark, setSystemDark] = useState(systemPrefersDark);

  useEffect(() => {
    let cancelled = false;
    store
      .load()
      .then((stored) => {
        if (!cancelled) setSettings(normalizeSettings(stored));
      })
      .catch((err: unknown) => console.error("settings load failed", err));
    return () => {
      cancelled = true;
    };
  }, [store]);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia(DARK_QUERY);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    applySettings(document.documentElement, settings, systemDark);
    writeCachedSettings(settings);
  }, [settings, systemDark]);

  const update = useCallback(
    <K extends SettingKey>(key: K, value: Settings[K]) => {
      const valid = normalizeSettings({ ...DEFAULT_SETTINGS, [key]: value })[key];
      setSettings((prev) => ({ ...prev, [key]: valid }));
      store.save(key, valid).catch((err: unknown) => console.error("settings save failed", err));
    },
    [store],
  );

  const value = useMemo(() => ({ settings, update }), [settings, update]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}
