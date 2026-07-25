CREATE TABLE `shipment_events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`status` text NOT NULL,
	`title_tr` text NOT NULL,
	`title_en` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`location` text DEFAULT '' NOT NULL,
	`occurred_at` text NOT NULL,
	`visible_to_customer` integer DEFAULT true NOT NULL,
	`actor_email` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `orders` ADD `delivery_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `estimated_delivery_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `delivered_at` text;--> statement-breakpoint
ALTER TABLE `orders` ADD `last_shipment_event_at` text;