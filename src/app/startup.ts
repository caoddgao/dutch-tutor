// Cold-start measurement: tells the desktop shell the home page is usable (src-tauri/src/startup.rs).
// The shell ignores it unless a measurement run asked for it.
import { invoke, isTauri } from "@tauri-apps/api/core";

let reported = false;

export function reportHomeReady(): void {
  if (reported || !isTauri()) return;
  reported = true;
  // after the frame with the data has been painted
  requestAnimationFrame(() =>
    setTimeout(() => void invoke("startup_ready", { pageMs: performance.now() }).catch(() => undefined), 0),
  );
}
