CREATE TABLE `inventory_movements` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`variant_id` integer,
	`order_id` integer,
	`movement_type` text NOT NULL,
	`quantity_delta` integer NOT NULL,
	`previous_stock` integer NOT NULL,
	`next_stock` integer NOT NULL,
	`reason` text DEFAULT '' NOT NULL,
	`reference` text DEFAULT '' NOT NULL,
	`actor_email` text DEFAULT 'system' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `products` ADD `sourcing_type` text DEFAULT 'factory' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `supplier_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `supplier_contact` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `supplier_sku` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `unit_cost` real DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `lead_time_days` integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `reorder_point` integer DEFAULT 5 NOT NULL;