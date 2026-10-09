import type { SqlDb } from "./db";
import type { SettingsStore } from "./settingsStore";

interface Row {
  key: string;
  value: string;
}

export function createSqliteSettingsStore(open: () => Promise<SqlDb>): SettingsStore {
  return {
    async load() {
      const db = await open();
      const rows = await db.select<Row[]>("SELECT key, value FROM settings");
      const out: Record<string, unknown> = {};
      for (const row of rows) {
        try {
          out[row.key] = JSON.parse(row.value);
        } catch {
          // ignore a corrupt value; the default will be used
        }
      }
      return out;
    },
    async save(key, value) {
      const db = await open();
      await db.execute(
        `INSERT INTO settings (key, value, updated_at) VALUES ($1, $2, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
        [key, JSON.stringify(value)],
      );
    },
  };
}
