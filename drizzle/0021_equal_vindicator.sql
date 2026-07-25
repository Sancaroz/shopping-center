CREATE TABLE `request_throttles` (
	`key_hash` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`request_count` integer DEFAULT 0 NOT NULL,
	`window_started_at` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
