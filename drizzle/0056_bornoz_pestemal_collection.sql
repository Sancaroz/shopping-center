-- Custom SQL migration file, put your code below! --
INSERT OR IGNORE INTO `categories` (
  `name_tr`, `name_en`, `slug`, `parent_id`, `image_url`, `sort_order`, `active`, `updated_at`
)
VALUES (
  'Bornoz & Peştemal', 'Bathrobes & Peshtemals', 'bornoz-pestemal', NULL,
  '/products/bornoz-pestemal-pembe.jpg', 60, 1, CURRENT_TIMESTAMP
);--> statement-breakpoint

INSERT OR IGNORE INTO `products` (
  `name_tr`, `name_en`, `slug`, `description_tr`, `description_en`, `category_id`, `image_url`,
  `price_tr`, `price_global`, `currency_global`, `stock`, `market_tr`, `market_global`, `featured`, `active`,
  `sourcing_type`, `reorder_point`, `updated_at`
)
SELECT
  'Kadın Bornoz Peştemal', 'Women''s Peshtemal Bathrobe', 'kadin-bornoz-pestemal',
  '%100 pamuk dokusuyla hafif ve rahat kadın bornoz peştemal. S, M, L, XL ve XXL beden seçenekleriyle.',
  'A lightweight and comfortable women''s peshtemal bathrobe made from 100% cotton, available in S, M, L, XL and XXL.',
  `id`, '/products/bornoz-pestemal-pembe.jpg',
  0, 0, 'EUR', 0, 1, 1, 0, 0, 'factory', 5, CURRENT_TIMESTAMP
FROM `categories`
WHERE `slug` = 'bornoz-pestemal';--> statement-breakpoint

INSERT OR IGNORE INTO `products` (
  `name_tr`, `name_en`, `slug`, `description_tr`, `description_en`, `category_id`, `image_url`,
  `price_tr`, `price_global`, `currency_global`, `stock`, `market_tr`, `market_global`, `featured`, `active`,
  `sourcing_type`, `reorder_point`, `updated_at`
)
SELECT
  'Erkek Bornoz Peştemal', 'Men''s Peshtemal Bathrobe', 'erkek-bornoz-pestemal',
  '%100 pamuk dokusuyla hafif ve rahat erkek bornoz peştemal. S, M, L, XL ve XXL beden seçenekleriyle.',
  'A lightweight and comfortable men''s peshtemal bathrobe made from 100% cotton, available in S, M, L, XL and XXL.',
  `id`, '/products/bornoz-pestemal-pembe.jpg',
  0, 0, 'EUR', 0, 1, 1, 0, 0, 'factory', 5, CURRENT_TIMESTAMP
FROM `categories`
WHERE `slug` = 'bornoz-pestemal';--> statement-breakpoint

INSERT OR IGNORE INTO `product_variants` (
  `product_id`, `sku`, `option_name`, `option_value`, `option_name_en`, `option_value_en`,
  `stock`, `price_adjustment`, `active`, `updated_at`
)
SELECT `id`, 'BP-KADIN-' || `size`, 'Beden', `size`, 'Size', `size`, 0, 0, 1, CURRENT_TIMESTAMP
FROM `products`
CROSS JOIN (
  SELECT 'S' AS `size` UNION ALL SELECT 'M' UNION ALL SELECT 'L' UNION ALL SELECT 'XL' UNION ALL SELECT 'XXL'
)
WHERE `slug` = 'kadin-bornoz-pestemal';--> statement-breakpoint

INSERT OR IGNORE INTO `product_variants` (
  `product_id`, `sku`, `option_name`, `option_value`, `option_name_en`, `option_value_en`,
  `stock`, `price_adjustment`, `active`, `updated_at`
)
SELECT `id`, 'BP-ERKEK-' || `size`, 'Beden', `size`, 'Size', `size`, 0, 0, 1, CURRENT_TIMESTAMP
FROM `products`
CROSS JOIN (
  SELECT 'S' AS `size` UNION ALL SELECT 'M' UNION ALL SELECT 'L' UNION ALL SELECT 'XL' UNION ALL SELECT 'XXL'
)
WHERE `slug` = 'erkek-bornoz-pestemal';--> statement-breakpoint

INSERT INTO `homepage_blocks` (
  `eyebrow_tr`, `eyebrow_en`, `title_tr`, `title_en`, `copy_tr`, `copy_en`,
  `button_tr`, `button_en`, `button_url`, `image_url`, `image_position`, `sort_order`,
  `market_tr`, `market_global`, `active`, `updated_at`
)
SELECT
  'YENİ KOLEKSİYON', 'NEW COLLECTION', 'Bornoz Peştemal', 'Peshtemal Bathrobes',
  'Kadın ve erkek seçenekleriyle, S–XXL beden aralığında. Hafif, rahat ve %100 pamuk.',
  'For women and men, available in sizes S–XXL. Lightweight, comfortable and made from 100% cotton.',
  'Mağazayı keşfet', 'Explore the shop', '/magaza', '/products/bornoz-pestemal-pembe.jpg', 'left', 0,
  1, 1, 1, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM `homepage_blocks` WHERE `image_url` = '/products/bornoz-pestemal-pembe.jpg' AND `title_tr` = 'Bornoz Peştemal'
);
