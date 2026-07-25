ALTER TABLE `orders` ADD `terms_consent_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `terms_version` text DEFAULT 'order-request-v1' NOT NULL;