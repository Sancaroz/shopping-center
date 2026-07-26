CREATE TABLE `privacy_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`request_number` text NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`request_type` text NOT NULL,
	`details` text NOT NULL,
	`order_number` text DEFAULT '' NOT NULL,
	`order_id` integer,
	`identity_status` text DEFAULT 'unverified' NOT NULL,
	`status` text DEFAULT 'new' NOT NULL,
	`due_at` text NOT NULL,
	`assigned_to` text DEFAULT '' NOT NULL,
	`admin_note` text DEFAULT '' NOT NULL,
	`response_summary` text DEFAULT '' NOT NULL,
	`resolved_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `privacy_requests_request_number_unique` ON `privacy_requests` (`request_number`);