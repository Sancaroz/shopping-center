ALTER TABLE `product_images` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `product_images` SET `updated_at` = COALESCE(`created_at`, CURRENT_TIMESTAMP) WHERE `updated_at` = '';--> statement-breakpoint
ALTER TABLE `product_variants` ADD `updated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `product_variants` SET `updated_at` = CURRENT_TIMESTAMP WHERE `updated_at` = '';
