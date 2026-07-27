ALTER TABLE `newsletter_outbox` ADD `delivery_claim_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `newsletter_outbox` ADD `delivery_claimed_at` text;--> statement-breakpoint
ALTER TABLE `newsletter_outbox` ADD `next_attempt_at` text;--> statement-breakpoint
ALTER TABLE `newsletter_outbox` ADD `provider_message_id` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `delivery_claim_key` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `delivery_claimed_at` text;--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `next_attempt_at` text;--> statement-breakpoint
ALTER TABLE `notification_outbox` ADD `provider_message_id` text DEFAULT '' NOT NULL;