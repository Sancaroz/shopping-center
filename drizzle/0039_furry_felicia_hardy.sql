ALTER TABLE `privacy_requests` ADD `request_key` text;--> statement-breakpoint
ALTER TABLE `privacy_requests` ADD `privacy_acknowledged_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `privacy_requests_request_key_unique` ON `privacy_requests` (`request_key`);--> statement-breakpoint
ALTER TABLE `return_requests` ADD `request_key` text;--> statement-breakpoint
ALTER TABLE `return_requests` ADD `privacy_acknowledged_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `return_requests_request_key_unique` ON `return_requests` (`request_key`);