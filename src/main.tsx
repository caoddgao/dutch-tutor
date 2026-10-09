import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { applySettings, normalizeSettings } from "./settings/settings";
import { createLocalSettingsStore, readCachedSettings } from "./storage/settingsStore";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";

// Apply the last known theme and font scales before the first paint.
applySettings(
  document.documentElement,
  normalizeSettings(readCachedSettings()),
  window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false,
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App store={createLocalSettingsStore()} />
  </StrictMode>,
);
