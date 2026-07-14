INSERT OR IGNORE INTO `categories` (`name_tr`, `name_en`, `slug`, `parent_id`, `image_url`, `sort_order`, `active`)
VALUES ('Ev & Yaşam', 'Home & Living', 'ev-yasam', NULL, '', 40, 1);--> statement-breakpoint

INSERT OR IGNORE INTO `categories` (`name_tr`, `name_en`, `slug`, `parent_id`, `image_url`, `sort_order`, `active`)
SELECT 'Dekoratif Tekstiller', 'Decorative Textiles', 'dekoratif-tekstiller', `id`, '', 10, 1
FROM `categories`
WHERE `slug` = 'ev-yasam';--> statement-breakpoint

INSERT OR IGNORE INTO `categories` (`name_tr`, `name_en`, `slug`, `parent_id`, `image_url`, `sort_order`, `active`)
VALUES ('Giyim', 'Clothing', 'giyim', NULL, '', 50, 1);--> statement-breakpoint

INSERT OR IGNORE INTO `categories` (`name_tr`, `name_en`, `slug`, `parent_id`, `image_url`, `sort_order`, `active`)
SELECT 'Triko & Örgü', 'Knitwear & Crochet', 'triko-orgu', `id`, '', 10, 1
FROM `categories`
WHERE `slug` = 'giyim';--> statement-breakpoint

INSERT OR IGNORE INTO `products` (
  `name_tr`, `name_en`, `slug`, `description_tr`, `description_en`, `category_id`, `image_url`,
  `price_tr`, `price_global`, `currency_global`, `stock`, `market_tr`, `market_global`, `featured`, `active`
)
SELECT
  'El Yapımı Örgü Dekoratif Yastık Kılıfı',
  'Handmade Knitted Decorative Cushion Cover',
  'el-yapimi-orgu-dekoratif-yastik-kilifi',
  'Lacivert ve ekru tonlarında, dokulu geometrik desenle elde hazırlanmış dekoratif yastık kılıfı. El işçiliğinin sıcaklığını yaşam alanlarına taşıyan özgün bir parça.',
  'A handcrafted decorative cushion cover in navy and ecru, finished with a richly textured geometric pattern. A distinctive piece that brings artisanal warmth to living spaces.',
  `id`,
  '/products/handmade-knitted-cushion-cover.jpeg',
  0, 0, 'EUR', 0, 1, 1, 0, 0
FROM `categories`
WHERE `slug` = 'dekoratif-tekstiller';--> statement-breakpoint

INSERT OR IGNORE INTO `products` (
  `name_tr`, `name_en`, `slug`, `description_tr`, `description_en`, `category_id`, `image_url`,
  `price_tr`, `price_global`, `currency_global`, `stock`, `market_tr`, `market_global`, `featured`, `active`
)
SELECT
  'Vintage Dantel Detaylı El Örgüsü Kimono Hırka',
  'Vintage Lace-Detail Hand-Crocheted Kimono Cardigan',
  'vintage-dantel-detayli-el-orgusu-kimono-hirka',
  'Kahve ve krem tonlarında, çiçek motifli dantel detaylarla elde örülmüş kimono formunda vintage hırka. Her parçası kendine özgü el işçiliği karakteri taşır.',
  'A vintage-inspired kimono cardigan hand-crocheted in warm brown and cream tones with floral lace motifs. Each piece carries the distinctive character of artisanal craftsmanship.',
  `id`,
  '/products/vintage-crochet-kimono-cardigan.jpeg',
  0, 0, 'EUR', 0, 1, 1, 0, 0
FROM `categories`
WHERE `slug` = 'triko-orgu';
