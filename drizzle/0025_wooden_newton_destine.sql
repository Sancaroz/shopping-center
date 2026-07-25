ALTER TABLE `orders` ADD `billing_type` text DEFAULT 'individual' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `billing_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `billing_address` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `billing_city` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `billing_postal_code` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `billing_country` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `billing_tax_office` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `billing_tax_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `pricing_tax_status` text DEFAULT 'pending' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `seller_snapshot_json` text DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `invoice_status` text DEFAULT 'draft' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `invoice_number` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `orders` ADD `invoiced_at` text;