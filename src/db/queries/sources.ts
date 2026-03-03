import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq, and, desc, type SQL } from "drizzle-orm";
import { ulid } from "ulidx";
import { sources, type SourceType, type Platform } from "../schema.js";
import type * as schema from "../schema.js";

export type Source = typeof sources.$inferSelect;

export function createSource(
  db: BunSQLiteDatabase<typeof schema>,
  opts: { uri: string; sourceType: SourceType; platform?: Platform }
): string {
  const id = ulid();
  db.insert(sources)
    .values({
      id,
      uri: opts.uri,
      sourceType: opts.sourceType,
      platform: opts.platform ?? null,
    })
    .run();
  return id;
}

export function getSourceByUri(
  db: BunSQLiteDatabase<typeof schema>,
  uri: string
): Source | undefined {
  return db.select().from(sources).where(eq(sources.uri, uri)).get();
}

export function listSources(
  db: BunSQLiteDatabase<typeof schema>,
  opts?: { status?: string; type?: string; limit?: number }
): Source[] {
  const conditions: SQL[] = [];

  if (opts?.status) {
    conditions.push(eq(sources.status, opts.status));
  }
  if (opts?.type) {
    conditions.push(eq(sources.sourceType, opts.type));
  }

  let query = db
    .select()
    .from(sources)
    .orderBy(desc(sources.createdAt))
    .$dynamic();

  if (conditions.length) {
    query = query.where(and(...conditions));
  }
  if (opts?.limit) {
    query = query.limit(opts.limit);
  }

  return query.all();
}
