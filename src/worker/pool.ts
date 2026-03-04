import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import type * as schema from "../db/schema.js";
import { JobType } from "../db/schema.js";
import { JobQueue, type Job } from "../db/queries/jobs.js";
import { processSource } from "../pipeline/process-source.js";

export interface PoolOptions {
  concurrency: number;
  pollIntervalMs: number;
  watch: boolean;
}

export async function runWorkerPool(
  db: BunSQLiteDatabase<typeof schema>,
  opts: PoolOptions
): Promise<void> {
  const queue = new JobQueue(db);

  const processBatch = async (): Promise<number> => {
    const batch = queue.claimBatch(opts.concurrency);
    if (batch.length === 0) return 0;

    const results = await Promise.allSettled(
      batch.map((job) => runJob(db, queue, job))
    );

    let succeeded = 0;
    for (const r of results) {
      if (r.status === "fulfilled") succeeded++;
    }
    return succeeded;
  };

  if (opts.watch) {
    console.log(
      `Worker started (concurrency=${opts.concurrency}, polling every ${opts.pollIntervalMs}ms)`
    );
    while (true) {
      const processed = await processBatch();
      if (processed === 0) {
        await Bun.sleep(opts.pollIntervalMs);
      }
    }
  } else {
    let total = 0;
    while (true) {
      const processed = await processBatch();
      total += processed;
      if (processed === 0) break;
    }
    console.log(`Processed ${total} job(s).`);
  }
}

async function runJob(
  db: BunSQLiteDatabase<typeof schema>,
  queue: JobQueue,
  job: Job
): Promise<void> {
  try {
    if (job.jobType !== JobType.PROCESS_SOURCE) {
      throw new Error(`Unknown job type: ${job.jobType}`);
    }
    const payload = JSON.parse(job.payload) as { sourceId: string };
    await processSource(db, payload.sourceId);
    queue.markCompleted(job.id);
  } catch (err) {
    queue.markFailed(job.id, err instanceof Error ? err.message : String(err));
  }
}
