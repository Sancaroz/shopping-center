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

test("records authenticated audit history for critical order and return changes", async () => {
  const [auditHelper, auditApi, orders, returns, auditPage] = await Promise.all([
    source("app/audit-log.ts"),
    source("app/api/audit-logs/route.ts"),
    source("app/api/orders/route.ts"),
    source("app/api/return-requests/route.ts"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
  ]);
  assert.match(auditHelper, /actorEmail:input\.user\.email/);
  assert.match(auditHelper, /safeJson/);
  assert.match(auditApi, /Yetkisiz erişim/);
  assert.match(orders, /action:"order.update"/);
  assert.match(returns, /action:"return_request.update"/);
  assert.match(auditPage, /salt okunurdur/);
});

test("provides an authenticated daily operations priority view", async () => {
  const [summaryApi, operationsPage] = await Promise.all([
    source("app/api/operations-summary/route.ts"),
    source("app/admin/operasyon/operations-center.tsx"),
  ]);
  assert.match(summaryApi, /Yetkisiz erişim/);
  assert.match(summaryApi, /hours\(order\.createdAt\)>=24/);
  assert.match(summaryApi, /hours\(order\.updatedAt\)>=48/);
  assert.match(summaryApi, /draftNotifications/);
  assert.match(summaryApi, /activeProductIds/);
  assert.match(operationsPage, /Bugün ilgilenilecekler/);
  assert.match(operationsPage, /Verileri yenile/);
});

test("rate limits public forms with hashed durable identifiers", async () => {
  const [rateLimit, orders, tracking, contact, newsletter, returns] = await Promise.all([
    source("app/rate-limit.ts"),
    source("app/api/orders/route.ts"),
    source("app/api/order-tracking/route.ts"),
    source("app/api/contact/route.ts"),
    source("app/api/newsletter/route.ts"),
    source("app/api/return-requests/route.ts"),
  ]);
  assert.match(rateLimit, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(rateLimit, /"Retry-After"/);
  assert.doesNotMatch(rateLimit, /insert\(requestThrottles\).*rawKey/);
  assert.match(orders, /scope:"order_create"/);
  assert.match(tracking, /scope:"order_tracking"/);
  assert.match(contact, /scope:"contact"/);
  assert.match(newsletter, /scope:"newsletter"/);
  assert.match(returns, /scope:"return_request"/);
});

test("creates complete integrity-checked backups and rehearses restore safely", async () => {
  const [format, exportApi, backupApi, safetyCenter] = await Promise.all([
    source("app/backup-format.ts"),
    source("app/api/export/route.ts"),
    source("app/api/backups/route.ts"),
    source("app/admin/veri-guvenligi/data-safety-center.tsx"),
  ]);
  assert.match(format, /BACKUP_FORMAT = "mysa-store-backup"/);
  assert.match(format, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(format, /checkReferences/);
  assert.match(exportApi, /notificationOutbox/);
  assert.match(exportApi, /returnRequests/);
  assert.match(exportApi, /auditLogs/);
  assert.match(backupApi, /MAX_BACKUP_BYTES/);
  assert.match(backupApi, /data\.retention_cleanup/);
  assert.doesNotMatch(backupApi, /insert\(products\)|delete\(orders\)/);
  assert.match(safetyCenter, /Canlı mağazadaki hiçbir kayıt/);
  assert.match(safetyCenter, /Yedek geri yüklenmeye hazır/);
});

test("keeps lint rules aligned with the Vinext and dynamic-media architecture", async () => {
  const [config, categoryEditor, orderDetail, productEditor] = await Promise.all([
    source("eslint.config.mjs"),
    source("app/admin/kategori/[id]/category-editor.tsx"),
    source("app/admin/siparis/[id]/order-detail.tsx"),
    source("app/admin/urun/[id]/product-editor.tsx"),
  ]);
  assert.match(config, /Vinext admin navigation/);
  assert.match(config, /user-managed R2\/external URLs/);
  assert.match(config, /D1-backed client screens/);
  assert.match(categoryEditor, /useCallback/);
  assert.match(orderDetail, /useEffect\(\(\)=>\{void load\(\);\},\[load\]\)/);
  assert.match(productEditor, /useCallback/);
});

test("keeps cart cookies secure in production and usable in local rehearsals", async () => {
  const cart = await source("app/api/cart/route.ts");
  assert.match(cart, /new URL\(request\.url\)\.protocol==="https:"/);
  assert.match(cart, /\?"; Secure":""/);
  assert.match(cart, /SameSite=Lax/);
  assert.match(cart, /HttpOnly/);
});

test("never presents sample catalog cards as purchasable inventory", async () => {
  const home = await source("app/page.tsx");
  assert.match(home, /!product\.id \|\| catalogSource !== "live"/);
  assert.match(home, /catalogSource==="live"&&product\.id/);
  assert.match(home, /Ürün kataloğu hazırlanıyor/);
});

test("provides launch-day health checks and audited emergency controls", async () => {
  const [readinessApi,operationsApi,readinessPage,orders,checkout] = await Promise.all([
    source("app/api/launch-readiness/route.ts"),
    source("app/api/launch-operations/route.ts"),
    source("app/admin/yayina-hazirlik/launch-readiness.tsx"),
    source("app/api/orders/route.ts"),
    source("app/teslimat/page.tsx"),
  ]);
  assert.match(readinessApi, /staleOrders/);
  assert.match(readinessApi, /backup\.create/);
  assert.match(operationsApi, /launch\.intake\.pause/);
  assert.match(operationsApi, /launch\.safe_mode/);
  assert.match(readinessPage, /4 adımlık müdahale planı/);
  assert.match(readinessPage, /Sipariş alımını durdur/);
  assert.match(orders, /orderIntakeStatus==="paused"/);
  assert.match(orders, /"Retry-After":"900"/);
  assert.match(checkout, /Sipariş alımı durduruldu/);
});
