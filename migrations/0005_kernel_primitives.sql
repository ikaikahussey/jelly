CREATE TABLE `kernel_users` (
	`user_id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`avatar_r2_key` text,
	`profile_json` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);--> statement-breakpoint
CREATE UNIQUE INDEX `kernel_users_email_unique` ON `kernel_users` (`email`);--> statement-breakpoint
CREATE TABLE `kernel_relationships` (
	`from_user` text NOT NULL,
	`to_user` text NOT NULL,
	`rel_type` text NOT NULL,
	`metadata_json` text DEFAULT '{}',
	`created_at` integer NOT NULL,
	FOREIGN KEY (`from_user`) REFERENCES `kernel_users`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`to_user`) REFERENCES `kernel_users`(`user_id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `kernel_rel_pk` ON `kernel_relationships` (`from_user`,`to_user`,`rel_type`);--> statement-breakpoint
CREATE INDEX `idx_rel_to` ON `kernel_relationships` (`to_user`,`rel_type`);--> statement-breakpoint
CREATE INDEX `idx_rel_type` ON `kernel_relationships` (`rel_type`);--> statement-breakpoint
CREATE TABLE `kernel_objects` (
	`object_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`object_type` text NOT NULL,
	`payload_json` text NOT NULL,
	`visibility` text NOT NULL DEFAULT 'private',
	`parent_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `kernel_users`(`user_id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `idx_obj_owner` ON `kernel_objects` (`owner_id`,`object_type`);--> statement-breakpoint
CREATE INDEX `idx_obj_type` ON `kernel_objects` (`object_type`,`visibility`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_obj_parent` ON `kernel_objects` (`parent_id`);--> statement-breakpoint
CREATE TABLE `kernel_ledger` (
	`entry_id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`amount` integer NOT NULL,
	`balance_after` integer NOT NULL,
	`entry_type` text NOT NULL,
	`reference_id` text,
	`counterparty_id` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `kernel_users`(`user_id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE INDEX `idx_ledger_user` ON `kernel_ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `kernel_payment_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`provider` text NOT NULL,
	`external_account_id` text NOT NULL,
	`onboarding_complete` integer DEFAULT 0,
	`payout_enabled` integer DEFAULT 0,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `kernel_users`(`user_id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE TABLE `kernel_user_app_access` (
	`user_id` text NOT NULL,
	`app_id` text NOT NULL,
	`role` text NOT NULL DEFAULT 'user',
	`pinned` integer DEFAULT 0,
	`first_accessed_at` integer NOT NULL,
	`last_accessed_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `kernel_users`(`user_id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `kernel_user_app_access_pk` ON `kernel_user_app_access` (`user_id`,`app_id`);--> statement-breakpoint
CREATE TABLE `kernel_app_registry` (
	`app_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`visibility` text NOT NULL DEFAULT 'private',
	`thumbnail_r2_key` text,
	`subdomain` text,
	`listing_id` text,
	`forked_from` text,
	`deployed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `kernel_users`(`user_id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE UNIQUE INDEX `kernel_app_registry_subdomain_unique` ON `kernel_app_registry` (`subdomain`);--> statement-breakpoint
CREATE TABLE `kernel_listings` (
	`listing_id` text PRIMARY KEY NOT NULL,
	`seller_id` text NOT NULL,
	`item_type` text NOT NULL,
	`item_id` text NOT NULL,
	`price_cents` integer,
	`pricing_model` text NOT NULL DEFAULT 'one_time',
	`active` integer DEFAULT 1,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`seller_id`) REFERENCES `kernel_users`(`user_id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE TABLE `kernel_purchases` (
	`purchase_id` text PRIMARY KEY NOT NULL,
	`buyer_id` text NOT NULL,
	`listing_id` text NOT NULL,
	`external_payment_id` text,
	`amount_cents` integer NOT NULL,
	`platform_fee_cents` integer NOT NULL,
	`status` text NOT NULL DEFAULT 'active',
	`purchased_at` integer NOT NULL,
	FOREIGN KEY (`buyer_id`) REFERENCES `kernel_users`(`user_id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`listing_id`) REFERENCES `kernel_listings`(`listing_id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
CREATE TABLE `kernel_components` (
	`component_id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`r2_bundle_key` text NOT NULL,
	`interface_json` text,
	`source_app_id` text,
	`listing_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`owner_id`) REFERENCES `kernel_users`(`user_id`) ON UPDATE no action ON DELETE no action
);
