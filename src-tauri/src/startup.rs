//! Cold-start measurement (02_PLAN stage 5, item 5: open → home page usable in under 3 seconds).
//! Only active when `DUTCH_TUTOR_STARTUP_PROBE` names a file: once the home page is usable the app
//! writes the timings there and quits. Without the variable the command does nothing.

use serde_json::json;
use std::path::PathBuf;
use std::time::Instant;
use tauri::{AppHandle, Runtime, State};

pub struct Probe {
    file: Option<PathBuf>,
    started: Instant,
}

impl Probe {
    pub fn from_env() -> Self {
        Probe {
            file: std::env::var_os("DUTCH_TUTOR_STARTUP_PROBE").map(PathBuf::from),
            started: Instant::now(),
        }
    }
}

/// `page_ms`: the page's own clock (time since the web view started loading it).
#[tauri::command]
pub fn startup_ready<R: Runtime>(app: AppHandle<R>, probe: State<'_, Probe>, page_ms: f64) {
    let Some(file) = &probe.file else {
        return;
    };
    let body = json!({
        "shell_ms": probe.started.elapsed().as_secs_f64() * 1000.0,
        "page_ms": page_ms,
    });
    let _ = std::fs::write(file, body.to_string());
    app.exit(0);
}
