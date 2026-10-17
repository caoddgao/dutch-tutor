//! Learner recordings (design §5.3): files in `<app data>/recordings/`, indexed in SQLite by the front end.

use crate::pack::resolve_inside;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::borrow::Cow;
use std::fs;
use std::io::Read;
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::ipc::{InvokeBody, Request};
use tauri::{AppHandle, Manager, Runtime};

const DIR: &str = "recordings";
const MANIFEST: &str = "dutch-tutor-recordings.json";

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

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct VoiceEntry {
    audio_id: String,
    file_name: String,
    duration: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    file_path: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct UnnaturalMark {
    target_id: String,
    target_type: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct RecordingManifest {
    version: u8,
    recordings: Vec<VoiceEntry>,
    marks: Vec<UnnaturalMark>,
}

fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 150
        && id
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '-'))
}

fn valid_audio_file(name: &str) -> bool {
    valid_name(name)
        && ["webm", "ogg", "m4a", "mp3", "wav"]
            .iter()
            .any(|ext| name.ends_with(&format!(".{ext}")))
}

fn validate_manifest(manifest: &RecordingManifest) -> Result<(), RecordingError> {
    if manifest.version != 1 || manifest.recordings.len() > 10000 || manifest.marks.len() > 10000 {
        return Err(err("bad_manifest", "unsupported recording folder"));
    }
    if manifest
        .recordings
        .iter()
        .any(|r| !valid_id(&r.audio_id) || !valid_audio_file(&r.file_name))
        || manifest.marks.iter().any(|m| {
            !valid_id(&m.target_id) || !matches!(m.target_type.as_str(), "sentence" | "word")
        })
    {
        return Err(err("bad_manifest", "invalid recording entry"));
    }
    Ok(())
}

fn plain_file(path: &Path) -> Result<(), RecordingError> {
    let meta = fs::symlink_metadata(path).map_err(|e| err("io", e))?;
    if !meta.file_type().is_file() {
        return Err(err("bad_manifest", "not a plain recording file"));
    }
    Ok(())
}

fn export_folder_files(
    source: &Path,
    target: &Path,
    manifest: &RecordingManifest,
) -> Result<(), RecordingError> {
    if !target.is_dir() {
        return Err(err("io", "destination folder is missing"));
    }
    validate_manifest(manifest)?;
    for entry in &manifest.recordings {
        let from = source.join(&entry.file_name);
        plain_file(&from)?;
        fs::copy(from, target.join(&entry.file_name)).map_err(|e| err("io", e))?;
    }
    let json = serde_json::to_vec_pretty(manifest).map_err(|e| err("io", e))?;
    fs::write(target.join(MANIFEST), json).map_err(|e| err("io", e))
}

fn import_folder_files(source: &Path, target: &Path) -> Result<RecordingManifest, RecordingError> {
    let bytes = fs::read(source.join(MANIFEST)).map_err(|e| err("io", e))?;
    if bytes.len() > 2_000_000 {
        return Err(err("bad_manifest", "recording list is too large"));
    }
    let mut manifest: RecordingManifest =
        serde_json::from_slice(&bytes).map_err(|e| err("bad_manifest", e))?;
    validate_manifest(&manifest)?;
    fs::create_dir_all(target).map_err(|e| err("io", e))?;
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| err("io", e))?
        .as_nanos();
    for (i, entry) in manifest.recordings.iter_mut().enumerate() {
        let from = source.join(&entry.file_name);
        plain_file(&from)?;
        let ext = Path::new(&entry.file_name)
            .extension()
            .and_then(|x| x.to_str())
            .unwrap_or("webm");
        let to = target.join(format!("import_{nonce}_{i}.{ext}"));
        fs::copy(from, &to).map_err(|e| err("io", e))?;
        entry.file_path = Some(to.display().to_string());
    }
    Ok(manifest)
}

/// Hash the exported manifest and referenced audio, including same-name audio updates.
/// Only exported voice files participate; unrelated files (including practice) are ignored.
pub fn folder_revision(source: &Path) -> Result<String, RecordingError> {
    let bytes = fs::read(source.join(MANIFEST)).map_err(|e| err("io", e))?;
    if bytes.len() > 2_000_000 {
        return Err(err("bad_manifest", "recording list is too large"));
    }
    let manifest: RecordingManifest =
        serde_json::from_slice(&bytes).map_err(|e| err("bad_manifest", e))?;
    validate_manifest(&manifest)?;
    let mut hash = Sha256::new();
    hash.update((bytes.len() as u64).to_le_bytes());
    hash.update(&bytes);
    for entry in manifest.recordings {
        let path = source.join(entry.file_name);
        plain_file(&path)?;
        let mut file = fs::File::open(path).map_err(|e| err("io", e))?;
        hash.update(
            file.metadata()
                .map_err(|e| err("io", e))?
                .len()
                .to_le_bytes(),
        );
        let mut buffer = [0; 65536];
        loop {
            let count = file.read(&mut buffer).map_err(|e| err("io", e))?;
            if count == 0 {
                break;
            }
            hash.update(&buffer[..count]);
        }
    }
    Ok(format!("{:x}", hash.finalize()))
}

#[tauri::command]
pub fn export_recording_folder<R: Runtime>(
    app: AppHandle<R>,
    dir: String,
    recordings: Vec<VoiceEntry>,
    marks: Vec<UnnaturalMark>,
) -> Result<(), RecordingError> {
    let manifest = RecordingManifest {
        version: 1,
        recordings,
        marks,
    };
    export_folder_files(&self::dir(&app)?, &PathBuf::from(dir), &manifest)
}

#[tauri::command]
pub fn import_recording_folder<R: Runtime>(
    app: AppHandle<R>,
    dir: String,
) -> Result<RecordingManifest, RecordingError> {
    import_folder_files(&PathBuf::from(dir), &self::dir(&app)?)
}

#[tauri::command]
pub fn write_recording_transcript(path: String, html: String) -> Result<(), RecordingError> {
    let destination = PathBuf::from(path);
    if destination
        .extension()
        .and_then(|x| x.to_str())
        .map(|x| x.to_ascii_lowercase())
        != Some("html".into())
        || html.len() > 5_000_000
    {
        return Err(err("bad_file", "expected an HTML transcript"));
    }
    fs::write(destination, html).map_err(|e| err("io", e))
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
    let Some(bytes) = body_bytes(request.body()) else {
        return Err(err("bad_body", "expected raw bytes"));
    };
    let dir = dir(&app)?;
    fs::create_dir_all(&dir).map_err(|e| err("io", e))?;
    let path = resolve_inside(&dir, &name).map_err(|_| err("bad_name", &name))?;
    fs::write(&path, &*bytes).map_err(|e| err("io", e))?;
    Ok(path.display().to_string())
}

/// Desktop sends the recording as raw bytes; Android has no custom-protocol IPC, so its
/// postMessage fallback turns the same `Uint8Array` into a JSON array of numbers.
fn body_bytes(body: &InvokeBody) -> Option<Cow<'_, [u8]>> {
    match body {
        InvokeBody::Raw(bytes) => Some(Cow::Borrowed(bytes)),
        InvokeBody::Json(serde_json::Value::Array(items)) => items
            .iter()
            .map(|v| v.as_u64().and_then(|n| u8::try_from(n).ok()))
            .collect::<Option<Vec<u8>>>()
            .map(Cow::Owned),
        _ => None,
    }
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
    use super::{
        body_bytes, export_folder_files, folder_revision, import_folder_files, valid_name,
        validate_manifest, RecordingManifest, UnnaturalMark, VoiceEntry,
    };
    use std::fs;
    use tauri::ipc::InvokeBody;

    #[test]
    fn recording_body_is_raw_bytes_or_a_json_byte_array() {
        assert_eq!(&*body_bytes(&InvokeBody::Raw(vec![1, 2])).unwrap(), &[1, 2]);
        let json = InvokeBody::Json(serde_json::json!([0, 255, 82]));
        assert_eq!(&*body_bytes(&json).unwrap(), &[0, 255, 82]);
        assert!(body_bytes(&InvokeBody::Json(serde_json::json!([256]))).is_none());
        assert!(body_bytes(&InvokeBody::Json(serde_json::json!({"0": 1}))).is_none());
    }

    #[test]
    fn only_plain_file_names() {
        assert!(valid_name("NN21-S01_1700000000000.webm"));
        assert!(!valid_name("../x.webm"));
        assert!(!valid_name("a/b.webm"));
        assert!(!valid_name("a\\b.webm"));
        assert!(!valid_name(".hidden"));
        assert!(!valid_name(""));
    }

    #[test]
    fn rejects_unsafe_recording_folders() {
        let mut manifest = RecordingManifest {
            version: 1,
            recordings: vec![VoiceEntry {
                audio_id: "NN21-S01".into(),
                file_name: "NN21-S01.webm".into(),
                duration: None,
                file_path: None,
            }],
            marks: vec![UnnaturalMark {
                target_id: "NN21-S01".into(),
                target_type: "sentence".into(),
            }],
        };
        assert!(validate_manifest(&manifest).is_ok());
        manifest.recordings[0].file_name = "../escape.webm".into();
        assert!(validate_manifest(&manifest).is_err());
    }

    #[test]
    fn transfers_audio_and_marks_together() {
        let root =
            std::env::temp_dir().join(format!("dutch-tutor-recording-test-{}", std::process::id()));
        let original = root.join("original");
        let exported = root.join("exported");
        let imported = root.join("imported");
        fs::create_dir_all(&original).unwrap();
        fs::create_dir_all(&exported).unwrap();
        fs::write(original.join("NN21-S01.webm"), b"audio").unwrap();
        let manifest = RecordingManifest {
            version: 1,
            recordings: vec![VoiceEntry {
                audio_id: "NN21-S01".into(),
                file_name: "NN21-S01.webm".into(),
                duration: Some(1.2),
                file_path: None,
            }],
            marks: vec![UnnaturalMark {
                target_id: "NN21-S02".into(),
                target_type: "sentence".into(),
            }],
        };
        export_folder_files(&original, &exported, &manifest).unwrap();
        let revision = folder_revision(&exported).unwrap();
        assert_eq!(folder_revision(&exported).unwrap(), revision);
        // Even an edited audio file with an unchanged name/list is a new bundled revision.
        fs::write(exported.join("NN21-S01.webm"), b"new voice").unwrap();
        assert_ne!(folder_revision(&exported).unwrap(), revision);
        fs::write(exported.join("NN21-S01.webm"), b"audio").unwrap();
        let restored = import_folder_files(&exported, &imported).unwrap();
        assert_eq!(restored.marks[0].target_id, "NN21-S02");
        assert_eq!(
            fs::read(restored.recordings[0].file_path.as_ref().unwrap()).unwrap(),
            b"audio"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
