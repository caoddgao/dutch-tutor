use tauri_plugin_sql::{Migration, MigrationKind};

/// Database location; the SQL plugin resolves it inside the app's config directory.
/// Must match `DB_URL` in `src/storage/db.ts`.
const DB_URL: &str = "sqlite:dutchtutor.db";

/// Schema migrations, applied in order on startup. Only append; never edit a released one.
fn migrations() -> Vec<Migration> {
    vec![Migration {
        version: 1,
        description: "init",
        sql: include_str!("../migrations/0001_init.sql"),
        kind: MigrationKind::Up,
    }]
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(
            tauri_plugin_sql::Builder::default()
                .add_migrations(DB_URL, migrations())
                .build(),
        )
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
