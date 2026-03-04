import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { join, dirname } from "path";
import * as sqliteVec from "sqlite-vec";
import { getDbPath } from "../config.js";
import { FTS_SETUP_SQL, VEC_SETUP_SQL } from "./schema.js";
import * as schema from "./schema.js";

// Bun's bundled SQLite doesn't support loadExtension().
// Use Homebrew SQLite which has extension loading enabled.
Database.setCustomSQLite("/opt/homebrew/opt/sqlite/lib/libsqlite3.dylib");

const MIGRATIONS_DIR = join(dirname(new URL(import.meta.url).pathname), "migrations");

let _db: BunSQLiteDatabase<typeof schema> | null = null;
let _sqlite: Database | null = null;

export function getDb(): BunSQLiteDatabase<typeof schema> {
  if (_db) return _db;

  const dbPath = getDbPath();
  const sqlite = new Database(dbPath);

  sqlite.run("PRAGMA journal_mode = WAL");
  sqlite.run("PRAGMA foreign_keys = ON");
  sqlite.run("PRAGMA busy_timeout = 5000");

  const db = drizzle(sqlite, { schema });

  migrate(db, { migrationsFolder: MIGRATIONS_DIR });

  // FTS5 virtual table + triggers (not expressible in Drizzle schema)
  sqlite.run(FTS_SETUP_SQL);

  // sqlite-vec extension + chunks_vec virtual table
  sqliteVec.load(sqlite);
  sqlite.run(VEC_SETUP_SQL);

  _db = db;
  _sqlite = sqlite;
  return db;
}

export function getSqlite(): Database {
  if (!_sqlite) getDb();
  return _sqlite!;
}
