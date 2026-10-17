//! android-spike branch only (batch 2): feasibility probes for the Android shell. Never merge.
//! The spike page (`android-spike/`) calls these next to the real commands (SQL, recordings, Azure).
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{fs, io, path::Path, time::Instant};
use tauri::{AppHandle, Manager, Runtime, State};

/// Asset folder holding the fake pack (see `scripts/make-spike-pack.mjs`).
const ASSET_DIR: &str = "spike-pack";

#[derive(Serialize)]
pub struct CopyReport {
    resource_dir: String,
    /// What `std::fs::read_dir(resource_dir)` says on this platform (family.rs relies on it today).
    std_fs: String,
    dest: String,
    files: usize,
    bytes: u64,
    copy_ms: u128,
    verify_ms: u128,
    bad: Vec<String>,
}

#[tauri::command]
pub async fn spike_copy_pack<R: Runtime>(app: AppHandle<R>) -> Result<CopyReport, String> {
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let std_fs = match fs::read_dir(resource_dir.join(ASSET_DIR)) {
        Ok(entries) => format!("ok, {} entries", entries.count()),
        Err(e) => format!("error: {e}"),
    };
    let dest = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("nn-pack");
    let resource_dir = resource_dir.display().to_string();
    tauri::async_runtime::spawn_blocking(move || {
        let index = read_index()?;
        let started = Instant::now();
        let mut bytes = 0;
        for (rel, _) in &index {
            let target = dest.join(rel);
            fs::create_dir_all(target.parent().unwrap()).map_err(|e| e.to_string())?;
            let mut out = fs::File::create(&target).map_err(|e| e.to_string())?;
            bytes += copy_asset(&format!("{ASSET_DIR}/{rel}"), &mut out)?;
        }
        let copy_ms = started.elapsed().as_millis();
        let started = Instant::now();
        let bad = index
            .iter()
            .filter(|(rel, sha)| sha256_file(&dest.join(rel)).ok().as_deref() != Some(sha))
            .map(|(rel, _)| rel.clone())
            .collect();
        Ok(CopyReport {
            resource_dir,
            std_fs,
            dest: dest.display().to_string(),
            files: index.len(),
            bytes,
            copy_ms,
            verify_ms: started.elapsed().as_millis(),
            bad,
        })
    })
    .await
    .map_err(|e| e.to_string())?
}

/// `index.txt`: one `relative/path<TAB>sha256` per line. AssetManager cannot list sub folders,
/// so the build writes the file list next to the files.
fn read_index() -> Result<Vec<(String, String)>, String> {
    let mut text = Vec::new();
    copy_asset(&format!("{ASSET_DIR}/index.txt"), &mut text)?;
    let text = String::from_utf8(text).map_err(|e| e.to_string())?;
    Ok(text
        .lines()
        .filter_map(|l| l.split_once('\t'))
        .map(|(p, h)| (p.to_string(), h.trim().to_string()))
        .collect())
}

fn sha256_file(path: &Path) -> io::Result<String> {
    let mut hasher = Sha256::new();
    io::copy(&mut fs::File::open(path)?, &mut hasher)?;
    Ok(format!("{:x}", hasher.finalize()))
}

/// Streams one APK asset through the NDK AssetManager (works for stored and compressed entries).
#[cfg(target_os = "android")]
fn copy_asset(name: &str, out: &mut impl io::Write) -> Result<u64, String> {
    use std::{ffi::CString, ptr::NonNull};
    let ctx = ndk_context::android_context();
    let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.map_err(|e| e.to_string())?;
    let mut env = vm.attach_current_thread().map_err(|e| e.to_string())?;
    let context = unsafe { jni::objects::JObject::from_raw(ctx.context().cast()) };
    let assets = env
        .call_method(
            &context,
            "getAssets",
            "()Landroid/content/res/AssetManager;",
            &[],
        )
        .and_then(|v| v.l())
        .map_err(|e| e.to_string())?;
    // `assets` (a local reference) stays alive until this function returns.
    let ptr =
        unsafe { ndk_sys::AAssetManager_fromJava(env.get_raw().cast(), assets.as_raw().cast()) };
    let manager =
        unsafe { ndk::asset::AssetManager::from_ptr(NonNull::new(ptr).ok_or("no asset manager")?) };
    let name = CString::new(name).map_err(|e| e.to_string())?;
    let mut asset = manager
        .open(&name)
        .ok_or_else(|| format!("missing asset {name:?}"))?;
    io::copy(&mut asset, out).map_err(|e| e.to_string())
}

#[cfg(not(target_os = "android"))]
fn copy_asset(_name: &str, _out: &mut impl io::Write) -> Result<u64, String> {
    Err("android only".into())
}

/// Cold start as Android sees it: milliseconds since the launch was requested (tap on the icon,
/// API 33+) and since the process started, plus the existing startup probe.
/// (`/proc/uptime` is not readable for apps on Android 16, so the first attempt gave nothing.)
#[tauri::command]
pub fn spike_startup(probe: State<'_, crate::startup::Probe>, page_ms: f64) -> serde_json::Value {
    let mut timings = probe.snapshot();
    timings["page_ms"] = serde_json::json!(page_ms);
    #[cfg(target_os = "android")]
    {
        let clock = |class: &str, method: &str| -> Option<f64> {
            let ctx = ndk_context::android_context();
            let vm = unsafe { jni::JavaVM::from_raw(ctx.vm().cast()) }.ok()?;
            let mut env = vm.attach_current_thread().ok()?;
            let value = env.call_static_method(class, method, "()J", &[]);
            if env.exception_check().unwrap_or(false) {
                let _ = env.exception_clear();
                return None;
            }
            value.ok()?.j().ok().map(|ms| ms as f64)
        };
        let now = clock("android/os/SystemClock", "elapsedRealtime");
        let since = |method: &str| Some(now? - clock("android/os/Process", method)?);
        timings["since_tap_ms"] = serde_json::json!(since("getStartRequestedElapsedRealtime"));
        timings["since_process_ms"] = serde_json::json!(since("getStartElapsedRealtime"));
    }
    timings
}
