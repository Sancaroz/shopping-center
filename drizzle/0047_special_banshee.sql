CREATE TABLE `payment_webhook_receipts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_key` text NOT NULL,
	`provider` text NOT NULL,
	`mode` text NOT NULL,
	`event_type` text NOT NULL,
	`payload_hash` text NOT NULL,
	`payload_bytes` integer NOT NULL,
	`signature_timestamp` integer NOT NULL,
	`status` text DEFAULT 'awaiting_adapter' NOT NULL,
	`processed_at` text,
	`last_error` text DEFAULT '' NOT NULL,
	`received_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_webhook_receipts_event_key_unique` ON `payment_webhook_receipts` (`event_key`);