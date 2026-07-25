import type { orders } from "../db/schema";

type Order=typeof orders.$inferSelect;
export type NotificationEvent="received"|"confirmed"|"shipped"|"cancelled";

export function buildOrderNotification(order:Order,event:NotificationEvent) {
  const en=order.market==="GLOBAL";
  const name=order.customerName;
  const tracking=order.trackingNumber
    ? `\n${en?"Carrier":"Kargo firması"}: ${order.shippingCarrier||"-"}\n${en?"Tracking number":"Takip numarası"}: ${order.trackingNumber}`
    : "";
  const templates={
    received:{
      subject:en?`We received your order request · ${order.orderNumber}`:`Sipariş talebinizi aldık · ${order.orderNumber}`,
      body:en?`Hello ${name},\n\nWe securely received your order request ${order.orderNumber}. No payment has been collected. We will contact you after reviewing availability and delivery details.`:`Merhaba ${name},\n\n${order.orderNumber} numaralı sipariş talebinizi güvenle aldık. Henüz ödeme alınmadı. Stok ve teslimat bilgilerini kontrol ettikten sonra sizinle iletişime geçeceğiz.`,
    },
    confirmed:{
      subject:en?`Your order is confirmed · ${order.orderNumber}`:`Siparişiniz onaylandı · ${order.orderNumber}`,
      body:en?`Hello ${name},\n\nYour order ${order.orderNumber} has been confirmed and will be prepared carefully.`:`Merhaba ${name},\n\n${order.orderNumber} numaralı siparişiniz onaylandı ve özenle hazırlanmaya alınacak.`,
    },
    shipped:{
      subject:en?`Your order has shipped · ${order.orderNumber}`:`Siparişiniz kargoya verildi · ${order.orderNumber}`,
      body:(en?`Hello ${name},\n\nYour order ${order.orderNumber} has been handed to the carrier.`:`Merhaba ${name},\n\n${order.orderNumber} numaralı siparişiniz kargo firmasına teslim edildi.`)+tracking,
    },
    cancelled:{
      subject:en?`Your order was cancelled · ${order.orderNumber}`:`Siparişiniz iptal edildi · ${order.orderNumber}`,
      body:en?`Hello ${name},\n\nYour order ${order.orderNumber} has been cancelled. If you need more information, please contact us with your order number.`:`Merhaba ${name},\n\n${order.orderNumber} numaralı siparişiniz iptal edildi. Ayrıntılı bilgi için sipariş numaranızla bize ulaşabilirsiniz.`,
    },
  }[event];
  return {...templates,recipient:order.email};
}
