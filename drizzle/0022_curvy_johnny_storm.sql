ALTER TABLE `orders` ADD `reservation_state` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `reservation_expires_at` text;