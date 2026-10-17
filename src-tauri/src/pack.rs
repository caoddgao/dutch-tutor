//! Resource pack import (docs/03_PACK_FORMAT.md): check the format version, copy the folder into
//! the app data directory (`%APPDATA%\nl.dutchtutor.app\nn-pack\` on Windows), read files from it.

use serde::Serialize;
use serde_json::Value;
use std::fs;
use std::path::{Component, Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

/// The only pack format this version understands.
pub const PACK_FORMAT_VERSION: u64 = 1;
const PACK_DIR: &str = "nn-pack";
const IMPORT_INFO: &str = "import.json";
/// Debug material produced by DS; the app never reads it.
const SKIP_DIRS: &[&str] = &["qa"];

/// Error sent to the front end: a stable code plus detail; the UI turns it into Chinese text.
#[derive(Debug, Serialize)]
pub struct PackError {
    code: &'static str,
    detail: String,
}

impl PackError {
    fn new(code: &'static str, detail: impl ToString) -> Self {
        Self {
            code,
            detail: detail.to_string(),
        }
    }
}

type Result<T> = std::result::Result<T, PackError>;

#[derive(Debug, Serialize)]
pub struct PackInfo {
    /// Absolute path of the installed pack (may not exist yet)
    dir: String,
    /// manifest.json of the installed pack, if any
    manifest: Option<Value>,
    /// Folder it was imported from, used to notice a newer version there
    source_dir: Option<String>,
    imported_at: Option<String>,
}

pub fn pack_dir<R: Runtime>(app: &AppHandle<R>) -> Result<PathBuf> {
    app.path()
        .app_data_dir()
        .map(|d| d.join(PACK_DIR))
        .map_err(|e| PackError::new("io", e))
}

fn read_json(path: &Path) -> Result<Value> {
    let text = fs::read_to_string(path).map_err(|e| PackError::new("io", e))?;
    serde_json::from_str(text.trim_start_matches('\u{feff}'))
        .map_err(|e| PackError::new("bad_json", e))
}

/// Reads and checks a pack folder's manifest.json without copying anything.
fn check_source(dir: &Path) -> Result<Value> {
    let manifest_path = dir.join("manifest.json");
    if !manifest_path.is_file() {
        return Err(PackError::new("not_a_pack", dir.display()));
    }
    let manifest = read_json(&manifest_path)?;
    match manifest.get("format_version").and_then(Value::as_u64) {
        Some(PACK_FORMAT_VERSION) => {}
        Some(v) => return Err(PackError::new("format_version", v)),
        None => return Err(PackError::new("format_version", "missing")),
    }
    for required in ["index.json", "words.json"] {
        if !dir.join(required).is_file() {
            return Err(PackError::new("incomplete", required));
        }
    }
    if !dir.join("lessons").is_dir() {
        return Err(PackError::new("incomplete", "lessons"));
    }
    Ok(manifest)
}

fn copy_dir(from: &Path, to: &Path, top: bool) -> Result<u64> {
    fs::create_dir_all(to).map_err(|e| PackError::new("io", e))?;
    let mut count = 0;
    for entry in fs::read_dir(from).map_err(|e| PackError::new("io", e))? {
        let entry = entry.map_err(|e| PackError::new("io", e))?;
        let name = entry.file_name();
        let kind = entry.file_type().map_err(|e| PackError::new("io", e))?;
        if kind.is_dir() {
            if top && SKIP_DIRS.iter().any(|s| name == *s) {
                continue;
            }
            count += copy_dir(&entry.path(), &to.join(&name), false)?;
        } else if kind.is_file() {
            fs::copy(entry.path(), to.join(&name)).map_err(|e| PackError::new("io", e))?;
            count += 1;
        }
    }
    Ok(count)
}

fn info_for(dir: &Path) -> PackInfo {
    let manifest = read_json(&dir.join("manifest.json")).ok();
    let import = read_json(&dir.join(IMPORT_INFO)).ok();
    let field = |k: &str| {
        import
            .as_ref()
            .and_then(|v| v.get(k))
            .and_then(Value::as_str)
            .map(String::from)
    };
    PackInfo {
        dir: dir.display().to_string(),
        manifest,
        source_dir: field("source_dir"),
        imported_at: field("imported_at"),
    }
}

/// Copies `source` into `target` atomically enough for a single user: build next to it, then swap.
pub fn import_into(source: &Path, target: &Path, now: &str) -> Result<PackInfo> {
    import_with_source(source, target, now, true)
}

fn import_with_source(
    source: &Path,
    target: &Path,
    now: &str,
    remember_source: bool,
) -> Result<PackInfo> {
    check_source(source)?;
    let source = source.canonicalize().map_err(|e| PackError::new("io", e))?;
    if let Ok(t) = target.canonicalize() {
        if source.starts_with(&t) {
            return Err(PackError::new("same_dir", source.display()));
        }
    }
    let staging = staging_dir(target)?;
    let _ = fs::remove_dir_all(&staging);
    copy_dir(&source, &staging, true)?;
    let source_dir = remember_source.then(|| source.display().to_string());
    swap_in(&staging, target, now, source_dir)
}

/// Where a pack is assembled before it replaces `target` (same parent, so the swap is a rename).
pub fn staging_dir(target: &Path) -> Result<PathBuf> {
    let parent = target
        .parent()
        .ok_or_else(|| PackError::new("io", "no parent"))?;
    fs::create_dir_all(parent).map_err(|e| PackError::new("io", e))?;
    Ok(parent.join(format!("{PACK_DIR}.importing")))
}

/// Android: the APK's bundled pack was streamed straight into `staging_dir(target)`; check it and
/// swap it in without a second copy.
#[cfg_attr(not(target_os = "android"), allow(dead_code))]
pub fn install_staged(target: &Path, now: &str) -> Result<PackInfo> {
    let staging = staging_dir(target)?;
    if let Err(e) = check_source(&staging) {
        let _ = fs::remove_dir_all(&staging);
        return Err(e);
    }
    swap_in(&staging, target, now, None)
}

fn swap_in(
    staging: &Path,
    target: &Path,
    now: &str,
    source_dir: Option<String>,
) -> Result<PackInfo> {
    let old = staging.with_file_name(format!("{PACK_DIR}.old"));
    let _ = fs::remove_dir_all(&old);
    let import = serde_json::json!({ "source_dir": source_dir, "imported_at": now });
    fs::write(staging.join(IMPORT_INFO), import.to_string())
        .map_err(|e| PackError::new("io", e))?;

    if target.exists() {
        fs::rename(target, &old).map_err(|e| PackError::new("io", e))?;
    }
    if let Err(e) = fs::rename(staging, target) {
        // put the previous pack back
        let _ = fs::rename(&old, target);
        return Err(PackError::new("io", e));
    }
    let _ = fs::remove_dir_all(&old);
    Ok(info_for(target))
}

/// Bundled packs follow the same format and atomic import path as manual imports.
/// Content revisions are RFC 3339 instants, not strings (offsets can differ).
#[cfg_attr(target_os = "android", allow(dead_code))]
pub fn import_bundled(source: &Path, target: &Path, now: &str) -> Result<bool> {
    if !source.is_dir() {
        return Ok(false);
    }
    let bundled = check_source(source)?;
    if !bundled_is_newer(&bundled, target)? {
        return Ok(false);
    }
    // Installer resources may later be replaced by an older installer. Do not offer them as
    // a manual "new version" source; the next startup applies the timestamp comparison again.
    import_with_source(source, target, now, false)?;
    Ok(true)
}

/// Whether a bundled pack (its manifest) should replace the installed one at `target`.
pub fn bundled_is_newer(bundled: &Value, target: &Path) -> Result<bool> {
    let timestamp = |m: &Value| {
        m.get("created_at")
            .and_then(Value::as_str)
            .and_then(|t| chrono::DateTime::parse_from_rfc3339(t).ok())
    };
    let incoming = timestamp(bundled)
        .ok_or_else(|| PackError::new("bad_json", "missing or invalid created_at"))?;
    if !target.join("manifest.json").is_file() {
        return Ok(true);
    }
    let installed = read_json(&target.join("manifest.json"))?;
    // Unknown installed timestamps must not cause a silent downgrade.
    Ok(matches!(timestamp(&installed), Some(current) if incoming > current))
}

/// Resolves a pack-relative path ("lessons/NN21.json") inside `root`, refusing anything that escapes it.
pub fn resolve_inside(root: &Path, rel: &str) -> Result<PathBuf> {
    let rel = Path::new(rel);
    if rel.components().any(|c| !matches!(c, Component::Normal(_))) {
        return Err(PackError::new("bad_path", rel.display()));
    }
    Ok(root.join(rel))
}

#[tauri::command]
pub fn pack_info<R: Runtime>(app: AppHandle<R>) -> Result<PackInfo> {
    Ok(info_for(&pack_dir(&app)?))
}

#[tauri::command]
pub fn inspect_pack(dir: String) -> Result<Value> {
    check_source(Path::new(&dir))
}

#[tauri::command]
pub async fn import_pack<R: Runtime>(
    app: AppHandle<R>,
    dir: String,
    now: String,
) -> Result<PackInfo> {
    let target = pack_dir(&app)?;
    tauri::async_runtime::spawn_blocking(move || import_into(Path::new(&dir), &target, &now))
        .await
        .map_err(|e| PackError::new("io", e))?
}

#[tauri::command]
pub fn read_pack_file<R: Runtime>(app: AppHandle<R>, path: String) -> Result<String> {
    let full = resolve_inside(&pack_dir(&app)?, &path)?;
    fs::read_to_string(full)
        .map(|s| s.trim_start_matches('\u{feff}').to_string())
        .map_err(|e| PackError::new("io", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn fixture() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../fixtures/nn-pack")
    }

    fn temp(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("dutch-tutor-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn imports_the_fixture_pack_without_qa() {
        let root = temp("import");
        let target = root.join("nn-pack");
        let info = import_into(&fixture(), &target, "2026-10-09T12:00:00Z").unwrap();
        assert_eq!(info.manifest.unwrap()["format_version"], 1);
        assert!(target.join("lessons/NN21.json").is_file());
        assert!(target.join("audio/NN21/S01.mp3").is_file());
        assert!(!target.join("qa").exists());
        assert_eq!(info.imported_at.as_deref(), Some("2026-10-09T12:00:00Z"));
        // re-import replaces the old copy
        fs::write(target.join("stale.txt"), "x").unwrap();
        import_into(&fixture(), &target, "later").unwrap();
        assert!(!target.join("stale.txt").exists());
        // importing the installed copy onto itself is refused
        assert_eq!(
            import_into(&target, &target, "x").unwrap_err().code,
            "same_dir"
        );
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn bundled_pack_imports_only_missing_or_newer_content() {
        let root = temp("bundled-pack");
        let source = root.join("bundle");
        let target = root.join("data/nn-pack");
        copy_dir(&fixture(), &source, true).unwrap();
        assert!(!import_bundled(&root.join("absent"), &target, "now").unwrap());
        assert!(!target.exists());
        assert!(import_bundled(&source, &target, "first").unwrap());
        assert!(info_for(&target).source_dir.is_none());
        fs::write(target.join("keep"), "installed").unwrap();
        assert!(!import_bundled(&source, &target, "same").unwrap());

        let mut manifest = read_json(&source.join("manifest.json")).unwrap();
        // Same instant in a different timezone must not be treated as a new pack.
        manifest["created_at"] = "2026-10-09T10:00:00Z".into();
        fs::write(source.join("manifest.json"), manifest.to_string()).unwrap();
        assert!(!import_bundled(&source, &target, "same-instant").unwrap());
        // Lexically greater, but chronologically older than the installed 10:00 UTC.
        manifest["created_at"] = "2026-10-09T12:30:00+03:00".into();
        fs::write(source.join("manifest.json"), manifest.to_string()).unwrap();
        assert!(!import_bundled(&source, &target, "older").unwrap());
        assert!(target.join("keep").exists());

        manifest["created_at"] = "2026-10-10T00:00:00Z".into();
        fs::write(source.join("manifest.json"), manifest.to_string()).unwrap();
        assert!(import_bundled(&source, &target, "newer").unwrap());
        assert!(!target.join("keep").exists());
        assert_eq!(info_for(&target).imported_at.as_deref(), Some("newer"));
        // A pack from a future app must not be silently downgraded just because its format is unknown.
        let mut installed = read_json(&target.join("manifest.json")).unwrap();
        installed["format_version"] = 2.into();
        installed["created_at"] = "2027-01-01T00:00:00Z".into();
        fs::write(target.join("manifest.json"), installed.to_string()).unwrap();
        assert!(!import_bundled(&source, &target, "future-format").unwrap());
        // Reject invalid bundled metadata without damaging the installed pack.
        manifest["created_at"] = "bad-date".into();
        fs::write(source.join("manifest.json"), manifest.to_string()).unwrap();
        assert!(import_bundled(&source, &target, "bad").is_err());
        assert_eq!(info_for(&target).imported_at.as_deref(), Some("newer"));
        manifest["format_version"] = 2.into();
        fs::write(source.join("manifest.json"), manifest.to_string()).unwrap();
        assert!(import_bundled(&source, &target, "unsupported").is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn rejects_unknown_format_and_non_packs() {
        let root = temp("reject");
        assert_eq!(check_source(&root).unwrap_err().code, "not_a_pack");
        fs::write(root.join("manifest.json"), r#"{"format_version": 2}"#).unwrap();
        let err = check_source(&root).unwrap_err();
        assert_eq!((err.code, err.detail.as_str()), ("format_version", "2"));
        fs::write(root.join("manifest.json"), r#"{"format_version": 1}"#).unwrap();
        assert_eq!(check_source(&root).unwrap_err().code, "incomplete");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn staged_pack_is_swapped_in_and_a_broken_one_is_dropped() {
        let root = temp("staged");
        let target = root.join(PACK_DIR);
        let staging = staging_dir(&target).unwrap();
        fs::create_dir_all(&staging).unwrap();
        fs::write(staging.join("manifest.json"), "broken").unwrap();
        assert!(install_staged(&target, "broken").is_err());
        assert!(!staging.exists() && !target.exists());
        copy_dir(&fixture(), &staging, true).unwrap();
        let info = install_staged(&target, "now").unwrap();
        assert_eq!(info.imported_at.as_deref(), Some("now"));
        assert_eq!(info.source_dir, None);
        assert!(target.join("lessons/NN21.json").is_file() && !staging.exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn refuses_paths_outside_the_pack() {
        let root = Path::new("/p");
        assert!(resolve_inside(root, "lessons/NN21.json").is_ok());
        assert!(resolve_inside(root, "../secret").is_err());
        assert!(resolve_inside(root, "/etc/passwd").is_err());
    }
}
