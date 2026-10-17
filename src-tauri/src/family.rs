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

#[cfg_attr(target_os = "android", allow(dead_code))]
fn prepare(root: &Path, data: &Path, now: &str) -> Option<BundledRecordings> {
    // Either resource can be supplied on its own; a broken pack must not block recordings.
    let _ = pack::import_bundled(&root.join("nn-pack"), &data.join("nn-pack"), now);
    pending_recordings(root.join("recordings"), data)
}

/// The bundled voice folder, unless this exact revision was already imported.
fn pending_recordings(dir: std::path::PathBuf, data: &Path) -> Option<BundledRecordings> {
    let revision = recordings::folder_revision(&dir).ok()?;
    if fs::read_to_string(data.join(RECEIPT)).ok().as_deref() == Some(revision.as_str()) {
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
    let data = app.path().app_data_dir().map_err(|e| e.to_string())?;
    #[cfg(target_os = "android")]
    let job = move || apk::prepare(&data, &now);
    #[cfg(not(target_os = "android"))]
    let job = {
        let root = app
            .path()
            .resource_dir()
            .map_err(|e| e.to_string())?
            .join("family");
        // Ordinary installs do not open SQLite, create folders, or change any data here.
        if !root.is_dir() {
            return Ok(None);
        }
        move || prepare(&root, &data, &now)
    };
    tauri::async_runtime::spawn_blocking(job)
        .await
        .map_err(|e| e.to_string())
}

/// Android: `family/` is inside the APK and only readable as assets (android_assets.rs).
#[cfg(target_os = "android")]
mod apk {
    use super::{pending_recordings, BundledRecordings};
    use crate::{android_assets, pack};
    use sha2::{Digest, Sha256};
    use std::{fs, path::Path};

    /// Written by scripts/build-family-android.mjs: one `path<TAB>sha256` per bundled file.
    const INDEX: &str = "family-index.txt";
    /// Extracted voice folder (small), kept until the next bundle revision.
    const BUNDLE_DIR: &str = "family-bundle";
    const EXTRACTED: &str = "family-bundle.sha256";

    pub fn prepare(data: &Path, now: &str) -> Option<BundledRecordings> {
        // Ordinary APKs have no index: no folders are created and nothing changes.
        let index = String::from_utf8(android_assets::read(INDEX)?).ok()?;
        let files: Vec<&str> = index
            .lines()
            .filter_map(|line| line.split('\t').next())
            .filter(|path| !path.is_empty())
            .collect();
        // Either resource can be supplied on its own; a broken pack must not block recordings.
        let _ = install_pack(&files, &data.join("nn-pack"), now);
        let revision = format!("{:x}", Sha256::digest(index.as_bytes()));
        let root = data.join(BUNDLE_DIR);
        if fs::read_to_string(data.join(EXTRACTED)).ok().as_deref() != Some(revision.as_str()) {
            let _ = fs::remove_dir_all(&root);
            extract(&files, "recordings/", &root.join("recordings")).ok()?;
            fs::write(data.join(EXTRACTED), &revision).ok()?;
        }
        pending_recordings(root.join("recordings"), data)
    }

    /// Same rule as the desktop installer (newer `created_at` only), but the APK copy is streamed
    /// straight into the import staging folder: the pack is stored once in the app data, not twice.
    fn install_pack(files: &[&str], target: &Path, now: &str) -> Result<(), String> {
        let manifest = android_assets::read("family/nn-pack/manifest.json").ok_or("no pack")?;
        let manifest = serde_json::from_slice(&manifest).map_err(|e| e.to_string())?;
        if !pack::bundled_is_newer(&manifest, target).map_err(|e| format!("{e:?}"))? {
            return Ok(());
        }
        let staging = pack::staging_dir(target).map_err(|e| format!("{e:?}"))?;
        let _ = fs::remove_dir_all(&staging);
        if let Err(e) = extract(files, "nn-pack/", &staging) {
            let _ = fs::remove_dir_all(&staging);
            return Err(e);
        }
        pack::install_staged(target, now).map_err(|e| format!("{e:?}"))?;
        Ok(())
    }

    fn extract(files: &[&str], prefix: &str, to: &Path) -> Result<(), String> {
        for rel in files.iter().filter_map(|path| path.strip_prefix(prefix)) {
            let target = pack::resolve_inside(to, rel).map_err(|e| format!("{e:?}"))?;
            if let Some(parent) = target.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut out = fs::File::create(&target).map_err(|e| e.to_string())?;
            android_assets::copy(&format!("family/{prefix}{rel}"), &mut out)?;
        }
        Ok(())
    }
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
