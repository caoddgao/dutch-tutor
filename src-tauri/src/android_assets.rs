//! Android only: files bundled into the APK (`bundle.resources`) are APK assets. `resource_dir()` is
//! `asset://localhost/`, which `std::fs` cannot read, so stream them through the NDK AssetManager
//! (works for stored and compressed entries). AssetManager cannot list sub folders: the build writes
//! a file list next to them (scripts/build-family-android.mjs).
use std::{ffi::CString, io, ptr::NonNull};

/// Streams one asset (path relative to the APK's `assets/`) into `out`.
pub fn copy(name: &str, out: &mut impl io::Write) -> Result<u64, String> {
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

/// Reads a small asset into memory; `None` when the APK does not contain it.
pub fn read(name: &str) -> Option<Vec<u8>> {
    let mut bytes = Vec::new();
    copy(name, &mut bytes).ok()?;
    Some(bytes)
}
