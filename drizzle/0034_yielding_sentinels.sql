CREATE TABLE `newsletter_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`subscriber_id` integer NOT NULL,
	`event_key` text NOT NULL,
	`event_type` text NOT NULL,
	`recipient` text NOT NULL,
	`subject` text NOT NULL,
	`body` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`last_error` text DEFAULT '' NOT NULL,
	`sent_at` text,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	`updated_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL,
	FOREIGN KEY (`subscriber_id`) REFERENCES `newsletter_subscribers`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `newsletter_outbox_event_key_unique` ON `newsletter_outbox` (`event_key`);--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `verification_token_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `verification_expires_at` text;--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `verified_at` text;--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `unsubscribe_token_hash` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `newsletter_subscribers` ADD `unsubscribed_at` text;--> statement-breakpoint
UPDATE `newsletter_subscribers` SET `status` = 'pending_verification', `verified_at` = NULL WHERE `status` = 'active';
