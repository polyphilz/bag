import { Database } from "bun:sqlite";
import { drizzle, type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { migrate } from "drizzle-orm/bun-sqlite/migrator";
import { join, dirname } from "path";
import { getDbPath } from "../config.js";
import { FTS_SETUP_SQL } from "./schema.js";
import * as schema from "./schema.js";

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

  _db = db;
  _sqlite = sqlite;
  return db;
}

export function getSqlite(): Database {
  if (!_sqlite) getDb();
  return _sqlite!;
}
