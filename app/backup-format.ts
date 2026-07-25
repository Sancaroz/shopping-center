export const BACKUP_FORMAT = "mysa-store-backup";
export const BACKUP_SCHEMA_VERSION = 2;

export const backupTableNames = [
  "settings",
  "categories",
  "products",
  "variants",
  "productImages",
  "homepageBlocks",
  "carts",
  "cartItems",
  "orders",
  "orderItems",
  "shipmentEvents",
  "notificationOutbox",
  "returnRequests",
  "auditLogs",
  "contactMessages",
  "newsletterSubscribers",
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

function checksumSource(schemaVersion: number, data: BackupData) {
  return JSON.stringify({ schemaVersion, data });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function rowIds(rows: unknown[]) {
  return new Set(rows.filter(isRecord).map((row) => row.id).filter((id) => typeof id === "number"));
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
  const counts = Object.fromEntries(backupTableNames.map((name) => [name, data[name].length]));
  return {
    format: BACKUP_FORMAT,
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    checksum: await sha256(checksumSource(BACKUP_SCHEMA_VERSION, data)),
    excludedTables: ["requestThrottles"],
    counts,
    data,
  };
}

export async function verifyBackupEnvelope(input: unknown) {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["Dosya geçerli bir yedek nesnesi değil."], counts: {} };
  if (input.format !== BACKUP_FORMAT) errors.push("Yedek biçimi tanınmıyor.");
  if (input.schemaVersion !== BACKUP_SCHEMA_VERSION) errors.push(`Desteklenmeyen yedek sürümü: ${String(input.schemaVersion)}`);
  if (!isRecord(input.data)) errors.push("Yedek veri bölümü bulunamadı.");

  const data = (isRecord(input.data) ? input.data : {}) as Partial<BackupData>;
  for (const name of backupTableNames) {
    if (!Array.isArray(data[name])) errors.push(`${name} tablosu eksik veya geçersiz.`);
  }
  if (errors.length) return { valid: false, errors, counts: {} };

  const completeData = data as BackupData;
  const counts = Object.fromEntries(backupTableNames.map((name) => [name, completeData[name].length]));
  const expectedChecksum = await sha256(checksumSource(BACKUP_SCHEMA_VERSION, completeData));
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
  const checks = [
    checkReferences(completeData.products, "categoryId", categoryIds, "Ürün-kategori", true),
    checkReferences(completeData.variants, "productId", productIds, "Varyant-ürün"),
    checkReferences(completeData.productImages, "productId", productIds, "Görsel-ürün"),
    checkReferences(completeData.cartItems, "cartId", cartIds, "Sepet kalemi-sepet"),
    checkReferences(completeData.cartItems, "productId", productIds, "Sepet kalemi-ürün"),
    checkReferences(completeData.orderItems, "orderId", orderIds, "Sipariş kalemi-sipariş"),
    checkReferences(completeData.shipmentEvents, "orderId", orderIds, "Kargo hareketi-sipariş"),
    checkReferences(completeData.notificationOutbox, "orderId", orderIds, "Bildirim-sipariş"),
    checkReferences(completeData.returnRequests, "orderId", orderIds, "İade-sipariş"),
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
