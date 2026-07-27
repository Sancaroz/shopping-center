import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { contactMessages, fulfillmentChecklists, newsletterOutbox, notificationOutbox, orders, paymentTransactions, privacyRequests, products, productVariants, replenishments, returnRequests } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic="force-dynamic";
const privateNoStore={"Cache-Control":"private, no-store, max-age=0"};

type Alert={key:string;level:"urgent"|"warning"|"info";title:string;detail:string;href:string;createdAt?:string};

export async function GET() {
  const user=await getChatGPTUser();if (!user)return Response.json({error:"Yetkisiz erişim"},{status:401,headers:privateNoStore});
  const db=getDb();
  const [orderRows,productRows,variantRows,returnRows,messageRows,notificationRows,checklistRows,replenishmentRows,paymentRows,privacyRows,newsletterRows]=await Promise.all([
    db.select().from(orders).orderBy(desc(orders.id)).limit(500),
    db.select().from(products),
    db.select().from(productVariants),
    db.select().from(returnRequests).orderBy(desc(returnRequests.id)).limit(300),
    db.select().from(contactMessages).orderBy(desc(contactMessages.id)).limit(300),
    db.select().from(notificationOutbox).orderBy(desc(notificationOutbox.id)).limit(500),
    db.select().from(fulfillmentChecklists),
    db.select().from(replenishments).orderBy(desc(replenishments.id)).limit(500),
    user.role==="owner"?db.select().from(paymentTransactions).orderBy(desc(paymentTransactions.id)).limit(500):Promise.resolve([]),
    user.role==="owner"?db.select().from(privacyRequests).orderBy(desc(privacyRequests.id)).limit(500):Promise.resolve([]),
    user.role==="owner"?db.select({id:newsletterOutbox.id,status:newsletterOutbox.status}).from(newsletterOutbox).orderBy(desc(newsletterOutbox.id)).limit(500):Promise.resolve([]),
  ]);
  const now=Date.now();const hours=(value:string)=>(now-new Date(value).getTime())/3_600_000;
  const activeOrders=orderRows.filter(order=>!["completed","cancelled"].includes(order.status));
  const openReturns=returnRows.filter(item=>["new","reviewing","approved"].includes(item.status));
  const openMessages=messageRows.filter(item=>item.status!=="resolved");
  const draftNotifications=notificationRows.filter(item=>item.status==="draft");const draftNewsletter= newsletterRows.filter(item=>item.status==="draft");
  const packingReady=new Set(checklistRows.filter(item=>item.productChecked&&item.quantityChecked&&item.qualityChecked&&item.packageChecked&&item.addressChecked).map(item=>item.orderId));
  const packingIncomplete=activeOrders.filter(order=>["confirmed","preparing"].includes(order.status)&&!packingReady.has(order.id));
  const overdueReplenishments=replenishmentRows.filter(item=>item.status==="ordered"&&item.expectedAt&&new Date(item.expectedAt).getTime()<now);
  const productNames=new Map(productRows.map(product=>[product.id,product.nameTr]));
  const activeProductIds=new Set(productRows.filter(product=>product.active).map(product=>product.id));
  const lowStock=[
    ...productRows.filter(product=>product.active&&!variantRows.some(variant=>variant.productId===product.id)&&product.stock<=5).map(product=>({key:`product-${product.id}`,name:product.nameTr,stock:product.stock,href:`/admin/urun/${product.id}`})),
    ...variantRows.filter(variant=>activeProductIds.has(variant.productId)&&variant.stock<=5).map(variant=>({key:`variant-${variant.id}`,name:`${productNames.get(variant.productId)??"Ürün"} · ${variant.optionName}: ${variant.optionValue}`,stock:variant.stock,href:`/admin/varyant/${variant.id}`})),
  ];
  const alerts:Alert[]=[
    ...activeOrders.filter(order=>order.status==="new"&&hours(order.createdAt)>=24).map(order=>({key:`order-new-${order.id}`,level:"urgent" as const,title:`${order.orderNumber} hâlâ onay bekliyor`,detail:`${Math.floor(hours(order.createdAt))} saattir yeni durumda.`,href:`/admin/siparis/${order.id}`,createdAt:order.createdAt})),
    ...activeOrders.filter(order=>order.status==="preparing"&&hours(order.updatedAt)>=48).map(order=>({key:`order-preparing-${order.id}`,level:"warning" as const,title:`${order.orderNumber} hazırlıkta bekliyor`,detail:`${Math.floor(hours(order.updatedAt))} saattir güncellenmedi.`,href:`/admin/siparis/${order.id}`,createdAt:order.updatedAt})),
    ...packingIncomplete.map(order=>({key:`packing-${order.id}`,level:"warning" as const,title:`${order.orderNumber} paketleme kontrolü bekliyor`,detail:"Kargoya geçmeden önce beş hazırlık adımı tamamlanmalı.",href:`/admin/siparis/${order.id}`,createdAt:order.updatedAt})),
    ...overdueReplenishments.map(item=>({key:`replenishment-${item.id}`,level:"warning" as const,title:`${item.reference} tedariki gecikti`,detail:`${item.productName} · ${item.quantity} adet bekleniyor.`,href:"/admin/tedarik",createdAt:item.expectedAt??item.updatedAt})),
    ...activeOrders.filter(order=>order.status==="shipped"&&hours(order.lastShipmentEventAt??order.shippedAt??order.updatedAt)>=72).map(order=>({key:`shipment-stale-${order.id}`,level:"urgent" as const,title:`${order.orderNumber} kargoda gecikmiş olabilir`,detail:`${Math.floor(hours(order.lastShipmentEventAt??order.shippedAt??order.updatedAt))} saattir yeni teslimat hareketi yok.`,href:`/admin/siparis/${order.id}`,createdAt:order.lastShipmentEventAt??order.shippedAt??order.updatedAt})),
    ...activeOrders.filter(order=>order.deliveryStatus==="exception").map(order=>({key:`shipment-exception-${order.id}`,level:"urgent" as const,title:`${order.orderNumber} teslimat sorunu`,detail:"Kargo hareketi sorun olarak işaretlendi; taşıyıcıyla iletişim kurulmalı.",href:`/admin/siparis/${order.id}`,createdAt:order.lastShipmentEventAt??order.updatedAt})),
    ...lowStock.filter(item=>item.stock===0).map(item=>({key:`stock-${item.key}`,level:"urgent" as const,title:`${item.name} tükendi`,detail:"Satışa açık stok kalmadı.",href:item.href})),
    ...openReturns.filter(item=>item.status==="new"&&hours(item.createdAt)>=24).map(item=>({key:`return-${item.id}`,level:"warning" as const,title:`${item.requestNumber} inceleme bekliyor`,detail:`${Math.floor(hours(item.createdAt))} saattir yanıt bekliyor.`,href:"/admin/iade-talepleri",createdAt:item.createdAt})),
    ...openMessages.filter(item=>item.status==="new"&&hours(item.createdAt)>=24).map(item=>({key:`message-${item.id}`,level:"warning" as const,title:`${item.name} adlı müşterinin mesajı bekliyor`,detail:`${item.subject} · ${Math.floor(hours(item.createdAt))} saat`,href:"/admin/destek",createdAt:item.createdAt})),
    ...openMessages.filter(item=>item.priority==="urgent").map(item=>({key:`message-urgent-${item.id}`,level:"urgent" as const,title:`${item.subject} acil destek kaydı`,detail:`${item.name} · ${item.orderNumber||"Sipariş numarası yok"}`,href:"/admin/destek",createdAt:item.updatedAt})),
    ...paymentRows.filter(item=>["amount_mismatch","order_closed"].includes(item.reconciliationStatus)).map(item=>({key:`payment-mismatch-${item.id}`,level:"urgent" as const,title:item.reconciliationStatus==="order_closed"?"İptal sipariş için ödeme görüldü":"Ödeme tutarı siparişle uyuşmuyor",detail:`${item.provider} · ${item.providerReference} · kayıt ${item.amount} ${item.currency}, beklenen ${item.expectedAmount} ${item.currency}`,href:"/admin/odemeler",createdAt:item.createdAt})),
    ...privacyRows.filter(item=>!["completed","rejected"].includes(item.status)&&new Date(item.dueAt).getTime()-now<=3*24*60*60*1000).map(item=>({key:`privacy-${item.id}`,level:"urgent" as const,title:`${item.requestNumber} veri talebi sonuç bekliyor`,detail:new Date(item.dueAt).getTime()<now?"Yasal değerlendirme süresi aşılmış görünüyor.":`Son tarih ${new Date(item.dueAt).toLocaleDateString("tr-TR")}.`,href:"/admin/veri-talepleri",createdAt:item.createdAt})),
  ].sort((a,b)=>(a.level==="urgent"?0:1)-(b.level==="urgent"?0:1)||(a.createdAt??"").localeCompare(b.createdAt??""));
  return Response.json({
    generatedAt:new Date().toISOString(),
    metrics:{activeOrders:activeOrders.length,newOrders:activeOrders.filter(order=>order.status==="new").length,preparingOrders:activeOrders.filter(order=>order.status==="preparing").length,packingIncomplete:packingIncomplete.length,overdueReplenishments:overdueReplenishments.length,shippingExceptions:activeOrders.filter(order=>order.deliveryStatus==="exception").length,staleShipments:activeOrders.filter(order=>order.status==="shipped"&&hours(order.lastShipmentEventAt??order.shippedAt??order.updatedAt)>=72).length,lowStock:lowStock.length,outOfStock:lowStock.filter(item=>item.stock===0).length,openReturns:openReturns.length,newReturns:openReturns.filter(item=>item.status==="new").length,openMessages:openMessages.length,newMessages:openMessages.filter(item=>item.status==="new").length,draftNotifications:draftNotifications.length+draftNewsletter.length},
    alerts:alerts.slice(0,30),
    lowStock:lowStock.sort((a,b)=>a.stock-b.stock).slice(0,20),
    recentOrders:activeOrders.slice(0,12).map(order=>({id:order.id,orderNumber:order.orderNumber,status:order.status,customerName:order.customerName,total:order.total,market:order.market,createdAt:order.createdAt})),
  },{headers:privateNoStore});
}
