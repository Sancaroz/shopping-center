ALTER TABLE `contact_messages` ADD `order_id` integer REFERENCES orders(id);--> statement-breakpoint
ALTER TABLE `contact_messages` ADD `priority` text DEFAULT 'normal' NOT NULL;--> statement-breakpoint
ALTER TABLE `contact_messages` ADD `assigned_to` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `contact_messages` ADD `admin_note` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `contact_messages` ADD `resolved_at` text;