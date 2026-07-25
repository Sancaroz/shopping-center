import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  auditLogs,
  cartItems,
  carts,
  categories,
  contactMessages,
  homepageBlocks,
  newsletterSubscribers,
  notificationOutbox,
  orderItems,
  orders,
  productImages,
  products,
  productVariants,
  returnRequests,
  shipmentEvents,
  storeSettings,
} from "../../../db/schema";
import { recordAudit } from "../../audit-log";
import { buildBackupEnvelope } from "../../backup-format";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const date = () => new Date().toISOString().slice(0, 10);

function csvCell(value: unknown) {
  let text = value === null || value === undefined ? "" : typeof value === "boolean" ? (value ? "Evet" : "Hayır") : String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

function csvResponse(rows: Record<string, unknown>[], name: string) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const csv = [headers.map(csvCell).join(","), ...rows.map((row) => headers.map((key) => csvCell(row[key])).join(","))].join("\r\n");
  return new Response(`\uFEFF${csv}`, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${name}-${date()}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}

export async function GET(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const type = new URL(request.url).searchParams.get("type");
  const db = getDb();
  if (type === "products") return csvResponse(await db.select().from(products).orderBy(desc(products.id)) as unknown as Record<string, unknown>[], "urunler");
  if (type === "orders") return csvResponse(await db.select().from(orders).orderBy(desc(orders.id)) as unknown as Record<string, unknown>[], "siparisler");
  if (type === "messages") return csvResponse(await db.select().from(contactMessages).orderBy(desc(contactMessages.id)) as unknown as Record<string, unknown>[], "musteri-mesajlari");
  if (type === "subscribers") return csvResponse(await db.select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.id)) as unknown as Record<string, unknown>[], "bulten-aboneleri");
  if (type === "backup") {
    const [
      settings,
      categoryRows,
      productRows,
      variantRows,
      imageRows,
      homepageBlockRows,
      cartRows,
      cartItemRows,
      orderRows,
      orderItemRows,
      shipmentEventRows,
      notificationRows,
      returnRows,
      auditRows,
      messageRows,
      subscriberRows,
    ] = await Promise.all([
      db.select().from(storeSettings),
      db.select().from(categories),
      db.select().from(products),
      db.select().from(productVariants),
      db.select().from(productImages),
      db.select().from(homepageBlocks),
      db.select().from(carts),
      db.select().from(cartItems),
      db.select().from(orders),
      db.select().from(orderItems),
      db.select().from(shipmentEvents),
      db.select().from(notificationOutbox),
      db.select().from(returnRequests),
      db.select().from(auditLogs),
      db.select().from(contactMessages),
      db.select().from(newsletterSubscribers),
    ]);
    const backup = await buildBackupEnvelope({
      settings,
      categories: categoryRows,
      products: productRows,
      variants: variantRows,
      productImages: imageRows,
      homepageBlocks: homepageBlockRows,
      carts: cartRows,
      cartItems: cartItemRows,
      orders: orderRows,
      orderItems: orderItemRows,
      shipmentEvents:shipmentEventRows,
      notificationOutbox: notificationRows,
      returnRequests: returnRows,
      auditLogs: auditRows,
      contactMessages: messageRows,
      newsletterSubscribers: subscriberRows,
    });
    await recordAudit({
      user,
      action: "backup.create",
      entityType: "backup",
      summary: "Tam mağaza yedeği oluşturuldu.",
      after: { checksum: backup.checksum, counts: backup.counts, schemaVersion: backup.schemaVersion },
    });
    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="mysa-tam-yedek-${date()}.json"`,
        "Cache-Control": "no-store",
      },
    });
  }
  return Response.json({ error: "Geçersiz dışa aktarma türü" }, { status: 400 });
}
