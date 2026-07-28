ALTER TABLE `homepage_blocks` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `homepage_blocks` SET `updated_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP) WHERE `updated_at` = '';
