// Test helper: an in-memory SQLite database (node:sqlite) with the app's migrations applied,
// exposed through the same interface as the Tauri SQL plugin.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { SqlDb } from "./db";

export const MIGRATIONS_DIR = join(import.meta.dirname, "../../src-tauri/migrations");

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

/** Converts the plugin's `$1` placeholders to node:sqlite's `?1`. */
function toNodeSql(query: string): string {
  return query.replace(/\$(\d+)/g, "?$1");
}

export function createTestDb(): { raw: DatabaseSync; db: SqlDb } {
  const raw = new DatabaseSync(":memory:");
  for (const file of migrationFiles()) raw.exec(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
  const db: SqlDb = {
    async execute(query, bindValues = []) {
      return raw.prepare(toNodeSql(query)).run(...(bindValues as never[]));
    },
    async select<T>(query: string, bindValues: unknown[] = []) {
      return raw.prepare(toNodeSql(query)).all(...(bindValues as never[])) as T;
    },
  };
  return { raw, db };
}
