CREATE TABLE `inventory_operation_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`operation_key` text NOT NULL,
	`target_key` text NOT NULL,
	`product_id` integer NOT NULL,
	`variant_id` integer,
	`quantity` integer NOT NULL,
	FOREIGN KEY (`operation_key`) REFERENCES `inventory_operations`(`operation_key`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_operation_items_target` ON `inventory_operation_items` (`operation_key`,`target_key`);--> statement-breakpoint
ALTER TABLE `orders` ADD `inventory_operation_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `promotion_claim_state` text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE `promotions` ADD `last_claim_operation_key` text DEFAULT '' NOT NULL;