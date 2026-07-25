ALTER TABLE `orders` ADD `payment_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_provider` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `payment_reference` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipping_carrier` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `tracking_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `shipped_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `internal_note` text DEFAULT '' NOT NULL;