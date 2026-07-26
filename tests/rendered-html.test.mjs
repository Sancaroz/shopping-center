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
  assert.match(orders, /termsVersion:contractSnapshot\.version/);
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

test("captures immutable billing data without issuing a premature invoice", async () => {
  const [schema,migration,orders,checkout,invoice,tracking,backup] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0025_wooden_newton_destine.sql"),
    source("app/api/orders/route.ts"),
    source("app/teslimat/page.tsx"),
    source("app/admin/siparis/[id]/invoice-readiness.tsx"),
    source("app/api/order-tracking/route.ts"),
    source("app/backup-format.ts"),
  ]);
  assert.match(schema, /billingTaxNumber/);
  assert.match(schema, /sellerSnapshotJson/);
  assert.match(schema, /pricingTaxStatus/);
  assert.match(migration, /billing_tax_number/);
  assert.match(migration, /seller_snapshot_json/);
  assert.match(orders, /Kurumsal fatura için geçerli vergi numarası/);
  assert.match(orders, /sellerSnapshotJson=JSON\.stringify/);
  assert.match(orders, /pricingTaxStatus:settings\.taxDisplayMode/);
  assert.match(checkout, /Fatura bilgileri/);
  assert.match(checkout, /Bu aşamada fatura kesilmez ve ödeme alınmaz/);
  assert.match(invoice, /Bu ekran mali belge üretmez/);
  assert.match(invoice, /Sipariş anındaki satıcı şirket bilgileri/);
  assert.doesNotMatch(tracking, /billingTaxNumber|sellerSnapshotJson/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
});

test("manages mixed sourcing and records auditable inventory movements", async () => {
  const [schema,migration,inventoryApi,center,orders,reservations,readiness,backup,exportApi,adminPage,productsApi,variantsApi] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0026_ordinary_silk_fever.sql"),
    source("app/api/inventory/route.ts"),
    source("app/admin/stok/inventory-center.tsx"),
    source("app/api/orders/route.ts"),
    source("app/inventory-reservations.ts"),
    source("app/api/launch-readiness/route.ts"),
    source("app/backup-format.ts"),
    source("app/api/export/route.ts"),
    source("app/admin/page.tsx"),
    source("app/api/products/route.ts"),
    source("app/api/variants/route.ts"),
  ]);
  assert.match(schema, /sourcingType/);
  assert.match(schema, /inventoryMovements/);
  assert.match(migration, /CREATE TABLE `inventory_movements`/);
  assert.match(migration, /sourcing_type/);
  assert.match(inventoryApi, /Yetkisiz erişim/);
  assert.match(inventoryApi, /gte\(productVariants\.stock,-delta\)/);
  assert.match(inventoryApi, /Stok hareketi için kısa bir açıklama zorunludur/);
  assert.match(inventoryApi, /inventory\.adjust/);
  assert.match(center, /Fabrika \/ tedarik ürünü/);
  assert.match(center, /El işçiliği \/ atölye üretimi/);
  assert.match(center, /Stok sıfırın altına indirilemez/);
  assert.match(orders, /movementType:"reservation"/);
  assert.match(reservations, /movementType:"reservation_release"/);
  assert.match(readiness, /Stok ve tedarik/);
  assert.match(backup, /"inventoryMovements"/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(exportApi, /inventoryMovementRows/);
  assert.match(adminPage, /\/admin\/stok/);
  assert.match(productsApi, /Ürün düzenleyicisinden stok düzeltmesi/);
  assert.match(variantsApi, /Varyant düzenleyicisinden stok düzeltmesi/);
  assert.match(variantsApi, /Varyant açılış stoğu/);
});

test("snapshots order costs and reports finance estimates without false accounting claims", async () => {
  const [schema,migration,orders,financeApi,center,readiness,adminPage,backup] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0027_colorful_earthquake.sql"),
    source("app/api/orders/route.ts"),
    source("app/api/finance-summary/route.ts"),
    source("app/admin/finans/finance-center.tsx"),
    source("app/api/launch-readiness/route.ts"),
    source("app/admin/page.tsx"),
    source("app/backup-format.ts"),
  ]);
  assert.match(schema, /unitCostSnapshot/);
  assert.match(migration, /unit_cost_snapshot/);
  assert.match(orders, /unitCostSnapshot:cart\.market==="TR"\?line\.unitCost:0/);
  assert.match(financeApi, /Yetkisiz erişim/);
  assert.match(financeApi, /paymentStatus==="paid"/);
  assert.match(financeApi, /unitCostSnapshot\*item\.quantity/);
  assert.match(financeApi, /market==="TR"/);
  assert.match(center, /Operasyonel tahmin/);
  assert.match(center, /muhasebe kaydı, gelir tablosu veya vergi beyanı değildir/);
  assert.match(center, /Global ürün maliyetleri avro bazında tanımlanmadığı/);
  assert.match(readiness, /Kârlılık kontrolü/);
  assert.match(adminPage, /\/admin\/finans/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
});

test("applies server-authoritative promotions with safe limits and inactive defaults", async () => {
  const [schema,migration,helper,validateApi,adminApi,orders,checkout,center,finance,backup,exportApi,trackingApi,trackingPage,reservations] = await Promise.all([
    source("db/schema.ts"),
    source("drizzle/0028_romantic_rictor.sql"),
    source("app/promotions.ts"),
    source("app/api/promotions/validate/route.ts"),
    source("app/api/promotions/route.ts"),
    source("app/api/orders/route.ts"),
    source("app/teslimat/page.tsx"),
    source("app/admin/kampanyalar/promotion-center.tsx"),
    source("app/api/finance-summary/route.ts"),
    source("app/backup-format.ts"),
    source("app/api/export/route.ts"),
    source("app/api/order-tracking/route.ts"),
    source("app/siparis-takip/page.tsx"),
    source("app/inventory-reservations.ts"),
  ]);
  assert.match(schema, /promotionRedemptions/);
  assert.match(schema, /discountAmount/);
  assert.match(migration, /CREATE TABLE `promotions`/);
  assert.match(migration, /CREATE TABLE `promotion_redemptions`/);
  assert.match(helper, /usageLimit>0&&promotion\.usedCount>=promotion\.usageLimit/);
  assert.match(helper, /Math\.min\(Math\.max\(capped,0\),input\.subtotal\)/);
  assert.match(validateApi, /scope:"promotion_validate"/);
  assert.match(validateApi, /innerJoin\(products/);
  assert.match(adminApi, /active:false/);
  assert.match(adminApi, /Süresi dolmuş kampanya etkinleştirilemez/);
  assert.match(orders, /lt\(promotions\.usedCount,promo\.usageLimit\)/);
  assert.match(orders, /await reservation\.rollback\(\)/);
  assert.match(orders, /promotionRedemptions/);
  assert.match(orders, /existing\.paymentStatus!=="paid"/);
  assert.match(orders, /releasePromotionClaim/);
  assert.match(checkout, /İNDİRİM KODU/);
  assert.match(center, /Yeni kampanyalar daima pasif oluşturulur/);
  assert.match(finance, /order\.subtotal-order\.discountAmount/);
  assert.match(backup, /"promotionRedemptions"/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(exportApi, /promotionRedemptionRows/);
  assert.match(trackingApi, /discountAmount: order\.discountAmount/);
  assert.match(trackingPage, /İNDİRİM/);
  assert.match(reservations, /paymentStatus:orders\.paymentStatus/);
  assert.match(reservations, /releasePromotionClaim/);
});

test("provides a privacy-conscious authenticated customer operations center", async () => {
  const [api,page,center,adminPage] = await Promise.all([
    source("app/api/customers/route.ts"),
    source("app/admin/musteriler/page.tsx"),
    source("app/admin/musteriler/customer-center.tsx"),
    source("app/admin/page.tsx"),
  ]);
  assert.match(api, /getChatGPTUser/);
  assert.match(api, /Yetkisiz erişim/);
  assert.match(api, /toLocaleLowerCase\("en-US"\)/);
  assert.match(api, /maskPhone/);
  assert.doesNotMatch(api, /billingTaxNumber|billingAddress|internalNote/);
  assert.match(page, /requireChatGPTUser\("\/admin\/musteriler"\)/);
  assert.match(center, /Bu ekran bir pazarlama listesi değildir/);
  assert.match(center, /Tekrar gelen/);
  assert.match(center, /Doğrulama bekleyen/);
  assert.match(adminPage, /\/admin\/musteriler/);
});

test("requires an audited fulfillment checklist before shipment", async () => {
  const [schema,api,orders,component,backup,exportApi,operations] = await Promise.all([
    source("db/schema.ts"),
    source("app/api/fulfillment-checklist/route.ts"),
    source("app/api/orders/route.ts"),
    source("app/admin/siparis/[id]/packing-checklist.tsx"),
    source("app/backup-format.ts"),
    source("app/api/export/route.ts"),
    source("app/api/operations-summary/route.ts"),
  ]);
  assert.match(schema, /fulfillmentChecklists/);
  assert.match(api, /getChatGPTUser/);
  assert.match(api, /fulfillment\.checklist\.update/);
  assert.match(api, /\["confirmed","preparing"\]/);
  assert.match(orders, /Kargoya vermeden önce paketleme kontrol listesinin tamamı/);
  assert.match(component, /Kalite kontrolü/);
  assert.match(component, /Adres ve etiket/);
  assert.match(backup, /"fulfillmentChecklists"/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(exportApi, /fulfillmentChecklistRows/);
  assert.match(operations, /packingIncomplete/);
});

test("tracks replenishments without sending suppliers and receives stock once", async () => {
  const [schema,api,center,inventory,operations,backup,exportApi] = await Promise.all([
    source("db/schema.ts"),
    source("app/api/replenishments/route.ts"),
    source("app/admin/tedarik/replenishment-center.tsx"),
    source("app/admin/stok/inventory-center.tsx"),
    source("app/api/operations-summary/route.ts"),
    source("app/backup-format.ts"),
    source("app/api/export/route.ts"),
  ]);
  assert.match(schema, /replenishments/);
  assert.match(api, /eq\(replenishments\.status,"ordered"\)/);
  assert.match(api, /Bu tedarik kaydı daha önce işlendi/);
  assert.match(api, /inventoryMovements/);
  assert.match(api, /replenishment\.receive/);
  assert.doesNotMatch(api, /fetch\(|sendEmail|mailto:/);
  assert.match(center, /otomatik mesaj veya sipariş göndermez/);
  assert.match(center, /Teslim al ve stoğa ekle/);
  assert.match(inventory, /\/admin\/tedarik/);
  assert.match(operations, /overdueReplenishments/);
  assert.match(backup, /"replenishments"/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(exportApi, /replenishmentRows/);
});

test("runs authenticated auditable support tickets with safe order matching", async () => {
  const [schema,api,center,page,operations,panel,backup,auditCenter] = await Promise.all([
    source("db/schema.ts"),
    source("app/api/contact/route.ts"),
    source("app/admin/destek/support-center.tsx"),
    source("app/admin/destek/page.tsx"),
    source("app/api/operations-summary/route.ts"),
    source("app/admin/panel.tsx"),
    source("app/backup-format.ts"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
  ]);
  assert.match(schema, /assignedTo/);
  assert.match(schema, /resolvedAt/);
  assert.match(api, /eq\(orders\.email,email\)/);
  assert.match(api, /support\.update/);
  assert.match(api, /before\.resolvedAt\?\?now/);
  assert.match(api, /body\.assignedTo===undefined\?before\.assignedTo/);
  assert.match(center, /Yanıtlar otomatik gönderilmez/);
  assert.match(center, /İç destek notu/);
  assert.match(page, /requireChatGPTUser\("\/admin\/destek"\)/);
  assert.match(operations, /message-urgent/);
  assert.match(panel, /\/admin\/destek/);
  assert.match(backup, /Destek-sipariş/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(auditCenter, /Destek kaydı güncellemesi/);
  assert.match(auditCenter, /contact_message","Destek/);
});

test("reconciles immutable payment and refund records without collecting card data", async () => {
  const [schema,api,center,page,operations,panel,orderDetail,auditCenter,backup,exportApi,ordersApi] = await Promise.all([
    source("db/schema.ts"),
    source("app/api/payment-transactions/route.ts"),
    source("app/admin/odemeler/payment-center.tsx"),
    source("app/admin/odemeler/page.tsx"),
    source("app/api/operations-summary/route.ts"),
    source("app/admin/panel.tsx"),
    source("app/admin/siparis/[id]/order-detail.tsx"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
    source("app/backup-format.ts"),
    source("app/api/export/route.ts"),
    source("app/api/orders/route.ts"),
  ]);
  assert.match(schema, /paymentTransactions/);
  assert.match(schema, /transactionKey/);
  assert.match(api, /Yetkisiz erişim/);
  assert.match(api, /onConflictDoNothing/);
  assert.match(api, /reconciliationStatus/);
  assert.match(api, /partially_refunded/);
  assert.match(api, /order_closed/);
  assert.match(api, /payment_transaction\.create/);
  assert.doesNotMatch(ordersApi, /body\.paymentStatus/);
  assert.doesNotMatch(api, /cardNumber|cvv|pan:/i);
  assert.match(center, /Gerçek tahsilat başlatmaz/);
  assert.match(center, /Kart bilgisi girmeyin/);
  assert.match(page, /requireChatGPTUser\("\/admin\/odemeler"\)/);
  assert.match(operations, /payment-mismatch/);
  assert.match(panel, /\/admin\/odemeler/);
  assert.match(orderDetail, /Ödeme defteri/);
  assert.match(auditCenter, /Ödeme işlemi kaydı/);
  assert.match(backup, /"paymentTransactions"/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(exportApi, /paymentTransactionRows/);
});

test("tracks privacy rights requests without automatic deletion or identity documents", async () => {
  const [schema,api,publicPage,adminCenter,adminPage,policies,operations,panel,auditCenter,backup,exportApi] = await Promise.all([
    source("db/schema.ts"),
    source("app/api/privacy-requests/route.ts"),
    source("app/veri-talebi/page.tsx"),
    source("app/admin/veri-talepleri/privacy-request-center.tsx"),
    source("app/admin/veri-talepleri/page.tsx"),
    source("app/politikalar/page.tsx"),
    source("app/api/operations-summary/route.ts"),
    source("app/admin/panel.tsx"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
    source("app/backup-format.ts"),
    source("app/api/export/route.ts"),
  ]);
  assert.match(schema, /privacyRequests/);
  assert.match(schema, /identityStatus/);
  assert.match(api, /scope:"privacy_request"/);
  assert.match(api, /30\*24\*60\*60\*1000/);
  assert.match(api, /eq\(orders\.email,email\)/);
  assert.match(api, /privacy_request\.update/);
  assert.doesNotMatch(api, /delete\(orders\)|delete\(contactMessages\)/);
  assert.match(publicPage, /Kart bilgisi, parola veya kimlik belgesi yüklemeyin/);
  assert.match(adminCenter, /Silme veya dışa aktarma otomatik yapılmaz/);
  assert.match(adminCenter, /Cevap özeti/);
  assert.match(adminPage, /requireChatGPTUser\("\/admin\/veri-talepleri"\)/);
  assert.match(policies, /\/veri-talebi/);
  assert.match(operations, /privacy-/);
  assert.match(panel, /\/admin\/veri-talepleri/);
  assert.match(auditCenter, /Veri talebi güncellemesi/);
  assert.match(backup, /"privacyRequests"/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(exportApi, /privacyRequestRows/);
});

test("requires newsletter verification and supports one-click unsubscribe", async () => {
  const [schema,api,verifyApi,unsubscribeApi,home,verifyPage,preferencePage,panel,operations,auditCenter,backup,exportApi,migration,notificationsApi,notificationsCenter] = await Promise.all([
    source("db/schema.ts"),
    source("app/api/newsletter/route.ts"),
    source("app/api/newsletter/verify/route.ts"),
    source("app/api/newsletter/unsubscribe/route.ts"),
    source("app/page.tsx"),
    source("app/bulten-dogrula/page.tsx"),
    source("app/bulten-tercihi/page.tsx"),
    source("app/admin/panel.tsx"),
    source("app/api/operations-summary/route.ts"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
    source("app/backup-format.ts"),
    source("app/api/export/route.ts"),
    source("drizzle/0034_yielding_sentinels.sql"),
    source("app/api/notifications/route.ts"),
    source("app/admin/bildirimler/notification-center.tsx"),
  ]);
  assert.match(schema, /newsletterOutbox/);
  assert.match(schema, /verificationTokenHash/);
  assert.match(schema, /unsubscribeTokenHash/);
  assert.match(api, /pending_verification/);
  assert.match(api, /body\.consent!==true/);
  assert.match(api, /48\*60\*60\*1000/);
  assert.match(api, /status:"draft"/);
  assert.match(api, /newsletter\.unsubscribe/);
  assert.match(verifyApi, /verificationExpiresAt/);
  assert.match(unsubscribeApi, /status:"unsubscribed"/);
  assert.match(home, /Doğrulama bağlantınız hazırlandı/);
  assert.match(home, /consent:true/);
  assert.match(verifyPage, /Aboneliğiniz aktif/);
  assert.match(preferencePage, /Abonelikten çık/);
  assert.doesNotMatch(panel, /Yeniden aktifleştir/);
  assert.match(operations, /draftNewsletter/);
  assert.match(auditCenter, /Bülten aboneliği durdurma/);
  assert.match(backup, /"newsletterOutbox"/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(exportApi, /newsletterOutboxRows/);
  assert.match(migration, /SET `status` = 'pending_verification'/);
  assert.match(notificationsApi, /newsletterOutbox/);
  assert.match(notificationsCenter, /Bülten doğrulama/);
});

test("protects every admin surface with an owner-managed email allowlist", async () => {
  const [schema,auth,api,page,center,denied,panel,operations,auditCenter,readiness,backup,exportApi,migration,dataSafety] = await Promise.all([
    source("db/schema.ts"),
    source("app/chatgpt-auth.ts"),
    source("app/api/admin-users/route.ts"),
    source("app/admin/ekip/page.tsx"),
    source("app/admin/ekip/team-center.tsx"),
    source("app/admin/erisim-yok/page.tsx"),
    source("app/admin/panel.tsx"),
    source("app/admin/operasyon/operations-center.tsx"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
    source("app/api/launch-readiness/route.ts"),
    source("app/backup-format.ts"),
    source("app/api/export/route.ts"),
    source("drizzle/0035_nifty_mauler.sql"),
    source("app/admin/veri-guvenligi/data-safety-center.tsx"),
  ]);
  assert.match(schema, /adminUsers/);
  assert.match(schema, /email: text\("email"\)\.notNull\(\)\.unique\(\)/);
  assert.match(auth, /getAuthenticatedChatGPTUser/);
  assert.match(auth, /private-site-bootstrap/);
  assert.match(auth, /authorizeChatGPTUser/);
  assert.match(auth, /\/admin\/erisim-yok/);
  assert.match(api, /user\?\.role === "owner"/);
  assert.match(api, /Mağaza sahibi erişimi kapatılamaz/);
  assert.doesNotMatch(api, /export async function DELETE/);
  assert.match(page, /requireOwner\("\/admin\/ekip"\)/);
  assert.match(center, /otomatik davet e-postası gönderilmez/);
  assert.match(denied, /Bu hesap yönetim listesinde değil/);
  assert.match(panel, /\/admin\/ekip/);
  assert.match(operations, /\/admin\/ekip/);
  assert.match(auditCenter, /Yönetici erişimi güncellemesi/);
  assert.match(readiness, /Yönetim erişimi/);
  assert.match(backup, /"adminUsers"/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(exportApi, /adminUserRows/);
  assert.match(migration, /CREATE TABLE `admin_users`/);
  assert.match(dataSafety, /Yönetim kullanıcıları/);
});

test("rejects cross-site admin requests before authentication or database writes", async () => {
  const [auth,securityConfig] = await Promise.all([
    source("app/chatgpt-auth.ts"),
    source("next.config.ts"),
  ]);
  assert.match(auth, /isTrustedRequestContext\(requestHeaders\)/);
  assert.match(auth, /sec-fetch-site/);
  assert.match(auth, /fetchSite === "cross-site"/);
  assert.match(auth, /origin === "null"/);
  assert.match(auth, /x-forwarded-host/);
  assert.match(auth, /x-forwarded-proto/);
  assert.match(auth, /source\.host\.toLowerCase\(\) === host\.toLowerCase\(\)/);
  assert.ok(auth.indexOf("isTrustedRequestContext(requestHeaders)") < auth.indexOf("requestHeaders.get(USER_EMAIL_HEADER)"));
  assert.match(securityConfig, /frame-ancestors 'none'/);
});

test("archives catalog records without destroying order or inventory history", async () => {
  const [productsApi,categoriesApi,panel,auditCenter,schema] = await Promise.all([
    source("app/api/products/route.ts"),
    source("app/api/categories/route.ts"),
    source("app/admin/panel.tsx"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
    source("db/schema.ts"),
  ]);
  assert.match(productsApi, /action:"product\.archive"/);
  assert.match(productsApi, /active:false, marketTr:false, marketGlobal:false, featured:false/);
  assert.doesNotMatch(productsApi, /delete\(products\)/);
  assert.match(categoriesApi, /descendantIds/);
  assert.match(categoriesApi, /inArray\(products\.categoryId,ids\)/);
  assert.match(categoriesApi, /action:"category\.archive"/);
  assert.doesNotMatch(categoriesApi, /delete\(categories\)/);
  assert.match(panel, /Ürün kaydı ve geçmişi korunacak/);
  assert.match(panel, /Ürünlerle arşivle/);
  assert.match(panel, /ürününü arşivle/);
  assert.match(auditCenter, /Ürün arşivleme/);
  assert.match(auditCenter, /Kategori arşivleme/);
  assert.match(schema, /onDelete: "set null"/);
});

test("audits catalog and store-setting changes with valid bounded snapshots", async () => {
  const [productsApi,categoriesApi,settingsApi,auditHelper,auditCenter,backup] = await Promise.all([
    source("app/api/products/route.ts"),
    source("app/api/categories/route.ts"),
    source("app/api/settings/route.ts"),
    source("app/audit-log.ts"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
    source("app/backup-format.ts"),
  ]);
  assert.match(productsApi, /product\.create/);
  assert.match(productsApi, /product\.duplicate/);
  assert.match(productsApi, /product\.bulk_update/);
  assert.match(productsApi, /product\.update/);
  assert.match(categoriesApi, /category\.create/);
  assert.match(categoriesApi, /category\.reorder/);
  assert.match(categoriesApi, /category\.update/);
  assert.match(settingsApi, /changedKeys/);
  assert.match(settingsApi, /settings\.update/);
  assert.match(auditHelper, /_truncated:true/);
  assert.doesNotMatch(auditHelper, /JSON\.stringify\(value\)\.slice/);
  assert.match(auditCenter, /Eski kayıt özeti görüntülenemiyor/);
  assert.match(auditCenter, /\["product","Ürünler"\]/);
  assert.match(auditCenter, /\["settings","Ayarlar"\]/);
  assert.match(backup, /"auditLogs"/);
});

test("archives variants while preserving inventory history and blocking new sales", async () => {
  const [schema,variantsApi,cartApi,ordersApi,reservations,quality,panel,editor,replenishments,backup,migration,auditCenter] = await Promise.all([
    source("db/schema.ts"),
    source("app/api/variants/route.ts"),
    source("app/api/cart/route.ts"),
    source("app/api/orders/route.ts"),
    source("app/inventory-reservations.ts"),
    source("app/catalog-quality.ts"),
    source("app/admin/panel.tsx"),
    source("app/admin/varyant/[id]/variant-editor.tsx"),
    source("app/api/replenishments/route.ts"),
    source("app/backup-format.ts"),
    source("drizzle/0036_woozy_bromley.sql"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
  ]);
  assert.match(schema, /active: integer\("active", \{ mode:"boolean" \}\)\.notNull\(\)\.default\(true\)/);
  assert.match(variantsApi, /eq\(productVariants\.active,true\)/);
  assert.match(variantsApi, /variant\.archive/);
  assert.doesNotMatch(variantsApi, /delete\(productVariants\)/);
  assert.match(cartApi, /variantActive:productVariants\.active/);
  assert.match(cartApi, /Ürün seçeneği artık satışta değil/);
  assert.match(ordersApi, /variantActive:productVariants\.active/);
  assert.match(reservations, /eq\(productVariants\.active,true\)/);
  assert.match(quality, /variants=variants\.filter\(variant=>variant\.active\)/);
  assert.match(panel, /Stok hareketleri ve sipariş geçmişi korunacak/);
  assert.match(editor, /Satışta kullanılabilir/);
  assert.match(replenishments, /eq\(productVariants\.active,true\)/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(migration, /ADD `active` integer DEFAULT true NOT NULL/);
  assert.match(auditCenter, /Varyant arşivleme/);
});

test("creates carts only on valid add-to-cart and cleans expired anonymous carts", async () => {
  const [cartApi,backupsApi,dataSafety,schema] = await Promise.all([
    source("app/api/cart/route.ts"),
    source("app/api/backups/route.ts"),
    source("app/admin/veri-guvenligi/data-safety-center.tsx"),
    source("db/schema.ts"),
  ]);
  assert.match(cartApi, /async function lookupCart/);
  assert.doesNotMatch(cartApi, /async function ensureCart/);
  assert.match(cartApi, /if\(!cart\)return response\(\{items:\[\],market:"TR"\}/);
  assert.ok(cartApi.indexOf("if(!body)return response") < cartApi.indexOf("db.insert(carts)"));
  assert.ok(cartApi.indexOf("if(!session.cart&&quantity>maximum)") < cartApi.indexOf("db.insert(carts)"));
  assert.match(cartApi, /quantity>100/);
  assert.match(cartApi, /Cache-Control":"no-store/);
  assert.match(backupsApi, /35 \* 24 \* 60 \* 60 \* 1000/);
  assert.match(backupsApi, /delete\(carts\)\.where\(lt\(carts\.updatedAt,cartCutoff\)\)/);
  assert.match(backupsApi, /deletedCarts/);
  assert.match(dataSafety, /kullanılmayan sepetler 35 gün/);
  assert.match(schema, /cartItems.*onDelete: "cascade"/s);
});

test("stores an immutable hashed snapshot of the terms accepted with each order", async () => {
  const [schema,contract,ordersApi,detail,evidence,tracking,backup,migration] = await Promise.all([
    source("db/schema.ts"),
    source("app/order-contract.ts"),
    source("app/api/orders/route.ts"),
    source("app/admin/siparis/[id]/order-detail.tsx"),
    source("app/admin/siparis/[id]/contract-evidence.tsx"),
    source("app/api/order-tracking/route.ts"),
    source("app/backup-format.ts"),
    source("drizzle/0037_panoramic_skreet.sql"),
  ]);
  assert.match(schema, /termsSnapshotJson/);
  assert.match(schema, /termsSnapshotHash/);
  assert.match(contract, /ORDER_TERMS_VERSION="order-request-v2"/);
  assert.match(contract, /preliminaryInformationTr/);
  assert.match(contract, /distanceSalesTermsTr/);
  assert.match(contract, /privacyPolicy/);
  assert.match(contract, /shippingPolicy/);
  assert.match(contract, /returnsPolicy/);
  assert.match(contract, /crypto\.subtle\.digest\("SHA-256"/);
  assert.match(ordersApi, /buildOrderContractSnapshot/);
  assert.match(ordersApi, /termsSnapshotJson:contractSnapshot\.json/);
  assert.match(ordersApi, /termsSnapshotHash:contractSnapshot\.hash/);
  assert.match(detail, /ContractEvidence order=\{order\}/);
  assert.match(evidence, /SÖZLEŞME KANITI/);
  assert.match(evidence, /SHA-256/);
  assert.doesNotMatch(tracking, /termsSnapshotJson|termsSnapshotHash/);
  assert.match(backup, /BACKUP_SCHEMA_VERSION = 15/);
  assert.match(migration, /ADD `terms_snapshot_json`/);
  assert.match(migration, /ADD `terms_snapshot_hash`/);
});

test("accepts only signature-verified raster uploads and serves them defensively", async () => {
  const [validation,uploads,media,auditCenter,...uploadScreens] = await Promise.all([
    source("app/media-validation.ts"),
    source("app/api/uploads/route.ts"),
    source("app/api/media/[...key]/route.ts"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
    source("app/admin/bloklar/blocks-editor.tsx"),
    source("app/admin/kategori/[id]/category-editor.tsx"),
    source("app/admin/marka/brand-editor.tsx"),
    source("app/admin/medya/media-library.tsx"),
    source("app/admin/panel.tsx"),
    source("app/admin/seo/seo-editor.tsx"),
    source("app/admin/urun/[id]/product-editor.tsx"),
  ]);
  assert.match(validation, /MAX_MEDIA_BYTES = 8_000_000/);
  assert.match(validation, /"image\/jpeg"/);
  assert.match(validation, /"image\/png"/);
  assert.match(validation, /"image\/webp"/);
  assert.match(validation, /0xff && bytes\[1\] === 0xd8/);
  assert.match(validation, /0x89,0x50,0x4e,0x47/);
  assert.match(validation, /=== "RIFF" && text\(bytes,8,12\) === "WEBP"/);
  assert.doesNotMatch(validation, /image\/svg\+xml/);
  assert.match(uploads, /validateUploadedMedia\(file\)/);
  assert.doesNotMatch(uploads, /file\.type\.startsWith/);
  assert.match(uploads, /crypto\.randomUUID\(\)/);
  assert.match(uploads, /action:"media\.upload"/);
  assert.match(media, /safeContentTypes/);
  assert.match(media, /objectKey\.includes\("\.\."\)/);
  assert.match(media, /"X-Content-Type-Options":"nosniff"/);
  assert.match(media, /"Content-Security-Policy":"default-src 'none'; sandbox"/);
  assert.match(auditCenter, /Medya yükleme/);
  for(const screen of uploadScreens) {
    assert.doesNotMatch(screen, /accept="image\/\*"/);
    assert.doesNotMatch(screen, /image\/svg\+xml|image\/x-icon/);
  }
  assert.match(uploadScreens.join("\n"), /accept="image\/png,image\/jpeg,image\/webp"/);
});

test("prevents referenced media deletion across every storefront image source", async () => {
  const [usage,libraryApi,library,productImages,auditCenter] = await Promise.all([
    source("app/media-usage.ts"),
    source("app/api/media-library/route.ts"),
    source("app/admin/medya/media-library.tsx"),
    source("app/api/product-images/route.ts"),
    source("app/admin/islem-gecmisi/audit-log-center.tsx"),
  ]);
  assert.match(usage, /products\.imageUrl/);
  assert.match(usage, /categories\.imageUrl/);
  assert.match(usage, /productImages\.imageUrl/);
  assert.match(usage, /storeSettings\.value/);
  assert.match(usage, /homepageBlocks\.imageUrl/);
  assert.match(usage, /mediaKeyFromUrl/);
  assert.match(libraryApi, /usedBy:usage\.get/);
  assert.match(libraryApi, /if\(usedBy\.length\)return Response\.json/);
  assert.match(libraryApi, /action:"media\.delete"/);
  assert.match(library, /item\.usedBy\.length/);
  assert.match(library, /Kullanılmıyor · güvenle silinebilir/);
  assert.match(productImages, /findMediaUsage\(image\.imageUrl\)/);
  assert.match(productImages, /if\(key&&!usedBy\.length\)/);
  assert.match(productImages, /action:"product_image\.delete"/);
  assert.match(auditCenter, /Medya silme/);
  assert.match(auditCenter, /Galeri görseli kaldırma/);
  assert.match(auditCenter, /\["media","Medya"\]/);
});
