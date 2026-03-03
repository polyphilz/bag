CREATE TABLE `chunks` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`source_id` text NOT NULL,
	`chunk_index` integer NOT NULL,
	`content` text NOT NULL,
	`token_count` integer,
	FOREIGN KEY (`source_id`) REFERENCES `sources`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `idx_chunks_source` ON `chunks` (`source_id`);--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`job_type` text NOT NULL,
	`payload` text DEFAULT '{}' NOT NULL,
	`status` text DEFAULT 'PENDING' NOT NULL,
	`started_at` text,
	`completed_at` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`error_message` text,
	CONSTRAINT "job_status_check" CHECK("jobs"."status" IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED'))
);
--> statement-breakpoint
CREATE INDEX `idx_jobs_status` ON `jobs` (`status`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_jobs_type` ON `jobs` (`job_type`);--> statement-breakpoint
CREATE TABLE `sources` (
	`id` text PRIMARY KEY NOT NULL,
	`created_at` text DEFAULT (datetime('now')) NOT NULL,
	`updated_at` text DEFAULT (datetime('now')) NOT NULL,
	`source_type` text NOT NULL,
	`uri` text NOT NULL,
	`platform` text,
	`status` text DEFAULT 'QUEUED' NOT NULL,
	`title` text,
	`summary` text,
	`raw_content` text,
	`tags` text,
	`metadata` text DEFAULT '{}',
	`content_hash` text,
	`file_mtime` real,
	`error_message` text,
	`processed_at` text,
	CONSTRAINT "source_type_check" CHECK("sources"."source_type" IN ('URL', 'FILE')),
	CONSTRAINT "source_status_check" CHECK("sources"."status" IN ('QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sources_uri_unique` ON `sources` (`uri`);--> statement-breakpoint
CREATE INDEX `idx_sources_status` ON `sources` (`status`);--> statement-breakpoint
CREATE INDEX `idx_sources_type` ON `sources` (`source_type`);--> statement-breakpoint
CREATE INDEX `idx_sources_uri` ON `sources` (`uri`);--> statement-breakpoint
CREATE INDEX `idx_sources_created` ON `sources` (`created_at`);