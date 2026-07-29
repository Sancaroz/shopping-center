UPDATE `admin_users`
SET `role` = 'admin', `active` = 0, `updated_at` = CURRENT_TIMESTAMP
WHERE `role` = 'owner' AND `email` <> 'robologai@gmail.com';

INSERT INTO `admin_users` (`email`, `display_name`, `role`, `active`, `created_by`, `created_at`, `updated_at`)
VALUES ('robologai@gmail.com', 'robologai', 'owner', 1, 'verified-owner-assignment', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (`email`) DO UPDATE SET
  `display_name` = excluded.`display_name`,
  `role` = 'owner',
  `active` = 1,
  `updated_at` = CURRENT_TIMESTAMP;
