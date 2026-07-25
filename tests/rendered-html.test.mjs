import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("ships storefront metadata and crawler controls", async () => {
  const [layout, robots, sitemap] = await Promise.all([
    source("app/layout.tsx"),
    source("app/robots.ts"),
    source("app/sitemap.ts"),
  ]);
  assert.match(layout, /MYSA OBJETS/);
  assert.match(layout, /openGraph/);
  assert.match(robots, /disallow: \["\/admin\/", "\/api\/"\]/);
  assert.match(sitemap, /\/urun\//);
});

test("protects checkout from duplicate and zero-price orders", async () => {
  const [orders, cart, checkout, migration] = await Promise.all([
    source("app/api/orders/route.ts"),
    source("app/api/cart/route.ts"),
    source("app/teslimat/page.tsx"),
    source("drizzle/0015_brown_miracleman.sql"),
  ]);
  assert.match(orders, /requestKey/);
  assert.match(orders, /privacyConsentAt/);
  assert.match(orders, /unitPrice<=0/);
  assert.match(cart, /basePrice<=0/);
  assert.match(checkout, /crypto\.randomUUID/);
  assert.match(checkout, /name="privacyConsent"/);
  assert.match(migration, /UNIQUE INDEX `orders_request_key_unique`/);
});

test("includes production failure states and security headers", async () => {
  const [config] = await Promise.all([source("next.config.ts")]);
  await Promise.all([access(new URL("../app/error.tsx", import.meta.url)), access(new URL("../app/not-found.tsx", import.meta.url))]);
  assert.match(config, /Content-Security-Policy/);
  assert.match(config, /X-Content-Type-Options/);
  assert.match(config, /frame-ancestors 'none'/);
});

test("supports payment and shipment operations without exposing internal notes", async () => {
  const [orders, trackingApi, orderDetail, trackingPage, migration] = await Promise.all([
    source("app/api/orders/route.ts"),
    source("app/api/order-tracking/route.ts"),
    source("app/admin/siparis/[id]/order-detail.tsx"),
    source("app/siparis-takip/page.tsx"),
    source("drizzle/0016_soft_mephistopheles.sql"),
  ]);
  assert.match(orders, /paymentStatus/);
  assert.match(orders, /internalNote/);
  assert.match(orderDetail, /Operasyon bilgilerini kaydet/);
  assert.match(trackingApi, /trackingNumber/);
  assert.doesNotMatch(trackingApi, /internalNote/);
  assert.match(trackingPage, /key:"shipped"/);
  assert.match(migration, /ADD `payment_status`/);
  assert.match(migration, /ADD `tracking_number`/);
});

test("keeps incomplete catalog items in draft and guards publication", async () => {
  const [productsApi, adminPanel] = await Promise.all([
    source("app/api/products/route.ts"),
    source("app/admin/panel.tsx"),
  ]);
  assert.match(productsApi, /function publicationIssues/);
  assert.match(productsApi, /active: false/);
  assert.match(productsApi, /satılabilir stok/);
  assert.match(productsApi, /Ürün yayınlanmadan önce tamamlanmalı/);
  assert.match(adminPanel, /Satışa hazır değil/);
  assert.match(adminPanel, /Satışa hazır ✓/);
});

test("prepares legal business details and records policy acknowledgement", async () => {
  const [settings, policies, checkout, orders] = await Promise.all([
    source("app/api/settings/route.ts"),
    source("app/politikalar/page.tsx"),
    source("app/teslimat/page.tsx"),
    source("app/api/orders/route.ts"),
  ]);
  assert.match(settings, /legalStatus:"draft"/);
  assert.match(settings, /Yayına hazır durumu için eksik alanlar/);
  assert.match(policies, /settings\.legalStatus==="complete"/);
  assert.match(policies, /Şirket ve ödeme altyapısı henüz tamamlanmadığı/);
  assert.match(checkout, /name="termsConsent"/);
  assert.match(orders, /termsConsentAt/);
  assert.match(orders, /termsVersion:"order-request-v1"/);
});

test("keeps sales in request mode until the full launch gate passes", async () => {
  const [settings, readinessApi, readinessPage] = await Promise.all([
    source("app/api/settings/route.ts"),
    source("app/api/launch-readiness/route.ts"),
    source("app/admin/yayina-hazirlik/launch-readiness.tsx"),
  ]);
  assert.match(settings, /salesMode:"order_request"/);
  assert.match(settings, /ödeme sağlayıcısı teknik entegrasyonu/);
  assert.match(settings, /Canlı satış modu için tamamlanmalı/);
  assert.match(readinessApi, /readyForLive/);
  assert.match(readinessApi, /ready:false/);
  assert.match(readinessPage, /Yayına hazırlık merkezi/);
  assert.match(readinessPage, /Güvenli sipariş-talebi modu/);
});

test("queues order notifications without sending before a provider is connected", async () => {
  const [orders, templates, notificationsApi, notificationCenter] = await Promise.all([
    source("app/api/orders/route.ts"),
    source("app/order-notifications.ts"),
    source("app/api/notifications/route.ts"),
    source("app/admin/bildirimler/notification-center.tsx"),
  ]);
  assert.match(orders, /queueNotification\(order,"received"\)/);
  assert.match(orders, /confirmed:"confirmed",shipped:"shipped",cancelled:"cancelled"/);
  assert.match(orders, /onConflictDoNothing/);
  assert.match(templates, /Takip numarası/);
  assert.match(notificationsApi, /providerConnected:false/);
  assert.doesNotMatch(notificationsApi, /sendEmail|fetch\("https:/);
  assert.match(notificationCenter, /Gönderim kapalı/);
});

test("supports verified return and cancellation requests without automatic refunds", async () => {
  const [returnApi, customerPage, adminPage] = await Promise.all([
    source("app/api/return-requests/route.ts"),
    source("app/iade-talebi/page.tsx"),
    source("app/admin/iade-talepleri/return-request-center.tsx"),
  ]);
  assert.match(returnApi, /eq\(orders\.email,email\)/);
  assert.match(returnApi, /aynı türde açık bir talep zaten bulunuyor/);
  assert.match(returnApi, /cancellation","return","exchange/);
  assert.doesNotMatch(returnApi, /paymentStatus|refunded|update\(orders\)/);
  assert.match(customerPage, /otomatik para iadesi başlatmaz/);
  assert.match(adminPage, /İade ve iptal talepleri/);
});
