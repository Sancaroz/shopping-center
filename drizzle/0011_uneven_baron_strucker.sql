CREATE TABLE `homepage_blocks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`eyebrow_tr` text DEFAULT '' NOT NULL,
	`eyebrow_en` text DEFAULT '' NOT NULL,
	`title_tr` text NOT NULL,
	`title_en` text DEFAULT '' NOT NULL,
	`copy_tr` text DEFAULT '' NOT NULL,
	`copy_en` text DEFAULT '' NOT NULL,
	`button_tr` text DEFAULT 'Keşfet' NOT NULL,
	`button_en` text DEFAULT 'Explore' NOT NULL,
	`button_url` text DEFAULT '/magaza' NOT NULL,
	`image_url` text DEFAULT '' NOT NULL,
	`image_position` text DEFAULT 'left' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT CURRENT_TIMESTAMP NOT NULL
);
