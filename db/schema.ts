import { sql } from "drizzle-orm";
import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const storeSettings = sqliteTable("store_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const categories = sqliteTable("categories", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameTr: text("name_tr").notNull(),
  nameEn: text("name_en").notNull().default(""),
  slug: text("slug").notNull().unique(),
  parentId: integer("parent_id"),
  imageUrl: text("image_url").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  nameTr: text("name_tr").notNull(),
  nameEn: text("name_en").notNull().default(""),
  slug: text("slug").notNull().unique(),
  descriptionTr: text("description_tr").notNull().default(""),
  descriptionEn: text("description_en").notNull().default(""),
  categoryId: integer("category_id").references(() => categories.id),
  imageUrl: text("image_url").notNull().default(""),
  priceTr: real("price_tr").notNull().default(0),
  priceGlobal: real("price_global").notNull().default(0),
  currencyGlobal: text("currency_global").notNull().default("EUR"),
  stock: integer("stock").notNull().default(0),
  marketTr: integer("market_tr", { mode: "boolean" }).notNull().default(true),
  marketGlobal: integer("market_global", { mode: "boolean" }).notNull().default(false),
  featured: integer("featured", { mode: "boolean" }).notNull().default(false),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sourcingType: text("sourcing_type").notNull().default("factory"),
  supplierName: text("supplier_name").notNull().default(""),
  supplierContact: text("supplier_contact").notNull().default(""),
  supplierSku: text("supplier_sku").notNull().default(""),
  unitCost: real("unit_cost").notNull().default(0),
  leadTimeDays: integer("lead_time_days").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(5),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const productVariants = sqliteTable("product_variants", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  optionName: text("option_name").notNull().default(""),
  optionValue: text("option_value").notNull().default(""),
  optionNameEn: text("option_name_en").notNull().default(""),
  optionValueEn: text("option_value_en").notNull().default(""),
  stock: integer("stock").notNull().default(0),
  priceAdjustment: real("price_adjustment").notNull().default(0),
});

export const productImages = sqliteTable("product_images", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  imageUrl: text("image_url").notNull(),
  altText: text("alt_text").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const carts = sqliteTable("carts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  token: text("token").notNull().unique(),
  market: text("market").notNull().default("TR"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const cartItems = sqliteTable("cart_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  cartId: integer("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  variantId: integer("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  quantity: integer("quantity").notNull().default(1),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orders = sqliteTable("orders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderNumber: text("order_number").notNull().unique(),
  market: text("market").notNull().default("TR"),
  status: text("status").notNull().default("new"),
  customerName: text("customer_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  address: text("address").notNull(),
  city: text("city").notNull(),
  postalCode: text("postal_code").notNull().default(""),
  country: text("country").notNull().default("Türkiye"),
  note: text("note").notNull().default(""),
  subtotal: real("subtotal").notNull(),
  shippingAmount: real("shipping_amount").notNull().default(0),
  total: real("total").notNull().default(0),
  requestKey: text("request_key").unique(),
  privacyConsentAt: text("privacy_consent_at"),
  termsConsentAt: text("terms_consent_at"),
  termsVersion: text("terms_version").notNull().default("order-request-v1"),
  paymentStatus: text("payment_status").notNull().default("pending"),
  paymentProvider: text("payment_provider").notNull().default(""),
  paymentReference: text("payment_reference").notNull().default(""),
  shippingCarrier: text("shipping_carrier").notNull().default(""),
  trackingNumber: text("tracking_number").notNull().default(""),
  shippedAt: text("shipped_at"),
  deliveryStatus: text("delivery_status").notNull().default("pending"),
  estimatedDeliveryAt: text("estimated_delivery_at"),
  deliveredAt: text("delivered_at"),
  lastShipmentEventAt: text("last_shipment_event_at"),
  internalNote: text("internal_note").notNull().default(""),
  inventoryApplied: integer("inventory_applied", { mode: "boolean" }).notNull().default(false),
  reservationState: text("reservation_state").notNull().default("none"),
  reservationExpiresAt: text("reservation_expires_at"),
  emailVerifiedAt: text("email_verified_at"),
  verificationTokenHash: text("verification_token_hash").notNull().default(""),
  verificationExpiresAt: text("verification_expires_at"),
  billingType: text("billing_type").notNull().default("individual"),
  billingName: text("billing_name").notNull().default(""),
  billingAddress: text("billing_address").notNull().default(""),
  billingCity: text("billing_city").notNull().default(""),
  billingPostalCode: text("billing_postal_code").notNull().default(""),
  billingCountry: text("billing_country").notNull().default(""),
  billingTaxOffice: text("billing_tax_office").notNull().default(""),
  billingTaxNumber: text("billing_tax_number").notNull().default(""),
  pricingTaxStatus: text("pricing_tax_status").notNull().default("pending"),
  sellerSnapshotJson: text("seller_snapshot_json").notNull().default("{}"),
  invoiceStatus: text("invoice_status").notNull().default("draft"),
  invoiceNumber: text("invoice_number").notNull().default(""),
  invoicedAt: text("invoiced_at"),
  promotionId: integer("promotion_id"),
  promoCode: text("promo_code").notNull().default(""),
  discountAmount: real("discount_amount").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const orderItems = sqliteTable("order_items", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  variantId: integer("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  variantLabel: text("variant_label").notNull().default(""),
  quantity: integer("quantity").notNull(),
  unitPrice: real("unit_price").notNull(),
  unitCostSnapshot: real("unit_cost_snapshot").notNull().default(0),
});

export const paymentTransactions = sqliteTable("payment_transactions", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete:"restrict" }),
  transactionKey: text("transaction_key").notNull().unique(),
  kind: text("kind").notNull(),
  status: text("status").notNull(),
  provider: text("provider").notNull(),
  providerReference: text("provider_reference").notNull(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull(),
  source: text("source").notNull().default("manual"),
  reconciliationStatus: text("reconciliation_status").notNull(),
  expectedAmount: real("expected_amount").notNull(),
  note: text("note").notNull().default(""),
  occurredAt: text("occurred_at").notNull(),
  actorEmail: text("actor_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const fulfillmentChecklists = sqliteTable("fulfillment_checklists", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  orderId: integer("order_id").notNull().unique().references(() => orders.id, { onDelete:"cascade" }),
  productChecked: integer("product_checked", { mode:"boolean" }).notNull().default(false),
  quantityChecked: integer("quantity_checked", { mode:"boolean" }).notNull().default(false),
  qualityChecked: integer("quality_checked", { mode:"boolean" }).notNull().default(false),
  packageChecked: integer("package_checked", { mode:"boolean" }).notNull().default(false),
  addressChecked: integer("address_checked", { mode:"boolean" }).notNull().default(false),
  completedAt: text("completed_at"),
  actorEmail: text("actor_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const shipmentEvents = sqliteTable("shipment_events", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete:"cascade" }),
  status: text("status").notNull(),
  titleTr: text("title_tr").notNull(),
  titleEn: text("title_en").notNull(),
  detail: text("detail").notNull().default(""),
  location: text("location").notNull().default(""),
  occurredAt: text("occurred_at").notNull(),
  visibleToCustomer: integer("visible_to_customer", { mode:"boolean" }).notNull().default(true),
  actorEmail: text("actor_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const inventoryMovements = sqliteTable("inventory_movements", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  productId: integer("product_id").notNull().references(() => products.id, { onDelete:"cascade" }),
  variantId: integer("variant_id").references(() => productVariants.id, { onDelete:"cascade" }),
  orderId: integer("order_id").references(() => orders.id, { onDelete:"cascade" }),
  movementType: text("movement_type").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  previousStock: integer("previous_stock").notNull(),
  nextStock: integer("next_stock").notNull(),
  reason: text("reason").notNull().default(""),
  reference: text("reference").notNull().default(""),
  actorEmail: text("actor_email").notNull().default("system"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const replenishments = sqliteTable("replenishments", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  reference: text("reference").notNull().unique(),
  productId: integer("product_id").references(() => products.id, { onDelete:"set null" }),
  variantId: integer("variant_id").references(() => productVariants.id, { onDelete:"set null" }),
  productName: text("product_name").notNull(),
  variantLabel: text("variant_label").notNull().default(""),
  sourcingType: text("sourcing_type").notNull(),
  supplierName: text("supplier_name").notNull().default(""),
  quantity: integer("quantity").notNull(),
  unitCost: real("unit_cost").notNull().default(0),
  status: text("status").notNull().default("draft"),
  expectedAt: text("expected_at"),
  orderedAt: text("ordered_at"),
  receivedAt: text("received_at"),
  note: text("note").notNull().default(""),
  actorEmail: text("actor_email").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const promotions = sqliteTable("promotions", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  market: text("market").notNull().default("BOTH"),
  discountType: text("discount_type").notNull(),
  discountValue: real("discount_value").notNull(),
  maxDiscount: real("max_discount").notNull().default(0),
  minSubtotal: real("min_subtotal").notNull().default(0),
  usageLimit: integer("usage_limit").notNull().default(0),
  usedCount: integer("used_count").notNull().default(0),
  startsAt: text("starts_at"),
  endsAt: text("ends_at"),
  active: integer("active", { mode:"boolean" }).notNull().default(false),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const promotionRedemptions = sqliteTable("promotion_redemptions", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  promotionId: integer("promotion_id").notNull().references(() => promotions.id, { onDelete:"restrict" }),
  orderId: integer("order_id").notNull().unique().references(() => orders.id, { onDelete:"cascade" }),
  emailHash: text("email_hash").notNull(),
  discountAmount: real("discount_amount").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const notificationOutbox = sqliteTable("notification_outbox", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete:"cascade" }),
  eventKey: text("event_key").notNull().unique(),
  eventType: text("event_type").notNull(),
  channel: text("channel").notNull().default("email"),
  recipient: text("recipient").notNull(),
  subject: text("subject").notNull(),
  body: text("body").notNull(),
  status: text("status").notNull().default("draft"),
  attempts: integer("attempts").notNull().default(0),
  lastError: text("last_error").notNull().default(""),
  sentAt: text("sent_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const returnRequests = sqliteTable("return_requests", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  requestNumber: text("request_number").notNull().unique(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete:"cascade" }),
  requestType: text("request_type").notNull(),
  reason: text("reason").notNull(),
  details: text("details").notNull().default(""),
  status: text("status").notNull().default("new"),
  adminNote: text("admin_note").notNull().default(""),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const auditLogs = sqliteTable("audit_logs", {
  id: integer("id").primaryKey({ autoIncrement:true }),
  actorEmail: text("actor_email").notNull(),
  actorName: text("actor_name").notNull(),
  action: text("action").notNull(),
  entityType: text("entity_type").notNull(),
  entityId: text("entity_id").notNull().default(""),
  summary: text("summary").notNull(),
  beforeJson: text("before_json").notNull().default("{}"),
  afterJson: text("after_json").notNull().default("{}"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const requestThrottles = sqliteTable("request_throttles", {
  keyHash: text("key_hash").primaryKey(),
  scope: text("scope").notNull(),
  requestCount: integer("request_count").notNull().default(0),
  windowStartedAt: text("window_started_at").notNull(),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const contactMessages = sqliteTable("contact_messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  email: text("email").notNull(),
  orderNumber: text("order_number").notNull().default(""),
  orderId: integer("order_id").references(() => orders.id, { onDelete:"set null" }),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").notNull().default("new"),
  priority: text("priority").notNull().default("normal"),
  assignedTo: text("assigned_to").notNull().default(""),
  adminNote: text("admin_note").notNull().default(""),
  resolvedAt: text("resolved_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const newsletterSubscribers = sqliteTable("newsletter_subscribers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  market: text("market").notNull().default("TR"),
  status: text("status").notNull().default("active"),
  consentAt: text("consent_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const homepageBlocks = sqliteTable("homepage_blocks", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  eyebrowTr: text("eyebrow_tr").notNull().default(""), eyebrowEn: text("eyebrow_en").notNull().default(""),
  titleTr: text("title_tr").notNull(), titleEn: text("title_en").notNull().default(""),
  copyTr: text("copy_tr").notNull().default(""), copyEn: text("copy_en").notNull().default(""),
  buttonTr: text("button_tr").notNull().default("Keşfet"), buttonEn: text("button_en").notNull().default("Explore"),
  buttonUrl: text("button_url").notNull().default("/magaza"), imageUrl: text("image_url").notNull().default(""),
  imagePosition: text("image_position").notNull().default("left"), sortOrder: integer("sort_order").notNull().default(0),
  marketTr: integer("market_tr", { mode: "boolean" }).notNull().default(true), marketGlobal: integer("market_global", { mode: "boolean" }).notNull().default(true),
  active: integer("active", { mode: "boolean" }).notNull().default(true), createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
});
