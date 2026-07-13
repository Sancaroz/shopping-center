import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderItems, orders } from "../../../db/schema";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { orderNumber?: string; email?: string };
  const orderNumber = String(body.orderNumber ?? "").trim().toUpperCase();
  const email = String(body.email ?? "").trim().toLocaleLowerCase("en-US");
  if (!orderNumber || !email.includes("@")) {
    return Response.json({ error: "Sipariş numarası ve e-posta adresi gereklidir." }, { status: 400, headers: noStoreHeaders });
  }

  const db = getDb();
  const [order] = await db.select().from(orders).where(eq(orders.orderNumber, orderNumber)).limit(1);
  if (!order || order.email.trim().toLocaleLowerCase("en-US") !== email) {
    return Response.json({ error: "Bu bilgilerle eşleşen bir sipariş bulunamadı." }, { status: 404, headers: noStoreHeaders });
  }

  const items = await db.select({
    id: orderItems.id,
    productName: orderItems.productName,
    variantLabel: orderItems.variantLabel,
    quantity: orderItems.quantity,
    unitPrice: orderItems.unitPrice,
  }).from(orderItems).where(eq(orderItems.orderId, order.id));

  return Response.json({
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      market: order.market,
      subtotal: order.subtotal,
      shippingAmount: order.shippingAmount,
      total: order.total,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    },
    items,
  }, { headers: noStoreHeaders });
}
