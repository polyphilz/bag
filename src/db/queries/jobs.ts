import { type BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { eq, asc, sql } from "drizzle-orm";
import { ulid } from "ulidx";
import { jobs, JobStatus, type JobType } from "../schema.js";
import type * as schema from "../schema.js";

export type Job = typeof jobs.$inferSelect;

export interface QueueStats {
  PENDING: number;
  RUNNING: number;
  COMPLETED: number;
  FAILED: number;
}

export class JobQueue {
  constructor(private db: BunSQLiteDatabase<typeof schema>) {}

  enqueue(jobType: JobType, payload: Record<string, unknown>): string {
    const id = ulid();
    this.db
      .insert(jobs)
      .values({ id, jobType, payload: JSON.stringify(payload) })
      .run();
    return id;
  }

  enqueueBatch(
    batch: { jobType: JobType; payload: Record<string, unknown> }[]
  ): string[] {
    const rows = batch.map((job) => ({
      id: ulid(),
      jobType: job.jobType,
      payload: JSON.stringify(job.payload),
    }));
    this.db.insert(jobs).values(rows).run();
    return rows.map((r) => r.id);
  }

  claimBatch(limit: number): Job[] {
    const result = this.db.transaction((tx) => {
      const pending = tx
        .select()
        .from(jobs)
        .where(eq(jobs.status, JobStatus.PENDING))
        .orderBy(asc(jobs.createdAt))
        .limit(limit)
        .all();

      if (pending.length === 0) return [];

      for (const job of pending) {
        tx.update(jobs)
          .set({
            status: JobStatus.RUNNING,
            startedAt: sql`datetime('now')`,
            attempts: sql`${jobs.attempts} + 1`,
          })
          .where(eq(jobs.id, job.id))
          .run();
      }

      return pending.map((j) => ({
        ...j,
        status: JobStatus.RUNNING,
        attempts: j.attempts + 1,
      }));
    });
    return result;
  }

  markCompleted(jobId: string): void {
    this.db
      .update(jobs)
      .set({
        status: JobStatus.COMPLETED,
        completedAt: sql`datetime('now')`,
      })
      .where(eq(jobs.id, jobId))
      .run();
  }

  markFailed(jobId: string, error: string): void {
    const job = this.db
      .select({ attempts: jobs.attempts, maxAttempts: jobs.maxAttempts })
      .from(jobs)
      .where(eq(jobs.id, jobId))
      .get();

    if (job && job.attempts < job.maxAttempts) {
      this.db
        .update(jobs)
        .set({ status: JobStatus.PENDING, errorMessage: error })
        .where(eq(jobs.id, jobId))
        .run();
    } else {
      this.db
        .update(jobs)
        .set({
          status: JobStatus.FAILED,
          errorMessage: error,
          completedAt: sql`datetime('now')`,
        })
        .where(eq(jobs.id, jobId))
        .run();
    }
  }

  stats(): QueueStats {
    const rows = this.db
      .select({
        status: jobs.status,
        count: sql<number>`count(*)`,
      })
      .from(jobs)
      .groupBy(jobs.status)
      .all();

    const stats: QueueStats = {
      PENDING: 0,
      RUNNING: 0,
      COMPLETED: 0,
      FAILED: 0,
    };
    for (const row of rows) {
      if (row.status in stats) {
        stats[row.status as keyof QueueStats] = row.count;
      }
    }
    return stats;
  }
}
