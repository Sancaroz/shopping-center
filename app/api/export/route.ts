import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  adminUsers,
  auditLogs,
  cartItems,
  carts,
  categories,
  contactMessages,
  fulfillmentChecklists,
  homepageBlocks,
  inventoryMovements,
  newsletterSubscribers,
  newsletterOutbox,
  notificationOutbox,
  orderItems,
  orders,
  paymentTransactions,
  privacyRequests,
  productImages,
  promotionRedemptions,
  promotions,
  products,
  productVariants,
  returnRequests,
  replenishments,
  shipmentEvents,
  storeSettings,
} from "../../../db/schema";
import { recordAudit } from "../../audit-log";
import { buildBackupEnvelope } from "../../backup-format";
import { getChatGPTOwner, type ChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const date = () => new Date().toISOString().slice(0, 10);

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : typeof value === "boolean" ? (value ? "Evet" : "Hayır") : String(value);
  if (/^[\s\u00a0]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

const downloadHeaders=(contentType:string,contentDisposition:string)=>({
  "Content-Type":contentType,
  "Content-Disposition":contentDisposition,
  "Cache-Control":"private, no-store, max-age=0",
  "Pragma":"no-cache",
  "Expires":"0",
  "X-Content-Type-Options":"nosniff",
  "Content-Security-Policy":"default-src 'none'; sandbox",
  "Cross-Origin-Resource-Policy":"same-origin",
});

function csvResponse(rows: Record<string, unknown>[], name: string) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const csv = [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers:downloadHeaders("text/csv; charset=utf-8",`attachment; filename="${name}-${date()}.csv"`),
  });
}

async function auditedCsvExport(user:ChatGPTUser,type:string,label:string,rows:Record<string,unknown>[],name:string){
  await recordAudit({user,action:"data.export",entityType:"export",entityId:type,summary:`${label} CSV dışa aktarıldı.`,after:{type,rowCount:rows.length}});
  return csvResponse(rows,name);
}

export async function GET(request: Request) {
  const user = await getChatGPTOwner();
  if (!user) return Response.json({ error: "Veri dışa aktarma yalnızca mağaza sahibine açıktır." }, { status: 403 });
  const type = new URL(request.url).searchParams.get("type");
  const db = getDb();
  if (type === "products"){const rows=await db.select().from(products).orderBy(desc(products.id)) as unknown as Record<string,unknown>[];return auditedCsvExport(user,type,"Ürünler",rows,"urunler");}
  if (type === "orders"){const rows=await db.select().from(orders).orderBy(desc(orders.id)) as unknown as Record<string,unknown>[];return auditedCsvExport(user,type,"Siparişler",rows,"siparisler");}
  if (type === "messages"){const rows=await db.select().from(contactMessages).orderBy(desc(contactMessages.id)) as unknown as Record<string,unknown>[];return auditedCsvExport(user,type,"Müşteri mesajları",rows,"musteri-mesajlari");}
  if (type === "subscribers"){const rows=await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.id)) as unknown as Record<string,unknown>[];return auditedCsvExport(user,type,"Bülten aboneleri",rows,"bulten-aboneleri");}
  if (type === "backup") {
    const [
      settings,
      adminUserRows,
      categoryRows,
      productRows,
      variantRows,
      imageRows,
      homepageBlockRows,
      cartRows,
      cartItemRows,
      orderRows,
      orderItemRows,
      paymentTransactionRows,
      privacyRequestRows,
      fulfillmentChecklistRows,
      shipmentEventRows,
      inventoryMovementRows,
      replenishmentRows,
      promotionRows,
      promotionRedemptionRows,
      notificationRows,
      returnRows,
      auditRows,
      messageRows,
      subscriberRows,
      newsletterOutboxRows,
    ] = await Promise.all([
      db.select().from(storeSettings),
      db.select().from(adminUsers),
      db.select().from(categories),
      db.select().from(products),
      db.select().from(productVariants),
      db.select().from(productImages),
      db.select().from(homepageBlocks),
      db.select().from(carts),
      db.select().from(cartItems),
      db.select().from(orders),
      db.select().from(orderItems),
      db.select().from(paymentTransactions),
      db.select().from(privacyRequests),
      db.select().from(fulfillmentChecklists),
      db.select().from(shipmentEvents),
      db.select().from(inventoryMovements),
      db.select().from(replenishments),
      db.select().from(promotions),
      db.select().from(promotionRedemptions),
      db.select().from(notificationOutbox),
      db.select().from(returnRequests),
      db.select().from(auditLogs),
      db.select().from(contactMessages),
      db.select().from(newsletterSubscribers),
      db.select().from(newsletterOutbox),
    ]);
    const backup = await buildBackupEnvelope({
      settings,
      adminUsers: adminUserRows,
      categories: categoryRows,
      products: productRows,
      variants: variantRows,
      productImages: imageRows,
      homepageBlocks: homepageBlockRows,
      carts: cartRows,
      cartItems: cartItemRows,
      orders: orderRows,
      orderItems: orderItemRows,
      paymentTransactions:paymentTransactionRows,
      privacyRequests:privacyRequestRows,
      fulfillmentChecklists:fulfillmentChecklistRows,
      shipmentEvents:shipmentEventRows,
      inventoryMovements:inventoryMovementRows,
      replenishments:replenishmentRows,
      promotions:promotionRows,
      promotionRedemptions:promotionRedemptionRows,
      notificationOutbox: notificationRows,
      returnRequests: returnRows,
      auditLogs: auditRows,
      contactMessages: messageRows,
      newsletterSubscribers: subscriberRows,
      newsletterOutbox:newsletterOutboxRows,
    });
    await recordAudit({
      user,
      action: "backup.create",
      entityType: "backup",
      summary: "Tam mağaza yedeği oluşturuldu.",
      after: { checksum: backup.checksum, counts: backup.counts, schemaVersion: backup.schemaVersion },
    });
    return new Response(JSON.stringify(backup, null, 2), {
      headers:downloadHeaders("application/json; charset=utf-8",`attachment; filename="mysa-tam-yedek-${date()}.json"`),
    });
  }
  return Response.json({ error: "Geçersiz dışa aktarma türü" }, { status: 400 });
}
