import Database from "@tauri-apps/plugin-sql";

/** Must match `DB_URL` in `src-tauri/src/lib.rs` (migrations are registered for this URL). */
export const DB_URL = "sqlite:dutchtutor.db";

/** The subset of the SQL plugin we use; lets tests substitute an in-memory database. */
export interface SqlDb {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
}

let dbPromise: Promise<SqlDb> | null = null;

/** Opens the database once; the plugin applies pending migrations on load. */
export function getDb(): Promise<SqlDb> {
  dbPromise ??= Database.load(DB_URL);
  return dbPromise;
}
