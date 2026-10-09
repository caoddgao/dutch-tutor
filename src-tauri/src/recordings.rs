//! Learner recordings (design §5.3): files in `<app data>/recordings/`, indexed in SQLite by the front end.

use crate::pack::resolve_inside;
use serde::Serialize;
use std::fs;
use std::path::PathBuf;
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager, Runtime};

const DIR: &str = "recordings";

#[derive(Debug, Serialize)]
pub struct RecordingError {
    code: &'static str,
    detail: String,
}

fn err(code: &'static str, detail: impl ToString) -> RecordingError {
    RecordingError {
        code,
        detail: detail.to_string(),
    }
}

fn dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf, RecordingError> {
    app.path()
        .app_data_dir()
        .map(|d| d.join(DIR))
        .map_err(|e| err("io", e))
}

/// File names come from the front end: audio id + timestamp + extension, nothing else.
pub fn valid_name(name: &str) -> bool {
    !name.is_empty()
        && name.len() <= 160
        && !name.starts_with('.')
        && name
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-' | '.'))
}

/// Body: the raw audio bytes. Header `x-name`: file name. Returns the absolute path.
#[tauri::command]
pub fn save_recording<R: Runtime>(
    app: AppHandle<R>,
    request: Request<'_>,
) -> Result<String, RecordingError> {
    let name = request
        .headers()
        .get("x-name")
        .and_then(|v| v.to_str().ok())
        .unwrap_or_default()
        .to_string();
    if !valid_name(&name) {
        return Err(err("bad_name", name));
    }
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err(err("bad_body", "expected raw bytes"));
    };
    let dir = dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| err("io", e))?;
    let path = resolve_inside(&dir, &name).map_err(|_| err("bad_name", &name))?;
    fs::write(&path, bytes).map_err(|e| err("io", e))?;
    Ok(path.display().to_string())
}

#[tauri::command]
pub fn delete_recording<R: Runtime>(app: AppHandle<R>, name: String) -> Result<(), RecordingError> {
    if !valid_name(&name) {
        return Err(err("bad_name", name));
    }
    let path = dir(&app)?.join(&name);
    match fs::remove_file(path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(err("io", e)),
    }
}

#[cfg(test)]
mod tests {
    use super::valid_name;

    #[test]
    fn only_plain_file_names() {
        assert!(valid_name("NN21-S01_1700000000000.webm"));
        assert!(!valid_name("../x.webm"));
        assert!(!valid_name("a/b.webm"));
        assert!(!valid_name("a\\b.webm"));
        assert!(!valid_name(".hidden"));
        assert!(!valid_name(""));
    }
}
