CREATE TABLE `replenishments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`reference` text NOT NULL,
	`product_id` integer,
	`variant_id` integer,
	`product_name` text NOT NULL,
	`variant_label` text DEFAULT '' NOT NULL,
	`sourcing_type` text NOT NULL,
	`supplier_name` text DEFAULT '' NOT NULL,
	`quantity` integer NOT NULL,
	`unit_cost` real DEFAULT 0 NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`expected_at` text,
	`ordered_at` text,
	`received_at` text,
	`note` text DEFAULT '' NOT NULL,
	`actor_email` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `replenishments_reference_unique` ON `replenishments` (`reference`);