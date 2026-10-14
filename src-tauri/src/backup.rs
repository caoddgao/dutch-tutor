//! Learning-data backup files (design §8) and the content-report export (§7).
//! The front end builds and checks the JSON; this side only reads and writes the files.
//! Nothing here touches the Azure key file or the recordings folder.

use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager, Runtime};

const SAFETY_DIR: &str = "backups";
/// Automatic copies made before a restore; older ones are removed.
const KEEP_SAFETY: usize = 10;
const MAX_BYTES: u64 = 50_000_000;

#[derive(Debug, Serialize)]
pub struct BackupError {
    code: &'static str,
    detail: String,
}

fn err(code: &'static str, detail: impl ToString) -> BackupError {
    BackupError {
        code,
        detail: detail.to_string(),
    }
}

fn is_json(path: &Path) -> bool {
    path.extension()
        .and_then(|x| x.to_str())
        .map(|x| x.eq_ignore_ascii_case("json"))
        .unwrap_or(false)
}

fn write_json_file(path: &Path, text: &str) -> Result<(), BackupError> {
    if !is_json(path) {
        return Err(err("bad_file", "expected a .json file"));
    }
    if text.len() as u64 > MAX_BYTES {
        return Err(err("too_large", text.len()));
    }
    fs::write(path, text).map_err(|e| err("io", e))
}

fn read_json_file(path: &Path) -> Result<String, BackupError> {
    if !is_json(path) {
        return Err(err("bad_file", "expected a .json file"));
    }
    let meta = fs::metadata(path).map_err(|e| err("io", e))?;
    if !meta.is_file() {
        return Err(err("bad_file", "not a file"));
    }
    if meta.len() > MAX_BYTES {
        return Err(err("too_large", meta.len()));
    }
    let bytes = fs::read(path).map_err(|e| err("io", e))?;
    String::from_utf8(bytes).map_err(|_| err("bad_file", "not UTF-8 text"))
}

/// Stamp from the front end, e.g. `20261014-153000`; only digits and dashes.
fn valid_stamp(stamp: &str) -> bool {
    !stamp.is_empty() && stamp.len() <= 32 && stamp.chars().all(|c| c.is_ascii_digit() || c == '-')
}

fn save_safety_copy(dir: &Path, stamp: &str, text: &str) -> Result<PathBuf, BackupError> {
    if !valid_stamp(stamp) {
        return Err(err("bad_name", stamp));
    }
    fs::create_dir_all(dir).map_err(|e| err("io", e))?;
    let path = dir.join(format!("before-restore-{stamp}.json"));
    write_json_file(&path, text)?;
    let mut copies: Vec<PathBuf> = fs::read_dir(dir)
        .map_err(|e| err("io", e))?
        .filter_map(|entry| entry.ok().map(|e| e.path()))
        .filter(|p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .map(|n| n.starts_with("before-restore-") && n.ends_with(".json"))
                .unwrap_or(false)
        })
        .collect();
    // the stamp sorts by time
    copies.sort();
    let excess = copies.len().saturating_sub(KEEP_SAFETY);
    for old in copies.into_iter().take(excess) {
        let _ = fs::remove_file(old);
    }
    Ok(path)
}

/// Writes a backup or report file to a place the learner picked in the save dialog.
#[tauri::command]
pub fn write_export_file(path: String, text: String) -> Result<(), BackupError> {
    write_json_file(&PathBuf::from(path), &text)
}

/// Reads a backup file the learner picked in the open dialog.
#[tauri::command]
pub fn read_backup_file(path: String) -> Result<String, BackupError> {
    read_json_file(&PathBuf::from(path))
}

/// Keeps a copy of the current data in `<app data>/backups/` before a restore overwrites it.
#[tauri::command]
pub fn save_safety_backup<R: Runtime>(
    app: AppHandle<R>,
    stamp: String,
    text: String,
) -> Result<(), BackupError> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| err("io", e))?
        .join(SAFETY_DIR);
    save_safety_copy(&dir, &stamp, &text).map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::{read_json_file, save_safety_copy, valid_stamp, write_json_file, KEEP_SAFETY};
    use std::fs;

    fn temp(name: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!(
            "dutch-tutor-backup-test-{name}-{}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn writes_and_reads_json_files_only() {
        let dir = temp("rw");
        let file = dir.join("backup.json");
        write_json_file(&file, "{\"a\":1}").unwrap();
        assert_eq!(read_json_file(&file).unwrap(), "{\"a\":1}");
        assert!(write_json_file(&dir.join("backup.txt"), "x").is_err());
        fs::write(dir.join("note.txt"), "x").unwrap();
        assert!(read_json_file(&dir.join("note.txt")).is_err());
        fs::write(dir.join("bad.json"), [0xff, 0xfe, 0x00]).unwrap();
        assert!(read_json_file(&dir.join("bad.json")).is_err());
        assert!(read_json_file(&dir.join("missing.json")).is_err());
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn keeps_only_the_newest_safety_copies() {
        let dir = temp("safety");
        for i in 0..(KEEP_SAFETY + 3) {
            save_safety_copy(&dir, &format!("20261014-1500{i:02}"), "{}").unwrap();
        }
        let mut names: Vec<String> = fs::read_dir(&dir)
            .unwrap()
            .map(|e| e.unwrap().file_name().into_string().unwrap())
            .collect();
        names.sort();
        assert_eq!(names.len(), KEEP_SAFETY);
        assert_eq!(names[0], "before-restore-20261014-150003.json");
        fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn safety_copy_names_cannot_escape() {
        assert!(valid_stamp("20261014-153000"));
        assert!(!valid_stamp("../x"));
        assert!(!valid_stamp(""));
        assert!(!valid_stamp("a/b"));
    }
}
