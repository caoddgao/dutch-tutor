//! Cold-start measurement (02_PLAN stage 5, item 5: open → home page usable in under 3 seconds).
//! Only active when `DUTCH_TUTOR_STARTUP_PROBE` names a file: once the home page is usable the app
//! writes the timings there and quits. Without the variable nothing is written.

use serde_json::json;
use std::path::PathBuf;
use std::sync::OnceLock;
use std::time::Instant;
use tauri::{AppHandle, Runtime, State};

pub struct Probe {
    file: Option<PathBuf>,
    started: Instant,
    /// Milliseconds from launch until the setup hook ran (window requested)
    setup_ms: OnceLock<f64>,
    /// Milliseconds from launch until the web view began loading the page
    page_start_ms: OnceLock<f64>,
}

impl Probe {
    pub fn from_env() -> Self {
        Probe {
            file: std::env::var_os("DUTCH_TUTOR_STARTUP_PROBE").map(PathBuf::from),
            started: Instant::now(),
            setup_ms: OnceLock::new(),
            page_start_ms: OnceLock::new(),
        }
    }

    fn elapsed_ms(&self) -> f64 {
        self.started.elapsed().as_secs_f64() * 1000.0
    }

    pub fn mark_setup(&self) {
        let _ = self.setup_ms.set(self.elapsed_ms());
    }

    pub fn mark_page_start(&self) {
        let _ = self.page_start_ms.set(self.elapsed_ms());
    }

    /// android-spike: timings so far, without the probe file.
    pub fn snapshot(&self) -> serde_json::Value {
        json!({
            "shell_ms": self.elapsed_ms(),
            "setup_ms": self.setup_ms.get(),
            "page_start_ms": self.page_start_ms.get(),
        })
    }
}

/// `page_ms`: the page's own clock (time since the web view started loading it).
#[tauri::command]
pub fn startup_ready<R: Runtime>(app: AppHandle<R>, probe: State<'_, Probe>, page_ms: f64) {
    let Some(file) = &probe.file else {
        return;
    };
    let body = json!({
        "shell_ms": probe.elapsed_ms(),
        "setup_ms": probe.setup_ms.get(),
        "page_start_ms": probe.page_start_ms.get(),
        "page_ms": page_ms,
    });
    let _ = std::fs::write(file, body.to_string());
    app.exit(0);
}
