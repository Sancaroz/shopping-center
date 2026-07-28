ALTER TABLE `carts` ADD `revision` text DEFAULT '' NOT NULL;--> statement-breakpoint
UPDATE `carts` SET `revision` = 'legacy-' || `id` || '-' || lower(hex(randomblob(16))) WHERE `revision` = '';
