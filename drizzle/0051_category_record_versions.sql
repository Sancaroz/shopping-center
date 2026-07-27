ALTER TABLE `categories` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `categories` SET `updated_at` = CURRENT_TIMESTAMP WHERE `updated_at` = '';
