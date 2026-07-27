import {and,asc,eq} from "drizzle-orm";
import {getDb} from "../../../db";
import {notificationOutbox,orders,shipmentEvents} from "../../../db/schema";
import {recordAudit} from "../../audit-log";
import {getChatGPTUser} from "../../chatgpt-auth";
import {isOrderStatus} from "../../order-lifecycle";
import {readBoundedJson} from "../../public-form-security";

const eventCopy={
  label_created:{tr:"Kargo kaydı oluşturuldu",en:"Shipment created"},
  picked_up:{tr:"Kargo teslim alındı",en:"Picked up by carrier"},
  in_transit:{tr:"Transfer merkezinde",en:"In transit"},
  out_for_delivery:{tr:"Dağıtıma çıktı",en:"Out for delivery"},
  delivered:{tr:"Teslim edildi",en:"Delivered"},
  exception:{tr:"Teslimat sorunu",en:"Delivery exception"},
  returned:{tr:"Gönderi geri dönüyor",en:"Returning to sender"},
} as const;

export async function POST(request:Request){
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const parsed=await readBoundedJson(request,5_000);if(parsed.error)return parsed.error;const body=parsed.body as {orderId?:number;status?:string;detail?:string;location?:string;occurredAt?:string;visibleToCustomer?:boolean};
  const orderId=Number(body?.orderId);const status=String(body?.status??"") as keyof typeof eventCopy;
  if(!orderId||!eventCopy[status])return Response.json({error:"Geçerli sipariş ve kargo hareketi zorunludur."},{status:400});
  const occurredAt=String(body?.occurredAt??"").trim();
  if(!occurredAt||Number.isNaN(new Date(occurredAt).getTime()))return Response.json({error:"Geçerli hareket tarihi zorunludur."},{status:400});
  if(new Date(occurredAt).getTime()>Date.now()+5*60*1000)return Response.json({error:"Kargo hareketi gelecekte bir tarihe kaydedilemez."},{status:400});
  const db=getDb();const[order]=await db.select().from(orders).where(eq(orders.id,orderId)).limit(1);
  if(!order)return Response.json({error:"Sipariş bulunamadı."},{status:404});
  if(!order.emailVerifiedAt)return Response.json({error:"E-postası doğrulanmamış siparişe kargo hareketi eklenemez."},{status:409});
  if(order.status==="cancelled")return Response.json({error:"İptal edilmiş siparişe kargo hareketi eklenemez."},{status:409});
  if(!isOrderStatus(order.status))return Response.json({error:"Sipariş durumu geçersiz."},{status:409});
  if(order.deliveredAt&&status!=="returned")return Response.json({error:"Teslim edilmiş gönderiye yalnızca geri dönüş hareketi eklenebilir."},{status:409});
  if(!order.shippingCarrier.trim()||!order.trackingNumber.trim())return Response.json({error:"Önce kargo firması ve takip numarasını kaydedin."},{status:409});
  if(status==="label_created"&&!['confirmed','preparing','shipped'].includes(order.status))return Response.json({error:"Kargo kaydı yalnızca onaylanmış veya hazırlanan siparişe eklenebilir."},{status:409});
  if(["picked_up","in_transit","out_for_delivery","delivered","exception"].includes(status)&&order.status!=="shipped")return Response.json({error:"Önce paketleme kontrolünü tamamlayıp siparişi kargoya verildi durumuna alın."},{status:409});
  if(status==="returned"&&!['shipped','completed'].includes(order.status))return Response.json({error:"Geri dönüş hareketi yalnızca gönderilmiş siparişe eklenebilir."},{status:409});
  const timestamp=new Date(occurredAt).toISOString();
  const[event]=await db.insert(shipmentEvents).values({orderId,status,titleTr:eventCopy[status].tr,titleEn:eventCopy[status].en,detail:String(body?.detail??"").trim().slice(0,500),location:String(body?.location??"").trim().slice(0,120),occurredAt:timestamp,visibleToCustomer:body?.visibleToCustomer!==false,actorEmail:user.email}).returning();
  const isLatest=!order.lastShipmentEventAt||new Date(timestamp)>=new Date(order.lastShipmentEventAt);const updates:Partial<typeof orders.$inferInsert>={lastShipmentEventAt:isLatest?timestamp:order.lastShipmentEventAt,updatedAt:new Date().toISOString()};
  if(isLatest)updates.deliveryStatus=status;
  if(["picked_up","in_transit","out_for_delivery","delivered"].includes(status)){updates.status=status==="delivered"?"completed":"shipped";updates.shippedAt=order.shippedAt??timestamp;}
  if(status==="delivered")updates.deliveredAt=timestamp;
  const[updatedOrder]=await db.update(orders).set(updates).where(and(eq(orders.id,orderId),eq(orders.status,order.status),eq(orders.updatedAt,order.updatedAt))).returning({id:orders.id});
  if(!updatedOrder){await db.delete(shipmentEvents).where(eq(shipmentEvents.id,event.id));return Response.json({error:"Sipariş bu sırada başka bir işlem tarafından güncellendi. Güncel kaydı açıp kargo hareketini yeniden ekleyin."},{status:409,headers:{"Cache-Control":"no-store"}});}
  if(event.visibleToCustomer){const en=order.market==="GLOBAL";await db.insert(notificationOutbox).values({orderId,eventKey:`shipment:${event.id}`,eventType:"shipment_update",recipient:order.email,subject:en?`${event.titleEn} · ${order.orderNumber}`:`${event.titleTr} · ${order.orderNumber}`,body:en?`Hello ${order.customerName},\n\n${event.titleEn}${event.location?` · ${event.location}`:""}.${event.detail?`\n${event.detail}`:""}\n\nCarrier: ${order.shippingCarrier}\nTracking number: ${order.trackingNumber}`:`Merhaba ${order.customerName},\n\n${event.titleTr}${event.location?` · ${event.location}`:""}.${event.detail?`\n${event.detail}`:""}\n\nKargo firması: ${order.shippingCarrier}\nTakip numarası: ${order.trackingNumber}`,status:"draft"}).onConflictDoNothing({target:notificationOutbox.eventKey});}
  await recordAudit({user,action:"shipment.event.create",entityType:"order",entityId:orderId,summary:`${order.orderNumber} siparişine ${eventCopy[status].tr} hareketi eklendi.`,after:{status,location:event.location,occurredAt:timestamp,visibleToCustomer:event.visibleToCustomer}});
  return Response.json({event},{status:201});
}

export async function GET(request:Request){
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const orderId=Number(new URL(request.url).searchParams.get("orderId"));
  if(!orderId)return Response.json({error:"Geçersiz sipariş."},{status:400});
  const events=await getDb().select().from(shipmentEvents).where(eq(shipmentEvents.orderId,orderId)).orderBy(asc(shipmentEvents.occurredAt));
  return Response.json({events},{headers:{"Cache-Control":"no-store"}});
}
