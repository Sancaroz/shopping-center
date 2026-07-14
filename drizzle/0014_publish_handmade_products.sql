UPDATE `products`
SET `active` = 1, `updated_at` = CURRENT_TIMESTAMP
WHERE `slug` IN (
  'el-yapimi-orgu-dekoratif-yastik-kilifi',
  'vintage-dantel-detayli-el-orgusu-kimono-hirka'
);
