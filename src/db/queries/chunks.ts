import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq } from "drizzle-orm";
import { ulid } from "ulidx";
import { chunks } from "../schema.js";
import type * as schema from "../schema.js";
import { getSqlite } from "../connection.js";

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
): string[] {
  if (inputs.length === 0) return [];
  const rows = inputs.map((c) => ({
    id: ulid(),
    sourceId,
    chunkIndex: c.chunkIndex,
    content: c.content,
    tokenCount: c.tokenCount,
  }));
  db.insert(chunks).values(rows).run();
  return rows.map((r) => r.id);
}

export function deleteChunksForSource(
  db: BunSQLiteDatabase<typeof schema>,
  sourceId: string
): void {
  db.delete(chunks).where(eq(chunks.sourceId, sourceId)).run();
}

export function insertChunkVectors(
  db: BunSQLiteDatabase<typeof schema>,
  chunkIds: string[],
  embeddings: Float32Array[]
): void {
  if (chunkIds.length === 0) return;
  const sqlite = getSqlite();
  const stmt = sqlite.prepare(
    "INSERT INTO chunks_vec(chunk_id, embedding) VALUES (?, vec_f32(?))"
  );
  const tx = sqlite.transaction(() => {
    for (let i = 0; i < chunkIds.length; i++) {
      stmt.run(chunkIds[i], embeddings[i] as unknown as Uint8Array);
    }
  });
  tx();
}

export function deleteChunkVectorsForSource(
  db: BunSQLiteDatabase<typeof schema>,
  sourceId: string
): void {
  const sqlite = getSqlite();
  sqlite.run(
    "DELETE FROM chunks_vec WHERE chunk_id IN (SELECT id FROM chunks WHERE source_id = ?)",
    [sourceId]
  );
}
