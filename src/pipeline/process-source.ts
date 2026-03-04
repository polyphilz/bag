import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../db/schema.js";
import { SourceType, SourceStatus } from "../db/schema.js";
import { getSource, updateSource } from "../db/queries/sources.js";
import { insertChunks, deleteChunksForSource } from "../db/queries/chunks.js";
import { extractFile, detectFileKind } from "./extract.js";
import { chunkText } from "./chunk.js";

export async function processSource(
  db: BunSQLiteDatabase<typeof schema>,
  sourceId: string
): Promise<void> {
  const source = getSource(db, sourceId);
  if (!source) {
    throw new Error(`Source not found: ${sourceId}`);
  }

  updateSource(db, sourceId, {
    status: SourceStatus.PROCESSING,
    errorMessage: null,
  });

  try {
    if (source.sourceType !== SourceType.FILE) {
      throw new Error(
        `URL extraction not yet implemented (source type: ${source.sourceType})`
      );
    }

    const extracted = await extractFile(source.uri);

    updateSource(db, sourceId, {
      rawContent: extracted.text,
      title: extracted.title,
      contentHash: extracted.contentHash,
      fileMtime: extracted.fileMtime,
    });

    const kind = detectFileKind(source.uri);
    const contentType = kind === "unsupported" ? "text" : kind;
    const chunks = chunkText(extracted.text, {
      sourceUri: source.uri,
      contentType,
    });

    deleteChunksForSource(db, sourceId);
    insertChunks(db, sourceId, chunks);

    updateSource(db, sourceId, {
      status: SourceStatus.PROCESSED,
      processedAt: new Date().toISOString(),
    });
  } catch (err) {
    updateSource(db, sourceId, {
      status: SourceStatus.FAILED,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
