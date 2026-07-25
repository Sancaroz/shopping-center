CREATE TABLE `fulfillment_checklists` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`product_checked` integer DEFAULT false NOT NULL,
	`quantity_checked` integer DEFAULT false NOT NULL,
	`quality_checked` integer DEFAULT false NOT NULL,
	`package_checked` integer DEFAULT false NOT NULL,
	`address_checked` integer DEFAULT false NOT NULL,
	`completed_at` text,
	`actor_email` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fulfillment_checklists_order_id_unique` ON `fulfillment_checklists` (`order_id`);