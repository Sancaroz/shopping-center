ALTER TABLE `inventory_movements` ADD `operation_key` text;--> statement-breakpoint
CREATE UNIQUE INDEX `inventory_movements_operation_key` ON `inventory_movements` (`operation_key`) WHERE "inventory_movements"."operation_key" IS NOT NULL;--> statement-breakpoint
ALTER TABLE `product_variants` ADD `last_stock_operation_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `products` ADD `last_stock_operation_key` text DEFAULT '' NOT NULL;