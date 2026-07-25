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
  const [productsApi, adminPanel, quality] = await Promise.all([
    source("app/api/products/route.ts"),
    source("app/admin/panel.tsx"),
    source("app/catalog-quality.ts"),
  ]);
  assert.match(productsApi, /function publicationIssues/);
  assert.match(productsApi, /active: false/);
  assert.match(quality, /Satılabilir stok yok/);
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

test("prepares provider integrations without exposing secrets or mutating orders", async () => {
  const [runtime,signature,webhook,statusApi,center,notifications] = await Promise.all([
    source("app/integrations/runtime.ts"),
    source("app/integrations/webhook-signature.ts"),
    source("app/api/webhooks/payment/route.ts"),
    source("app/api/integrations/status/route.ts"),
    source("app/admin/entegrasyonlar/integration-center.tsx"),
    source("app/api/notifications/route.ts"),
  ]);
  assert.match(runtime, /PAYMENT_WEBHOOK_SECRET/);
  assert.match(runtime, /keys:paymentKeys/);
  assert.doesNotMatch(statusApi, /PAYMENT_SECRET_KEY|PAYMENT_WEBHOOK_SECRET|EMAIL_API_KEY/);
  assert.match(signature, /HMAC/);
  assert.match(signature, /MAX_AGE_SECONDS=300/);
  assert.match(signature, /constantTimeEqual/);
  assert.match(webhook, /processed:false/);
  assert.doesNotMatch(webhook, /update\(orders\)|paymentStatus/);
  assert.match(statusApi, /Yetkisiz erişim/);
  assert.match(center, /Gizli anahtarlar yönetim ekranında gösterilmez/);
  assert.match(center, /Test modu doğrulanmadan canlı moda geçilmez/);
  assert.match(notifications, /providerConfigured/);
});

test("keeps the storefront keyboard accessible and mobile resilient", async () => {
  const [layout, home, styles] = await Promise.all([
    source("app/layout.tsx"),
    source("app/page.tsx"),
    source("app/globals.css"),
  ]);
  assert.match(layout, /className="skip-link"/);
  assert.match(layout, /id="main-content"/);
  assert.match(home, /aria-expanded=\{menuOpen\}/);
  assert.match(home, /aria-controls="store-navigation"/);
  assert.match(home, /htmlFor="newsletter-email"/);
  assert.match(home, /autoComplete="email"/);
  assert.match(home, /loading="lazy" decoding="async"/);
  assert.match(styles, /:focus-visible/);
  assert.match(styles, /prefers-reduced-motion: reduce/);
  assert.match(styles, /min-width:44px/);
});

test("publishes truthful search metadata without enabling unconsented tracking", async () => {
  const [productPage,productDetail,policies,sitemap,shopMetadata,cartMetadata] = await Promise.all([
    source("app/urun/[slug]/page.tsx"),
    source("app/urun/[slug]/product-detail.tsx"),
    source("app/politikalar/page.tsx"),
    source("app/sitemap.ts"),
    source("app/magaza/layout.tsx"),
    source("app/sepet/layout.tsx"),
  ]);
  assert.match(productPage, /generateMetadata/);
  assert.match(productPage, /application\/ld\+json/);
  assert.match(productPage, /schema\.org/);
  assert.match(productDetail, /Ödeme alınmadan sipariş talebi/);
  assert.doesNotMatch(productDetail, /brand\.salesMode!=="live".*Güvenli ödeme/);
  assert.match(policies, /Reklam, profil oluşturma veya üçüncü taraf ziyaretçi analizi çalıştırılmaz/);
  assert.doesNotMatch(sitemap, /lastModified:new Date\(\)/);
  assert.match(shopMetadata, /canonical:"\/magaza"/);
  assert.match(cartMetadata, /index:false/);
});

test("provides an authenticated catalog quality center with actionable blockers", async () => {
  const [helper,api,page,center,launch] = await Promise.all([
    source("app/catalog-quality.ts"),
    source("app/api/catalog-quality/route.ts"),
    source("app/admin/katalog-kalitesi/page.tsx"),
    source("app/admin/katalog-kalitesi/catalog-quality-center.tsx"),
    source("app/admin/yayina-hazirlik/launch-readiness.tsx"),
  ]);
  assert.match(helper, /Satılabilir stok yok/);
  assert.match(helper, /Kategori yayında değil/);
  assert.match(helper, /İkinci ürün görseli önerilir/);
  assert.match(api, /Yetkisiz erişim/);
  assert.match(api, /summary:/);
  assert.match(page, /requireChatGPTUser/);
  assert.match(center, /Katalog kalite merkezi/);
  assert.match(center, /Yayın engelleri/);
  assert.match(center, /Ürünü düzenle/);
  assert.match(launch, /\/admin\/katalog-kalitesi/);
});

test("enforces server-authoritative shipping regions and keeps global delivery closed by default", async () => {
  const [rules,orders,settings,checkout,shippingPage,readiness] = await Promise.all([
    source("app/shipping-rules.ts"),
    source("app/api/orders/route.ts"),
    source("app/api/settings/route.ts"),
    source("app/teslimat/page.tsx"),
    source("app/admin/teslimat-ayarlari/page.tsx"),
    source("app/api/launch-readiness/route.ts"),
  ]);
  assert.match(rules, /Türkiye mağazası yalnızca Türkiye teslimat adreslerini kabul eder/);
  assert.match(rules, /Global teslimat henüz siparişe açık değil/);
  assert.match(rules, /Seçilen ülkeye teslimat şu anda desteklenmiyor/);
  assert.match(orders, /shippingQuote/);
  assert.match(orders, /country:quote\.country/);
  assert.match(settings, /shippingGlobalEnabled:"false"/);
  assert.match(settings, /en az bir desteklenen ülke/);
  assert.match(settings, /taxDisplayMode:"pending"/);
  assert.match(settings, /vergiler dâhil tüketici fiyatı onayı/);
  assert.match(checkout, /Select a delivery country/);
  assert.match(checkout, /disabled=\{busy\|\|!intakeOpen\|\|!quote\.ok\}/);
  assert.match(shippingPage, /requireChatGPTUser/);
  assert.match(readiness, /globalShippingReady/);
  assert.match(readiness, /Fiyat ve vergi sunumu/);
});

test("atomically reserves stock and safely releases abandoned order requests", async () => {
  const [schema,reservations,orders,migration,detail] = await Promise.all([
    source("db/schema.ts"),
    source("app/inventory-reservations.ts"),
    source("app/api/orders/route.ts"),
    source("drizzle/0022_curvy_johnny_storm.sql"),
    source("app/admin/siparis/[id]/order-detail.tsx"),
  ]);
  assert.match(schema, /reservationExpiresAt/);
  assert.match(reservations, /gte\(productVariants\.stock,line\.quantity\)/);
  assert.match(reservations, /releaseExpiredReservations/);
  assert.match(reservations, /24 saatlik stok rezervasyonu otomatik olarak sona erdi/);
  assert.match(orders, /reserveInventory/);
  assert.match(orders, /reservationState:"active"/);
  assert.match(orders, /Date\.now\(\)\+24\*60\*60\*1000/);
  assert.match(orders, /await reservation\.rollback\(\)/);
  assert.match(migration, /reservation_expires_at/);
  assert.match(detail, /Stok/);
});

test("uses one-time hashed email verification before order approval", async () => {
  const [schema,helper,orders,notifications,verification,layout,readiness,detail,migration] = await Promise.all([
    source("db/schema.ts"),
    source("app/order-verification.ts"),
    source("app/api/orders/route.ts"),
    source("app/order-notifications.ts"),
    source("app/siparis-dogrula/page.tsx"),
    source("app/siparis-dogrula/layout.tsx"),
    source("app/api/launch-readiness/route.ts"),
    source("app/admin/siparis/[id]/order-detail.tsx"),
    source("drizzle/0023_nostalgic_gideon.sql"),
  ]);
  assert.match(schema, /verificationTokenHash/);
  assert.match(schema, /emailVerifiedAt/);
  assert.match(helper, /SHA-256/);
  assert.match(orders, /verificationTokenHash=await hashVerificationToken\(verificationToken\)/);
  assert.doesNotMatch(orders, /verificationToken,/);
  assert.match(orders, /queueNotification\(order,"verification"/);
  assert.match(orders, /Müşteri e-posta adresini doğrulamadan sipariş onaylanamaz/);
  assert.match(orders, /updates\.verificationTokenHash=""/);
  assert.match(notifications, /24 saat içinde doğrulayın/);
  assert.match(verification, /releaseOrderReservation/);
  assert.match(verification, /verificationExpiresAt:null/);
  assert.match(layout, /index:false/);
  assert.match(readiness, /E-posta doğrulama/);
  assert.match(readiness, /adapterConnected/);
  assert.match(detail, /Doğrulama bekliyor/);
  assert.match(detail, /data\.error/);
  assert.match(migration, /verification_token_hash/);
});

test("tracks durable shipment events and warns about delayed delivery", async () => {
  const [schema,migration,shipmentApi,orders,trackingApi,trackingPage,adminManager,operations,notifications,backup,exportApi] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0024_fresh_ultron.sql"),
    source("app/api/shipment-events/route.ts"),
    source("app/api/orders/route.ts"),
    source("app/api/order-tracking/route.ts"),
    source("app/siparis-takip/page.tsx"),
    source("app/admin/siparis/[id]/shipment-manager.tsx"),
    source("app/api/operations-summary/route.ts"),
    source("app/admin/bildirimler/notification-center.tsx"),
    source("app/backup-format.ts"),
    source("app/api/export/route.ts"),
  ]);
  assert.match(schema, /shipmentEvents/);
  assert.match(schema, /lastShipmentEventAt/);
  assert.match(migration, /CREATE TABLE `shipment_events`/);
  assert.match(shipmentApi, /Yetkisiz erişim/);
  assert.match(shipmentApi, /E-postası doğrulanmamış siparişe kargo hareketi eklenemez/);
  assert.match(shipmentApi, /Önce kargo firması ve takip numarasını kaydedin/);
  assert.match(shipmentApi, /gelecekte bir tarihe kaydedilemez/);
  assert.match(shipmentApi, /Teslim edilmiş gönderiye yalnızca geri dönüş hareketi/);
  assert.match(shipmentApi, /visibleToCustomer/);
  assert.match(shipmentApi, /shipment_update/);
  assert.match(orders, /Kargoya verildi durumundan önce kargo firması ve takip numarası/);
  assert.match(orders, /estimatedDeliveryAt/);
  assert.match(trackingApi, /eq\(shipmentEvents\.visibleToCustomer,true\)/);
  assert.match(trackingPage, /TESLİMAT HAREKETLERİ/);
  assert.match(trackingPage, /TAHMİNİ TESLİM/);
  assert.match(adminManager, /Müşteri takip ekranında göster/);
  assert.match(operations, />=72/);
  assert.match(operations, /teslimat sorunu/);
  assert.match(notifications, /shipment_update/);
  assert.match(backup, /"shipmentEvents"/);
  assert.match(backup, /Kargo hareketi-sipariş/);
  assert.match(exportApi, /shipmentEventRows/);
});
