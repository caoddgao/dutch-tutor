mod azure;
mod backup;
mod pack;
mod recordings;
mod startup;
#[cfg(desktop)]
mod tray;

use tauri::Manager;
use tauri_plugin_sql::{Migration, MigrationKind};

/// Database location; the SQL plugin resolves it inside the app's config directory.
/// Must match `DB_URL` in `src/storage/db.ts`.
const DB_URL: &str = "sqlite:dutchtutor.db";

/// Schema migrations, applied in order on startup. Only append; never edit a released one.
fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "init",
            sql: include_str!("../migrations/0001_init.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "exam results",
            sql: include_str!("../migrations/0002_exam_results.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "feedback context",
            sql: include_str!("../migrations/0003_feedback_context.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "practice",
            sql: include_str!("../migrations/0004_practice.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let probe = startup::Probe::from_env();
    let builder = tauri::Builder::default();
    // registered first, so a second launch only brings back the running window
    #[cfg(desktop)]
    let builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
        tray::show_main(app);
    }));
    builder
        .manage(probe)
        .plugin(tauri_plugin_dialog::init())
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![
            pack::pack_info,
            pack::inspect_pack,
            pack::import_pack,
            pack::read_pack_file,
            recordings::save_recording,
            recordings::delete_recording,
            recordings::export_recording_folder,
            recordings::import_recording_folder,
            recordings::write_recording_transcript,
            azure::azure_status,
            azure::save_azure_config,
            azure::clear_azure_key,
            azure::test_azure_connection,
            azure::assess_pronunciation,
            backup::write_export_file,
            backup::read_backup_file,
            backup::save_safety_backup,
            startup::startup_ready,
        ])
        .on_window_event(|_window, _event| {
            #[cfg(desktop)]
            tray::on_window_event(_window, _event);
        })
        .on_page_load(|webview, payload| {
            if payload.event() == tauri::webview::PageLoadEvent::Started {
                webview.state::<startup::Probe>().mark_page_start();
            }
        })
        .setup(|app| {
            app.state::<startup::Probe>().mark_setup();
            #[cfg(desktop)]
            tray::create(app.handle())?;
            #[cfg(windows)]
            if let Some(window) = tauri::Manager::get_webview_window(app, "main") {
                microphone::allow_microphone(&window);
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

/// Windows: WebView2 asks before a page may use the microphone, and the answer is not always kept.
/// The window only ever shows this app, so microphone requests (shadowing recordings) are allowed;
/// every other permission keeps WebView2's default behaviour.
#[cfg(windows)]
mod microphone {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PERMISSION_KIND, COREWEBVIEW2_PERMISSION_KIND_MICROPHONE,
        COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    };
    use webview2_com::PermissionRequestedEventHandler;

    pub fn allow_microphone(window: &tauri::WebviewWindow) {
        let _ = window.with_webview(|webview| unsafe {
            let Ok(core) = webview.controller().CoreWebView2() else {
                return;
            };
            let handler = PermissionRequestedEventHandler::create(Box::new(|_, args| {
                if let Some(args) = args {
                    let mut kind = COREWEBVIEW2_PERMISSION_KIND::default();
                    args.PermissionKind(&mut kind)?;
                    if kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE {
                        args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW)?;
                    }
                }
                Ok(())
            }));
            let mut token = 0i64;
            let _ = core.add_PermissionRequested(&handler, &mut token);
        });
    }
}
