import { sqliteTable, text, integer, real, index, check } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// --- Enums ---

export enum SourceType {
  URL = "URL",
  FILE = "FILE",
}

export enum SourceStatus {
  QUEUED = "QUEUED",
  PROCESSING = "PROCESSING",
  PROCESSED = "PROCESSED",
  FAILED = "FAILED",
}

export enum JobStatus {
  PENDING = "PENDING",
  RUNNING = "RUNNING",
  COMPLETED = "COMPLETED",
  FAILED = "FAILED",
}

export enum Platform {
  TWITTER = "TWITTER",
  REDDIT = "REDDIT",
  YOUTUBE = "YOUTUBE",
  GITHUB = "GITHUB",
  GENERIC = "GENERIC",
}

export enum JobType {
  PROCESS_SOURCE = "PROCESS_SOURCE",
}

// --- Base columns (every table gets these) ---

const baseColumns = {
  id: text("id").primaryKey(),
  createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  updatedAt: text("updated_at").notNull().default(sql`(datetime('now'))`),
};

// --- Tables ---

export const sources = sqliteTable(
  "sources",
  {
    ...baseColumns,
    sourceType: text("source_type").notNull(),
    uri: text("uri").notNull().unique(),
    platform: text("platform"),
    status: text("status").notNull().default(SourceStatus.QUEUED),
    title: text("title"),
    summary: text("summary"),
    rawContent: text("raw_content"),
    tags: text("tags"),
    metadata: text("metadata").default("{}"),
    contentHash: text("content_hash"),
    fileMtime: real("file_mtime"),
    errorMessage: text("error_message"),
    processedAt: text("processed_at"),
  },
  (table) => [
    index("idx_sources_status").on(table.status),
    index("idx_sources_type").on(table.sourceType),
    index("idx_sources_uri").on(table.uri),
    index("idx_sources_created").on(table.createdAt),
    check(
      "source_type_check",
      sql`${table.sourceType} IN ('URL', 'FILE')`
    ),
    check(
      "source_status_check",
      sql`${table.status} IN ('QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED')`
    ),
  ]
);

export const chunks = sqliteTable(
  "chunks",
  {
    ...baseColumns,
    sourceId: text("source_id")
      .notNull()
      .references(() => sources.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
  },
  (table) => [index("idx_chunks_source").on(table.sourceId)]
);

export const jobs = sqliteTable(
  "jobs",
  {
    ...baseColumns,
    jobType: text("job_type").notNull(),
    payload: text("payload").notNull().default("{}"),
    status: text("status").notNull().default(JobStatus.PENDING),
    startedAt: text("started_at"),
    completedAt: text("completed_at"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(3),
    errorMessage: text("error_message"),
  },
  (table) => [
    index("idx_jobs_status").on(table.status, table.createdAt),
    index("idx_jobs_type").on(table.jobType),
    check(
      "job_status_check",
      sql`${table.status} IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')`
    ),
  ]
);

// --- FTS5 ---
// chunks_fts virtual table and sync triggers are created via raw SQL
// in connection.ts after Drizzle migrations run, since Drizzle cannot
// express FTS5 virtual tables or triggers.

export const FTS_SETUP_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_fts USING fts5(
  content,
  content_rowid='rowid',
  tokenize='porter unicode61'
);

CREATE TRIGGER IF NOT EXISTS chunks_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS chunks_ad AFTER DELETE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', OLD.rowid, OLD.content);
END;

CREATE TRIGGER IF NOT EXISTS chunks_au AFTER UPDATE ON chunks BEGIN
  INSERT INTO chunks_fts(chunks_fts, rowid, content) VALUES ('delete', OLD.rowid, OLD.content);
  INSERT INTO chunks_fts(rowid, content) VALUES (NEW.rowid, NEW.content);
END;
`;

// --- sqlite-vec ---
// chunks_vec virtual table for vector similarity search.
// Created via raw SQL in connection.ts after migrations + FTS setup.

export const VEC_SETUP_SQL = `
CREATE VIRTUAL TABLE IF NOT EXISTS chunks_vec USING vec0(
  chunk_id TEXT PRIMARY KEY,
  embedding float[1024]
);
`;
