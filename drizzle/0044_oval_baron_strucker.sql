UPDATE `return_requests`
SET `status` = 'rejected',
    `admin_note` = CASE WHEN `admin_note` = '' THEN 'Aynı sipariş ve talep türü için yinelenen açık kayıt, güvenli geçiş sırasında kapatıldı.' ELSE `admin_note` END,
    `updated_at` = CURRENT_TIMESTAMP
WHERE `status` IN ('new', 'reviewing', 'approved')
  AND `id` NOT IN (
    SELECT MIN(`id`)
    FROM `return_requests`
    WHERE `status` IN ('new', 'reviewing', 'approved')
    GROUP BY `order_id`, `request_type`
  );--> statement-breakpoint
CREATE UNIQUE INDEX `return_requests_one_open_type_per_order` ON `return_requests` (`order_id`,`request_type`) WHERE "return_requests"."status" IN ('new', 'reviewing', 'approved');
