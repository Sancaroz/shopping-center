ALTER TABLE `orders` ADD `terms_snapshot_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `terms_snapshot_hash` text DEFAULT '' NOT NULL;