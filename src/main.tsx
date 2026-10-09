// Global styles first, so component styles can override them.
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applySettings, normalizeSettings } from "./settings/settings";
import { isTauri } from "@tauri-apps/api/core";
import { getDb } from "./storage/db";
import { createLocalSettingsStore, readCachedSettings } from "./storage/settingsStore";
import { createSqliteSettingsStore } from "./storage/sqliteSettingsStore";

// Apply the last known theme and font scales before the first paint.
applySettings(
  document.documentElement,
  normalizeSettings(readCachedSettings()),
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
);

// Desktop app: SQLite. Plain browser (dev server): localStorage.
const store = isTauri() ? createSqliteSettingsStore(getDb) : createLocalSettingsStore();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App store={store} />
  </StrictMode>,
);
