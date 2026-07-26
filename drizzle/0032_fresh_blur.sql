CREATE TABLE `payment_transactions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`order_id` integer NOT NULL,
	`transaction_key` text NOT NULL,
	`kind` text NOT NULL,
	`status` text NOT NULL,
	`provider` text NOT NULL,
	`provider_reference` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`source` text DEFAULT 'manual' NOT NULL,
	`reconciliation_status` text NOT NULL,
	`expected_amount` real NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`occurred_at` text NOT NULL,
	`actor_email` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE restrict
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_transaction_key_unique` ON `payment_transactions` (`transaction_key`);