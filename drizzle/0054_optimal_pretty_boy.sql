PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_cart_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`cart_id` integer NOT NULL,
	`product_id` integer NOT NULL,
	`variant_id` integer,
	`quantity` integer DEFAULT 1 NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`cart_id`) REFERENCES `carts`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`variant_id`) REFERENCES `product_variants`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
INSERT INTO `__new_cart_items`("id", "cart_id", "product_id", "variant_id", "quantity", "created_at")
SELECT MIN("id"), "cart_id", "product_id", "variant_id", CASE WHEN SUM("quantity") > 100 THEN 100 ELSE SUM("quantity") END, MIN("created_at")
FROM `cart_items`
GROUP BY "cart_id", "product_id", "variant_id";--> statement-breakpoint
DROP TABLE `cart_items`;--> statement-breakpoint
ALTER TABLE `__new_cart_items` RENAME TO `cart_items`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE UNIQUE INDEX `cart_items_cart_product_variant` ON `cart_items` (`cart_id`,`product_id`,`variant_id`) WHERE "cart_items"."variant_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `cart_items_cart_product_base` ON `cart_items` (`cart_id`,`product_id`) WHERE "cart_items"."variant_id" IS NULL;
