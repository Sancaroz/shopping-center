INSERT INTO `admin_users` (`email`, `display_name`, `role`, `active`, `created_by`, `created_at`, `updated_at`)
SELECT 'robologai@gmail.com', 'robologai', 'owner', 1, 'owner-access-recovery', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM `admin_users`
  WHERE `role` = 'owner' AND `email` <> 'robologai@gmail.com'
)
ON CONFLICT (`email`) DO UPDATE SET
  `display_name` = excluded.`display_name`,
  `role` = 'owner',
  `active` = 1,
  `updated_at` = CURRENT_TIMESTAMP;
