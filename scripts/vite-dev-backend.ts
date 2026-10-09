// Browser dev server only (npm run dev): stands in for the desktop shell so pages can be tried and
// screenshotted without Tauri. /__dev/pack/* serves the fixture pack; /__dev/sql runs queries on an
// in-memory SQLite database with the app's migrations (node:sqlite). Never part of a build.
import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Plugin } from "vite";

const ROOT = join(import.meta.dirname, "..");
const PACK = join(ROOT, "fixtures/nn-pack");
const MIGRATIONS = join(ROOT, "src-tauri/migrations");
const TYPES: Record<string, string> = { ".json": "application/json", ".mp3": "audio/mpeg", ".md": "text/plain" };

function openDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  for (const f of readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()) {
    db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  return db;
}

export function devBackend(): Plugin {
  let db: DatabaseSync | null = null;
  return {
    name: "dutch-tutor-dev-backend",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use("/__dev/pack", (req, res) => {
        const rel = normalize(decodeURIComponent((req.url ?? "/").split("?")[0])).replace(/^([/\\])+/, "");
        const file = join(PACK, rel);
        if (!file.startsWith(PACK) || !existsSync(file) || !statSync(file).isFile()) {
          res.statusCode = 404;
          res.end();
          return;
        }
        res.setHeader("Content-Type", TYPES[extname(file)] ?? "application/octet-stream");
        createReadStream(file).pipe(res);
      });
      server.middlewares.use("/__dev/sql", (req, res) => {
        let body = "";
        req.on("data", (c: Buffer) => (body += c.toString()));
        req.on("end", () => {
          try {
            db ??= openDb();
            const { query, params, mode } = JSON.parse(body) as { query: string; params: never[]; mode: string };
            const stmt = db.prepare(query.replace(/\$(\d+)/g, "?$1"));
            const out = mode === "select" ? stmt.all(...params) : { ...stmt.run(...params), lastInsertId: undefined };
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(out, (_k, v) => (typeof v === "bigint" ? Number(v) : v)));
          } catch (e) {
            res.statusCode = 500;
            res.end(String((e as Error).message));
          }
        });
      });
    },
  };
}
