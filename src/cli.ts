#!/usr/bin/env bun

import { Command } from "commander";
import { resolve } from "path";
import { existsSync } from "fs";
import { getDb } from "./db/connection.js";
import { createSource, getSourceByUri, listSources } from "./db/queries/sources.js";
import { JobQueue } from "./db/queries/jobs.js";
import { SourceType, Platform, JobType } from "./db/schema.js";

function detectPlatform(url: string): Platform {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    if (hostname === "twitter.com" || hostname === "x.com") return Platform.TWITTER;
    if (hostname === "reddit.com" || hostname.endsWith(".reddit.com")) return Platform.REDDIT;
    if (hostname === "youtube.com" || hostname === "youtu.be") return Platform.YOUTUBE;
    if (hostname === "github.com") return Platform.GITHUB;
    return Platform.GENERIC;
  } catch {
    return Platform.GENERIC;
  }
}

const program = new Command();

program
  .name("bag")
  .description("Local-first CLI for ingesting, indexing, and searching content")
  .version("0.1.0")
  .action(() => {
    console.log("TUI not yet implemented. Use --help to see available commands.");
  });

program
  .command("add <uri>")
  .description("Add a URL or file to bag")
  .action((uri: string) => {
    const db = getDb();
    const queue = new JobQueue(db);

    let sourceType: SourceType;
    let platform: Platform | undefined;
    let resolvedUri = uri;

    if (uri.startsWith("http://") || uri.startsWith("https://")) {
      sourceType = SourceType.URL;
      platform = detectPlatform(uri);
    } else {
      resolvedUri = resolve(uri);
      if (!existsSync(resolvedUri)) {
        console.error(`Error: file not found: ${resolvedUri}`);
        process.exit(1);
      }
      sourceType = SourceType.FILE;
    }

    const existing = getSourceByUri(db, resolvedUri);
    if (existing) {
      console.log(`Source already exists: ${resolvedUri} (${existing.status})`);
      return;
    }

    const sourceId = createSource(db, { uri: resolvedUri, sourceType, platform });
    queue.enqueue(JobType.PROCESS_SOURCE, {
      sourceId,
      uri: resolvedUri,
      sourceType,
      platform: platform ?? null,
    });
    console.log(`Added ${sourceType}: ${resolvedUri}`);
  });

program
  .command("sources")
  .description("List all sources")
  .option("-s, --status <status>", "Filter by status")
  .option("-t, --type <type>", "Filter by source type")
  .action((opts) => {
    const db = getDb();
    const sources = listSources(db, { status: opts.status, type: opts.type });

    if (sources.length === 0) {
      console.log("No sources found.");
      return;
    }

    const header = [
      "TYPE".padEnd(10),
      "PLATFORM".padEnd(10),
      "STATUS".padEnd(12),
      "URI",
    ].join("  ");
    console.log(header);
    console.log("-".repeat(header.length + 20));

    for (const s of sources) {
      const uri = s.uri.length > 60 ? s.uri.slice(0, 57) + "..." : s.uri;
      console.log(
        [
          s.sourceType.padEnd(10),
          (s.platform || "").padEnd(10),
          s.status.padEnd(12),
          uri,
        ].join("  ")
      );
    }
  });

program
  .command("status")
  .description("Show job queue status")
  .action(() => {
    const db = getDb();
    const queue = new JobQueue(db);
    const stats = queue.stats();
    console.log("Job queue:");
    console.log(`  pending:   ${stats.PENDING}`);
    console.log(`  running:   ${stats.RUNNING}`);
    console.log(`  completed: ${stats.COMPLETED}`);
    console.log(`  failed:    ${stats.FAILED}`);
  });

program.parse();
