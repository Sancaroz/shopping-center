CREATE TABLE `categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_tr` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`slug` text NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `categories_slug_unique` ON `categories` (`slug`);--> statement-breakpoint
CREATE TABLE `product_variants` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`product_id` integer NOT NULL,
	`sku` text NOT NULL,
	`option_name` text DEFAULT '' NOT NULL,
	`option_value` text DEFAULT '' NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`price_adjustment` real DEFAULT 0 NOT NULL,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `product_variants_sku_unique` ON `product_variants` (`sku`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name_tr` text NOT NULL,
	`name_en` text DEFAULT '' NOT NULL,
	`slug` text NOT NULL,
	`description_tr` text DEFAULT '' NOT NULL,
	`description_en` text DEFAULT '' NOT NULL,
	`category_id` integer,
	`image_url` text DEFAULT '' NOT NULL,
	`price_tr` real DEFAULT 0 NOT NULL,
	`price_global` real DEFAULT 0 NOT NULL,
	`currency_global` text DEFAULT 'EUR' NOT NULL,
	`stock` integer DEFAULT 0 NOT NULL,
	`market_tr` integer DEFAULT true NOT NULL,
	`market_global` integer DEFAULT false NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_slug_unique` ON `products` (`slug`);--> statement-breakpoint
CREATE TABLE `store_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
