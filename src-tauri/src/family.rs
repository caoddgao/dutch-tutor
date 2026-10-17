//! Private installer resources. Failures are deliberately isolated from normal startup.
use crate::{pack, recordings};
use serde::Serialize;
use std::{fs, path::Path};
use tauri::{AppHandle, Manager, Runtime};

const RECEIPT: &str = "family-recordings.sha256";

#[derive(Debug, Serialize)]
pub struct BundledRecordings {
    dir: String,
    revision: String,
}

fn prepare(root: &Path, data: &Path, now: &str) -> Option<BundledRecordings> {
    // Either resource can be supplied on its own; a broken pack must not block recordings.
    let _ = pack::import_bundled(&root.join("nn-pack"), &data.join("nn-pack"), now);
    let dir = root.join("recordings");
    let revision = recordings::folder_revision(&dir).ok()?;
    if fs::read_to_string(data.join(RECEIPT)).ok().as_deref() == Some(&revision) {
        return None;
    }
    Some(BundledRecordings {
        dir: dir.display().to_string(),
        revision,
    })
}

#[tauri::command]
pub async fn prepare_family<R: Runtime>(
    app: AppHandle<R>,
    now: String,
) -> Result<Option<BundledRecordings>, String> {
    let root = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?
        .join("family");
    // Ordinary installs do not open SQLite, create folders, or change any data here.
    if !root.is_dir() {
        return Ok(None);
    }
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    tauri::async_runtime::spawn_blocking(move || prepare(&root, &data, &now))
        .await
        .map_err(|e| e.to_string())
}

/// Write the receipt only after the existing recording importer has updated SQLite successfully.
#[tauri::command]
pub fn finish_family_recordings<R: Runtime>(
    app: AppHandle<R>,
    revision: String,
) -> Result<(), String> {
    if revision.len() != 64 || !revision.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err("invalid revision".into());
    }
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    fs::create_dir_all(&data).map_err(|e| e.to_string())?;
    fs::write(data.join(RECEIPT), revision).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ordinary_install_is_a_noop_and_broken_resources_are_independent() {
        let root = std::env::temp_dir().join(format!("dutch-family-{}", std::process::id()));
        let _ = fs::remove_dir_all(&root);
        let resources = root.join("family");
        let data = root.join("data");
        assert!(prepare(&resources, &data, "2026-10-17T00:00:00Z").is_none());
        assert!(!data.exists());
        let pack = resources.join("nn-pack");
        fs::create_dir_all(&pack).unwrap();
        fs::write(pack.join("manifest.json"), "broken pack").unwrap();
        let recordings = resources.join("recordings");
        fs::create_dir_all(&recordings).unwrap();
        fs::write(recordings.join("voice.webm"), "voice").unwrap();
        fs::write(recordings.join("dutch-tutor-recordings.json"),
            r#"{"version":1,"recordings":[{"audio_id":"P01-S01","file_name":"voice.webm","duration":1}],"marks":[]}"#).unwrap();
        let bundle = prepare(&resources, &data, "now").unwrap();
        // No receipt before the front end successfully imports the voice index.
        assert!(!data.exists());
        assert_eq!(
            prepare(&resources, &data, "retry").unwrap().revision,
            bundle.revision
        );
        fs::create_dir_all(&data).unwrap();
        fs::write(data.join(RECEIPT), &bundle.revision).unwrap();
        assert!(prepare(&resources, &data, "again").is_none());
        fs::write(recordings.join("voice.webm"), "updated voice").unwrap();
        assert_ne!(
            prepare(&resources, &data, "updated").unwrap().revision,
            bundle.revision
        );
        // Conversely, invalid recordings do not stop a valid pack from being imported.
        let fixture = Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/nn-pack");
        pack::import_into(&fixture, &pack, "fixture").unwrap();
        fs::write(
            recordings.join("dutch-tutor-recordings.json"),
            "broken recordings",
        )
        .unwrap();
        assert!(prepare(&resources, &data, "valid-pack").is_none());
        assert!(data.join("nn-pack/lessons/NN21.json").is_file());
        fs::remove_dir_all(root).unwrap();
    }
}
