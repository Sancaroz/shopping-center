import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { orderItems, orders, shipmentEvents } from "../../../db/schema";
import { enforceRateLimit } from "../../rate-limit";

const noStoreHeaders = { "Cache-Control": "no-store, max-age=0" };

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { orderNumber?: string; email?: string };
  const orderNumber = String(body.orderNumber ?? "").trim().toUpperCase();
  const email = String(body.email ?? "").trim().toLocaleLowerCase("en-US");
  if (!orderNumber || !email.includes("@")) {
    return Response.json({ error: "Sipariş numarası ve e-posta adresi gereklidir." }, { status: 400, headers: noStoreHeaders });
  }
  const limited=await enforceRateLimit(request,{scope:"order_tracking",identifier:email,limit:20,windowMinutes:15});if(limited)return limited;

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
  const events=await db.select({id:shipmentEvents.id,status:shipmentEvents.status,titleTr:shipmentEvents.titleTr,titleEn:shipmentEvents.titleEn,detail:shipmentEvents.detail,location:shipmentEvents.location,occurredAt:shipmentEvents.occurredAt}).from(shipmentEvents).where(and(eq(shipmentEvents.orderId,order.id),eq(shipmentEvents.visibleToCustomer,true))).orderBy(asc(shipmentEvents.occurredAt));

  return Response.json({
    order: {
      orderNumber: order.orderNumber,
      status: order.status,
      market: order.market,
      subtotal: order.subtotal,
      discountAmount: order.discountAmount,
      promoCode: order.promoCode,
      shippingAmount: order.shippingAmount,
      total: order.total,
      shippingCarrier: order.shippingCarrier,
      trackingNumber: order.trackingNumber,
      shippedAt: order.shippedAt,
      deliveryStatus:order.deliveryStatus,
      estimatedDeliveryAt:order.estimatedDeliveryAt,
      deliveredAt:order.deliveredAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      reservationState: order.reservationState,
      reservationExpiresAt: order.reservationExpiresAt,
    },
    items,events,
  }, { headers: noStoreHeaders });
}
