export const BACKUP_FORMAT = "mysa-store-backup";
export const BACKUP_SCHEMA_VERSION = 23;
export const BACKUP_EXCLUDED_TABLES = ["requestThrottles"] as const;

export const backupTableNames = [
  "settings",
  "adminUsers",
  "categories",
  "products",
  "variants",
  "productImages",
  "homepageBlocks",
  "carts",
  "cartItems",
  "orders",
  "orderItems",
  "paymentTransactions",
  "paymentWebhookReceipts",
  "fulfillmentChecklists",
  "shipmentEvents",
  "inventoryOperations",
  "inventoryOperationItems",
  "inventoryMovements",
  "replenishments",
  "promotions",
  "promotionRedemptions",
  "notificationOutbox",
  "returnRequests",
  "auditLogs",
  "contactMessages",
  "privacyRequests",
  "newsletterSubscribers",
  "newsletterOutbox",
] as const;

type BackupTableName = (typeof backupTableNames)[number];
type BackupData = Record<BackupTableName, unknown[]>;
type BackupEnvelope = {
  format: string;
  schemaVersion: number;
  exportedAt: string;
  checksum: string;
  excludedTables: string[];
  counts: Record<string, number>;
  data: BackupData;
};

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function checksumSource(exportedAt:string, excludedTables:readonly string[], counts:Record<string,number>, data: BackupData) {
  return JSON.stringify({format:BACKUP_FORMAT,schemaVersion:BACKUP_SCHEMA_VERSION,exportedAt,excludedTables,counts,data});
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rowIds(rows: unknown[]) {
  return new Set(rows.filter(isRecord).map((row) => row.id).filter((id) => typeof id === "number"));
}

function rowValues(rows: unknown[],field:string) {
  return new Set(rows.filter(isRecord).map((row) => row[field]).filter((value) => typeof value === "string" || typeof value === "number"));
}

function checkUniqueField(rows:unknown[],field:string,label:string,required=true){
  const seen=new Set<string>();let invalid=0;let duplicates=0;
  for(const row of rows){
    if(!isRecord(row)){invalid++;continue;}
    const value=row[field];
    if(value===null||value===undefined){if(required)invalid++;continue;}
    if(typeof value!=="string"&&typeof value!=="number"){invalid++;continue;}
    const key=`${typeof value}:${String(value)}`;if(seen.has(key))duplicates++;else seen.add(key);
  }
  return[invalid?`${label}: ${invalid} geçersiz ${field}`:"",duplicates?`${label}: ${duplicates} yinelenen ${field}`:""].filter(Boolean);
}

function checkVariantOwnership(rows:unknown[],productField:string,variantField:string,variantOwners:Map<number,unknown>,label:string){
  let broken=0;
  for(const row of rows){if(!isRecord(row))continue;const variantId=row[variantField];if(variantId===null||variantId===undefined)continue;if(typeof variantId!=="number"||variantOwners.get(variantId)!==row[productField])broken++;}
  return broken?`${label}: ${broken} ürün-varyant uyuşmazlığı`:"";
}

function checkReferences(
  childRows: unknown[],
  childField: string,
  parentIds: Set<unknown>,
  label: string,
  allowNull = false,
) {
  let broken = 0;
  for (const row of childRows) {
    if (!isRecord(row)) {
      broken += 1;
      continue;
    }
    const value = row[childField];
    if (allowNull && (value === null || value === undefined)) continue;
    if (!parentIds.has(value)) broken += 1;
  }
  return broken ? `${label}: ${broken} bozuk ilişki` : "";
}

export async function buildBackupEnvelope(data: BackupData): Promise<BackupEnvelope> {
  const counts = Object.fromEntries(backupTableNames.map((name) => [name, data[name].length]));const exportedAt=new Date().toISOString();
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt,
    checksum: await sha256(checksumSource(exportedAt,BACKUP_EXCLUDED_TABLES,counts,data)),
    excludedTables: [...BACKUP_EXCLUDED_TABLES],
    counts,
    data,
  };
}

export async function verifyBackupEnvelope(input: unknown) {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["Dosya geçerli bir yedek nesnesi değil."], counts: {} };
  if (input.format !== BACKUP_FORMAT) errors.push("Yedek biçimi tanınmıyor.");
  if (input.schemaVersion !== BACKUP_SCHEMA_VERSION) errors.push(`Desteklenmeyen yedek sürümü: ${String(input.schemaVersion)}`);
  if(!Array.isArray(input.excludedTables)||JSON.stringify(input.excludedTables)!==JSON.stringify(BACKUP_EXCLUDED_TABLES))errors.push("Yedek kapsam dışı tablo bildirimi geçersiz.");
  if(typeof input.exportedAt!=="string"||!input.exportedAt||Number.isNaN(new Date(input.exportedAt).getTime()))errors.push("Yedek oluşturma zamanı geçersiz.");
  if (!isRecord(input.data)) errors.push("Yedek veri bölümü bulunamadı.");

  const data = (isRecord(input.data) ? input.data : {}) as Partial<BackupData>;
  for (const name of backupTableNames) {
    if (!Array.isArray(data[name])) errors.push(`${name} tablosu eksik veya geçersiz.`);
  }
  if (errors.length) return { valid: false, errors, counts: {} };

  const completeData = data as BackupData;
  const counts = Object.fromEntries(backupTableNames.map((name) => [name, completeData[name].length]));
  const expectedChecksum = await sha256(checksumSource(input.exportedAt as string,BACKUP_EXCLUDED_TABLES,counts,completeData));
  if (input.checksum !== expectedChecksum) errors.push("Dosya bütünlük özeti eşleşmiyor; yedek değiştirilmiş veya hasarlı olabilir.");
  if (isRecord(input.counts)) {
    for (const name of backupTableNames) {
      if (input.counts[name] !== counts[name]) errors.push(`${name} kayıt sayısı özetiyle eşleşmiyor.`);
    }
  } else {
    errors.push("Kayıt sayısı özeti bulunamadı.");
  }

  const productIds = rowIds(completeData.products);
  const categoryIds = rowIds(completeData.categories);
  const cartIds = rowIds(completeData.carts);
  const orderIds = rowIds(completeData.orders);
  const variantIds = rowIds(completeData.variants);
  const promotionIds=rowIds(completeData.promotions);
  const subscriberIds=rowIds(completeData.newsletterSubscribers);
  const inventoryOperationKeys=rowValues(completeData.inventoryOperations,"operationKey");
  const variantOwners=new Map(completeData.variants.filter(isRecord).filter(row=>typeof row.id==="number").map(row=>[row.id as number,row.productId]));
  const primaryFields:Record<BackupTableName,string>={settings:"key",adminUsers:"id",categories:"id",products:"id",variants:"id",productImages:"id",homepageBlocks:"id",carts:"id",cartItems:"id",orders:"id",orderItems:"id",paymentTransactions:"id",paymentWebhookReceipts:"id",fulfillmentChecklists:"id",shipmentEvents:"id",inventoryOperations:"operationKey",inventoryOperationItems:"id",inventoryMovements:"id",replenishments:"id",promotions:"id",promotionRedemptions:"id",notificationOutbox:"id",returnRequests:"id",auditLogs:"id",contactMessages:"id",privacyRequests:"id",newsletterSubscribers:"id",newsletterOutbox:"id"};
  for(const name of backupTableNames)errors.push(...checkUniqueField(completeData[name],primaryFields[name],`${name} birincil anahtarı`));
  const uniqueChecks:[BackupTableName,string,string,boolean?][]=[
    ["adminUsers","email","Yönetim e-postası"],["categories","slug","Kategori adresi"],["products","slug","Ürün adresi"],["variants","sku","Varyant kodu"],["carts","token","Sepet anahtarı"],["orders","orderNumber","Sipariş numarası"],["orders","requestKey","Sipariş istek anahtarı",false],["paymentTransactions","transactionKey","Ödeme işlem anahtarı"],["paymentWebhookReceipts","eventKey","Webhook olay anahtarı"],["fulfillmentChecklists","orderId","Paketleme listesi siparişi"],["replenishments","reference","Tedarik referansı"],["promotions","code","Kampanya kodu"],["promotionRedemptions","orderId","Kampanya kullanımı siparişi"],["notificationOutbox","eventKey","Sipariş bildirim anahtarı"],["returnRequests","requestNumber","İade talep numarası"],["returnRequests","requestKey","İade istek anahtarı",false],["newsletterSubscribers","email","Bülten e-postası"],["newsletterOutbox","eventKey","Bülten ileti anahtarı"],
  ];
  for(const[name,field,label,required]of uniqueChecks)errors.push(...checkUniqueField(completeData[name],field,label,required??true));
  const checks = [
    checkReferences(completeData.categories,"parentId",categoryIds,"Alt kategori-üst kategori",true),
    checkReferences(completeData.products, "categoryId", categoryIds, "Ürün-kategori", true),
    checkReferences(completeData.variants, "productId", productIds, "Varyant-ürün"),
    checkReferences(completeData.productImages, "productId", productIds, "Görsel-ürün"),
    checkReferences(completeData.cartItems, "cartId", cartIds, "Sepet kalemi-sepet"),
    checkReferences(completeData.cartItems, "productId", productIds, "Sepet kalemi-ürün"),
    checkReferences(completeData.cartItems,"variantId",variantIds,"Sepet kalemi-varyant",true),
    checkReferences(completeData.orderItems, "orderId", orderIds, "Sipariş kalemi-sipariş"),
    checkReferences(completeData.orderItems,"productId",productIds,"Sipariş kalemi-ürün",true),
    checkReferences(completeData.orderItems,"variantId",variantIds,"Sipariş kalemi-varyant",true),
    checkReferences(completeData.orders,"promotionId",promotionIds,"Sipariş-kampanya",true),
    checkReferences(completeData.paymentTransactions, "orderId", orderIds, "Ödeme işlemi-sipariş"),
    checkReferences(completeData.fulfillmentChecklists, "orderId", orderIds, "Hazırlık listesi-sipariş"),
    checkReferences(completeData.shipmentEvents, "orderId", orderIds, "Kargo hareketi-sipariş"),
    checkReferences(completeData.inventoryOperationItems, "operationKey", inventoryOperationKeys, "Stok işlem kalemi-işlem"),
    checkReferences(completeData.inventoryOperationItems,"productId",productIds,"Stok işlem kalemi-ürün"),
    checkReferences(completeData.inventoryOperationItems,"variantId",variantIds,"Stok işlem kalemi-varyant",true),
    checkReferences(completeData.inventoryMovements,"operationKey",inventoryOperationKeys,"Stok hareketi-işlem",true),
    checkReferences(completeData.inventoryMovements, "productId", productIds, "Stok hareketi-ürün"),
    checkReferences(completeData.inventoryMovements, "variantId", variantIds, "Stok hareketi-varyant", true),
    checkReferences(completeData.inventoryMovements, "orderId", orderIds, "Stok hareketi-sipariş", true),
    checkReferences(completeData.replenishments, "productId", productIds, "Tedarik-ürün", true),
    checkReferences(completeData.replenishments, "variantId", variantIds, "Tedarik-varyant", true),
    checkReferences(completeData.promotionRedemptions, "promotionId", promotionIds, "Kampanya kullanımı-kampanya"),
    checkReferences(completeData.promotionRedemptions, "orderId", orderIds, "Kampanya kullanımı-sipariş"),
    checkReferences(completeData.notificationOutbox, "orderId", orderIds, "Bildirim-sipariş"),
    checkReferences(completeData.returnRequests, "orderId", orderIds, "İade-sipariş"),
    checkReferences(completeData.contactMessages, "orderId", orderIds, "Destek-sipariş", true),
    checkReferences(completeData.privacyRequests, "orderId", orderIds, "Veri talebi-sipariş", true),
    checkReferences(completeData.newsletterOutbox, "subscriberId", subscriberIds, "Bülten iletisi-abone"),
    checkVariantOwnership(completeData.cartItems,"productId","variantId",variantOwners,"Sepet kalemi"),
    checkVariantOwnership(completeData.orderItems,"productId","variantId",variantOwners,"Sipariş kalemi"),
    checkVariantOwnership(completeData.inventoryOperationItems,"productId","variantId",variantOwners,"Stok işlem kalemi"),
    checkVariantOwnership(completeData.inventoryMovements,"productId","variantId",variantOwners,"Stok hareketi"),
    checkVariantOwnership(completeData.replenishments,"productId","variantId",variantOwners,"Tedarik kaydı"),
  ].filter(Boolean);
  errors.push(...checks);

  return {
    valid: errors.length === 0,
    errors,
    counts,
    checksum: expectedChecksum,
    exportedAt: typeof input.exportedAt === "string" ? input.exportedAt : "",
    schemaVersion: input.schemaVersion,
  };
}
