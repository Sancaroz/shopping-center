ALTER TABLE `orders` ADD `email_verified_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `verification_token_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `verification_expires_at` text;