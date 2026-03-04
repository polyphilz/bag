import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import { ulid } from "ulidx";
import { chunks } from "../schema.js";
import type * as schema from "../schema.js";

export type Chunk = typeof chunks.$inferSelect;

export interface ChunkInput {
  content: string;
  chunkIndex: number;
  tokenCount: number;
}

export function insertChunks(
  db: BunSQLiteDatabase<typeof schema>,
  sourceId: string,
  inputs: ChunkInput[]
): void {
  if (inputs.length === 0) return;
  const rows = inputs.map((c) => ({
    id: ulid(),
    sourceId,
    chunkIndex: c.chunkIndex,
    content: c.content,
    tokenCount: c.tokenCount,
  }));
  db.insert(chunks).values(rows).run();
}

export function deleteChunksForSource(
  db: BunSQLiteDatabase<typeof schema>,
  sourceId: string
): void {
  db.delete(chunks).where(eq(chunks.sourceId, sourceId)).run();
}
