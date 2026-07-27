import { and, asc, desc, eq, lt, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { cartItems, carts, fulfillmentChecklists, inventoryMovements, notificationOutbox, orderItems, orders, products, promotionRedemptions, promotions, productVariants, shipmentEvents, storeSettings } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { buildOrderNotification, type NotificationEvent } from "../../order-notifications";
import { recordAudit } from "../../audit-log";
import { enforceRateLimit } from "../../rate-limit";
import { shippingQuote } from "../../shipping-rules";
import { releaseExpiredReservations, releaseOrderReservation, reserveInventory } from "../../inventory-reservations";
import { createVerificationToken, hashVerificationToken } from "../../order-verification";
import {evaluatePromotion,hashPromotionEmail,releasePromotionClaim} from "../../promotions";
import {buildOrderContractSnapshot} from "../../order-contract";
import {boundedText,containsLikelyCardNumber,isValidEmail,isValidPhone,isValidRequestKey,normalizeEmail,readBoundedJson} from "../../public-form-security";
import {canTransitionOrderStatus,isOrderStatus} from "../../order-lifecycle";

const COOKIE = "store_cart";
const tokenFrom = (request:Request) => request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? null;
async function queueNotification(order:typeof orders.$inferSelect,event:NotificationEvent,verificationUrl=""){const message=buildOrderNotification(order,event,verificationUrl);await getDb().insert(notificationOutbox).values({orderId:order.id,eventKey:`${order.id}:${event}`,eventType:event,recipient:message.recipient,subject:message.subject,body:message.body,status:"draft"}).onConflictDoNothing({target:notificationOutbox.eventKey});}

export async function GET(request:Request) {
  if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" }, { status:401 });
  const db = getDb();
  await releaseExpiredReservations(db);
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (id) {
    const [order] = await db.select().from(orders).where(eq(orders.id,id)).limit(1);
    if (!order) return Response.json({ error:"Sipariş bulunamadı" }, { status:404 });
    const [items,events] = await Promise.all([db.select().from(orderItems).where(eq(orderItems.orderId,id)),db.select().from(shipmentEvents).where(eq(shipmentEvents.orderId,id)).orderBy(asc(shipmentEvents.occurredAt))]);
    return Response.json({ order, items, events });
  }
  const rows = await db.select().from(orders).orderBy(desc(orders.id));
  return Response.json({ orders:rows });
}

export async function POST(request:Request) {
  const token = tokenFrom(request);
  if (!token) return Response.json({ error:"Çantanız bulunamadı." }, { status:400 });
  const parsed=await readBoundedJson(request,20_000);if(parsed.error)return parsed.error;const body=parsed.body!;
  if(String(body.company??"").trim())return Response.json({ok:true},{status:201,headers:{"Cache-Control":"no-store"}});
  const customerName=boundedText(body.customerName,120);const email=normalizeEmail(body.email);const phone=boundedText(body.phone,40);
  const address=boundedText(body.address,600);const city=boundedText(body.city,120);const postalCode=boundedText(body.postalCode,30);const country=boundedText(body.country,100);const note=boundedText(body.note,1000);
  const billingTypeInput=body.billingType;const billingSameAsDelivery=body.billingSameAsDelivery;
  const billingName=billingSameAsDelivery===true&&billingTypeInput!=="corporate"?customerName:boundedText(body.billingName,180);
  const billingAddress=billingSameAsDelivery===true?address:boundedText(body.billingAddress,600);
  const billingCity=billingSameAsDelivery===true?city:boundedText(body.billingCity,120);
  const billingPostalCode=billingSameAsDelivery===true?postalCode:boundedText(body.billingPostalCode,30);
  const billingCountry=billingSameAsDelivery===true?country:boundedText(body.billingCountry,100);
  const billingTaxOffice=boundedText(body.billingTaxOffice,120);const rawTaxNumber=boundedText(body.billingTaxNumber,30);const billingTaxNumber=rawTaxNumber?.replace(/\s/g,"")??null;
  const requestKey=String(body.requestKey??"");
  if(!["individual","corporate"].includes(String(billingTypeInput))||typeof billingSameAsDelivery!=="boolean")return Response.json({error:"Fatura seçimi geçersiz."},{status:400});
  const billingType=billingTypeInput as "individual"|"corporate";
  if (!customerName || customerName.length<2 || !isValidEmail(email) || !phone || !isValidPhone(phone) || !address || address.length<5 || !city || city.length<2 || !country || postalCode===null || note===null || body.privacyConsent!==true || body.termsConsent!==true || !isValidRequestKey(requestKey)) return Response.json({ error:"Lütfen zorunlu teslimat ve onay bilgilerini eksiksiz girin." }, { status:400 });
  if(!billingName||!billingAddress||!billingCity||!billingCountry)return Response.json({error:"Fatura adı ve adres bilgileri eksiksiz girilmelidir."},{status:400});
  if([billingPostalCode,billingTaxOffice,billingTaxNumber].includes(null))return Response.json({error:"Fatura bilgileri izin verilen uzunluğu aşıyor."},{status:400});
  if(containsLikelyCardNumber([address,billingAddress,note].join(" ")))return Response.json({error:"Güvenliğiniz için sipariş veya adres alanlarına kart numarası yazmayın."},{status:400});
  if(billingType==="corporate"&&(!billingTaxNumber||!/^[A-Za-z0-9.-]{5,30}$/.test(billingTaxNumber)||(country==="Türkiye"&&!billingTaxOffice)))return Response.json({error:"Kurumsal fatura için geçerli vergi numarası ve Türkiye siparişlerinde vergi dairesi zorunludur."},{status:400});
  const limited=await enforceRateLimit(request,{scope:"order_create",identifier:email,limit:10,windowMinutes:60});if(limited)return limited;

  const db = getDb();
  const[duplicate]=await db.select().from(orders).where(eq(orders.requestKey,requestKey)).limit(1);
  if(duplicate){if(duplicate.email!==email)return Response.json({error:"Bu sipariş isteği doğrulanamadı."},{status:409});return Response.json({orderNumber:duplicate.orderNumber,subtotal:duplicate.subtotal,discountAmount:duplicate.discountAmount,shippingAmount:duplicate.shippingAmount,total:duplicate.total,market:duplicate.market},{status:200});}
  const settingRows=await db.select().from(storeSettings);const settings=Object.fromEntries(settingRows.map(row=>[row.key,row.value]));
  if(settings.orderIntakeStatus==="paused")return Response.json({error:"Sipariş talepleri kısa süreliğine durduruldu. Lütfen daha sonra yeniden deneyin."},{status:503,headers:{"Retry-After":"900","Cache-Control":"no-store"}});
  const [cart] = await db.select().from(carts).where(eq(carts.token, token)).limit(1);
  if (!cart) return Response.json({ error:"Çantanız bulunamadı." }, { status:400 });
  const lines = await db.select({
    cartItemId:cartItems.id, productId:products.id, variantId:productVariants.id, quantity:cartItems.quantity,
    productName:products.nameTr, productNameEn:products.nameEn, priceTr:products.priceTr, priceGlobal:products.priceGlobal, unitCost:products.unitCost, stock:products.stock, active:products.active, marketTr:products.marketTr, marketGlobal:products.marketGlobal,
    optionName:productVariants.optionName, optionValue:productVariants.optionValue, optionNameEn:productVariants.optionNameEn, optionValueEn:productVariants.optionValueEn,
    variantStock:productVariants.stock, variantActive:productVariants.active, priceAdjustment:productVariants.priceAdjustment,
  }).from(cartItems).innerJoin(products, eq(cartItems.productId, products.id)).leftJoin(productVariants, eq(cartItems.variantId, productVariants.id)).where(eq(cartItems.cartId, cart.id));
  if (!lines.length) return Response.json({ error:"Çantanız boş." }, { status:400 });
  const unavailable = lines.find(line => !line.active || (line.variantId&&!line.variantActive) || (cart.market==="TR"?!line.marketTr:!line.marketGlobal));
  if (unavailable) return Response.json({ error:cart.market==="GLOBAL"?`${unavailable.productNameEn||unavailable.productName} is no longer available in the global store.`:`${unavailable.productName} artık Türkiye mağazasında satışta değil.` }, { status:409 });
  const insufficient = lines.find(line => line.quantity > (line.variantId ? Number(line.variantStock ?? 0) : line.stock));
  if (insufficient) return Response.json({ error:`${cart.market==="GLOBAL"?(insufficient.productNameEn||insufficient.productName):insufficient.productName} için yeterli stok bulunmuyor.` }, { status:409 });

  const priced = lines.map(line => ({ ...line, unitPrice:(cart.market === "GLOBAL" ? line.priceGlobal : line.priceTr) + Number(line.priceAdjustment ?? 0) }));
  const invalidPrice=priced.find(line=>!Number.isFinite(line.unitPrice)||line.unitPrice<=0);
  if(invalidPrice)return Response.json({error:cart.market==="GLOBAL"?`${invalidPrice.productNameEn||invalidPrice.productName} is not on sale yet.`:`${invalidPrice.productName} henüz satışa açılmadı.`},{status:409});
  const subtotal = priced.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);const promoCode=String(body.promoCode??"").trim().toUpperCase().slice(0,40);const promotionResult=await evaluatePromotion(db,{code:promoCode,market:cart.market==="GLOBAL"?"GLOBAL":"TR",subtotal});if(!promotionResult.ok)return Response.json({error:promotionResult.error},{status:409});const discountAmount=promotionResult.discountAmount;const discountedSubtotal=Math.max(0,subtotal-discountAmount);
  const quote=shippingQuote({market:cart.market==="GLOBAL"?"GLOBAL":"TR",country,subtotal:discountedSubtotal,settings});
  if(!quote.ok)return Response.json({error:quote.error},{status:409});
  const shippingAmount=quote.shippingAmount;const total=quote.total;
  const contractSnapshot=await buildOrderContractSnapshot(settings,cart.market==="GLOBAL"?"GLOBAL":"TR");
  const reservation=await reserveInventory(db,priced.map(line=>({productId:line.productId,variantId:line.variantId,quantity:line.quantity,productName:cart.market==="GLOBAL"?(line.productNameEn||line.productName):line.productName})));
  if(!reservation.ok)return Response.json({error:reservation.error},{status:409});
  const orderNumber = `MS-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
  const verificationToken=createVerificationToken();const verificationTokenHash=await hashVerificationToken(verificationToken);const verificationExpiresAt=new Date(Date.now()+24*60*60*1000).toISOString();
  const sellerSnapshotJson=JSON.stringify({legalStatus:settings.legalStatus??"draft",legalName:settings.legalName??"",legalBusinessType:settings.legalBusinessType??"",legalAddress:settings.legalAddress??"",legalTaxOffice:settings.legalTaxOffice??"",legalTaxNumber:settings.legalTaxNumber??"",legalEmail:settings.legalEmail??"",legalPhone:settings.legalPhone??""});
  let promotionClaimed=false;if(promotionResult.promotion){const promo=promotionResult.promotion;const claimed=await db.update(promotions).set({usedCount:sql`${promotions.usedCount}+1`,updatedAt:new Date().toISOString()}).where(promo.usageLimit>0?and(eq(promotions.id,promo.id),eq(promotions.active,true),lt(promotions.usedCount,promo.usageLimit)):and(eq(promotions.id,promo.id),eq(promotions.active,true))).returning({id:promotions.id});if(!claimed.length){await reservation.rollback();return Response.json({error:"İndirim kodunun kullanım sınırı doldu veya kod kapatıldı."},{status:409});}promotionClaimed=true;}
  const consentAt=new Date().toISOString();
  let order:typeof orders.$inferSelect|undefined;try{[order] = await db.insert(orders).values({
    orderNumber, market:cart.market, customerName, email, phone, address, city,
    postalCode, country:quote.country,
    note, subtotal,shippingAmount,total,discountAmount,promotionId:promotionResult.promotion?.id??null,promoCode:promotionResult.promotion?.code??"",requestKey,privacyConsentAt:consentAt,termsConsentAt:consentAt,termsVersion:contractSnapshot.version,termsSnapshotJson:contractSnapshot.json,termsSnapshotHash:contractSnapshot.hash,inventoryApplied:true,reservationState:"active",reservationExpiresAt:verificationExpiresAt,verificationTokenHash,verificationExpiresAt,billingType,billingName,billingAddress,billingCity,billingPostalCode:billingPostalCode??"",billingCountry,billingTaxOffice:billingTaxOffice??"",billingTaxNumber:billingTaxNumber??"",pricingTaxStatus:settings.taxDisplayMode??"pending",sellerSnapshotJson,
  }).returning();
  await db.insert(orderItems).values(priced.map(line => ({
    orderId:order.id, productId:line.productId, variantId:line.variantId, productName:cart.market==="GLOBAL"?(line.productNameEn||line.productName):line.productName,
    variantLabel:line.optionValue ? (cart.market==="GLOBAL"?`${line.optionNameEn||line.optionName}: ${line.optionValueEn||line.optionValue}`:`${line.optionName}: ${line.optionValue}`) : "", quantity:line.quantity, unitPrice:line.unitPrice,unitCostSnapshot:cart.market==="TR"?line.unitCost:0,
  })));
  if(promotionResult.promotion)await db.insert(promotionRedemptions).values({promotionId:promotionResult.promotion.id,orderId:order.id,emailHash:await hashPromotionEmail(email),discountAmount});
  for(const line of priced){const[current]=line.variantId?await db.select({stock:productVariants.stock}).from(productVariants).where(eq(productVariants.id,line.variantId)).limit(1):await db.select({stock:products.stock}).from(products).where(eq(products.id,line.productId)).limit(1);if(!current)throw new Error("reserved stock missing");await db.insert(inventoryMovements).values({productId:line.productId,variantId:line.variantId,orderId:order.id,movementType:"reservation",quantityDelta:-line.quantity,previousStock:current.stock+line.quantity,nextStock:current.stock,reason:"Sipariş talebi için 24 saatlik stok rezervasyonu",reference:order.orderNumber,actorEmail:"system"});}
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));}catch{if(order?.id)await db.delete(orders).where(eq(orders.id,order.id));if(promotionClaimed&&promotionResult.promotion)await releasePromotionClaim(db,{orderId:order?.id??0,promotionId:promotionResult.promotion.id});await reservation.rollback();return Response.json({error:"Sipariş talebi kaydedilemedi; ayrılan stok geri bırakıldı."},{status:500});}
  if(!order){await reservation.rollback();return Response.json({error:"Sipariş talebi kaydedilemedi; ayrılan stok geri bırakıldı."},{status:500});}
  await queueNotification(order,"verification",`https://mysa-objets-store.robologai.chatgpt.site/siparis-dogrula?token=${verificationToken}`).catch(()=>undefined);
  await queueNotification(order,"received").catch(()=>undefined);
  return Response.json({ orderNumber, subtotal,discountAmount,shippingAmount,total,market:cart.market }, { status:201 });
}

export async function PATCH(request:Request) {
  const user=await getChatGPTUser();
  if (!user) return Response.json({ error:"Yetkisiz erişim" }, { status:401 });
  const parsed=await readBoundedJson(request,10_000);if(parsed.error)return parsed.error;const body=parsed.body as { id?:number; status?:string; shippingCarrier?:string; trackingNumber?:string; estimatedDeliveryAt?:string; internalNote?:string };
  if (!Number.isInteger(Number(body.id))||Number(body.id)<=0) return Response.json({ error:"Geçersiz sipariş" }, { status:400 });
  if(body.status!==undefined&&!isOrderStatus(body.status))return Response.json({error:"Geçersiz sipariş durumu"},{status:400});
  const db=getDb();const orderId=Number(body.id);const[existing]=await db.select().from(orders).where(eq(orders.id,orderId)).limit(1);if(!existing)return Response.json({error:"Sipariş bulunamadı"},{status:404});const lines=await db.select().from(orderItems).where(eq(orderItems.orderId,orderId));const nextStatus=body.status===undefined?existing.status:String(body.status);const needsInventory=["confirmed","preparing","shipped","completed"].includes(nextStatus);
  if(body.status!==undefined&&!canTransitionOrderStatus(existing.status,nextStatus))return Response.json({error:`Sipariş ${existing.status} durumundan ${nextStatus} durumuna geçirilemez.`},{status:409});
  if(needsInventory&&!existing.emailVerifiedAt)return Response.json({error:"Müşteri e-posta adresini doğrulamadan sipariş onaylanamaz."},{status:409});
  if(body.status==="cancelled"&&["paid","partially_refunded"].includes(existing.paymentStatus))return Response.json({error:"Tahsil edilmiş sipariş, ödeme defterinde iade tamamlanmadan iptal edilemez."},{status:409});
  if(body.status==="completed"&&(!existing.deliveredAt||existing.deliveryStatus!=="delivered"))return Response.json({error:"Sipariş, teslim edildi kargo hareketi kaydedilmeden tamamlanamaz."},{status:409});
  const effectiveCarrier=body.shippingCarrier===undefined?existing.shippingCarrier:String(body.shippingCarrier).trim();const effectiveTracking=body.trackingNumber===undefined?existing.trackingNumber:String(body.trackingNumber).trim();
  if(body.status==="shipped"&&(!effectiveCarrier||!effectiveTracking))return Response.json({error:"Kargoya verildi durumundan önce kargo firması ve takip numarası kaydedilmelidir."},{status:409});
  if(body.status==="shipped"){const[checklist]=await db.select().from(fulfillmentChecklists).where(eq(fulfillmentChecklists.orderId,orderId)).limit(1);if(!checklist||![checklist.productChecked,checklist.quantityChecked,checklist.qualityChecked,checklist.packageChecked,checklist.addressChecked].every(Boolean))return Response.json({error:"Kargoya vermeden önce paketleme kontrol listesinin tamamı kaydedilmelidir."},{status:409});}
  if(needsInventory&&!existing.inventoryApplied){const checks=[] as Array<{kind:"variant"|"product";id:number;quantity:number;stock:number}>;for(const line of lines){if(line.variantId){const[row]=await db.select().from(productVariants).where(and(eq(productVariants.id,line.variantId),eq(productVariants.active,true))).limit(1);if(!row||row.stock<line.quantity)return Response.json({error:`${line.productName} varyantı artık satışta değil veya yeterli stoğu yok.`},{status:409});checks.push({kind:"variant",id:row.id,quantity:line.quantity,stock:row.stock});}else if(line.productId){const[row]=await db.select().from(products).where(eq(products.id,line.productId)).limit(1);if(!row||row.stock<line.quantity)return Response.json({error:`${line.productName} için yeterli stok yok.`},{status:409});checks.push({kind:"product",id:row.id,quantity:line.quantity,stock:row.stock});}else return Response.json({error:`${line.productName} artık katalogda bulunmuyor.`},{status:409});}for(const item of checks){if(item.kind==="variant")await db.update(productVariants).set({stock:item.stock-item.quantity}).where(eq(productVariants.id,item.id));else await db.update(products).set({stock:item.stock-item.quantity,updatedAt:new Date().toISOString()}).where(eq(products.id,item.id));}}
  if(body.status!==undefined&&nextStatus==="cancelled"&&["active","committed"].includes(existing.reservationState))await releaseOrderReservation(db,orderId,"released",true);
  const releasePromotion=body.status!==undefined&&nextStatus==="cancelled"&&existing.status!=="cancelled"&&existing.paymentStatus!=="paid"&&Boolean(existing.promotionId);
  const inventoryApplied=needsInventory?true:nextStatus==="cancelled"?false:existing.inventoryApplied;
  const updates:Partial<typeof orders.$inferInsert>={status:nextStatus,inventoryApplied,updatedAt:new Date().toISOString()};
  if(needsInventory&&existing.reservationState==="active"){updates.reservationState="committed";updates.reservationExpiresAt=null;}
  if(nextStatus==="cancelled"){updates.reservationState=["active","committed"].includes(existing.reservationState)?"released":existing.reservationState;updates.reservationExpiresAt=null;updates.verificationTokenHash="";updates.verificationExpiresAt=null;}
  if(body.shippingCarrier!==undefined)updates.shippingCarrier=String(body.shippingCarrier).trim().slice(0,80);
  if(body.trackingNumber!==undefined)updates.trackingNumber=String(body.trackingNumber).trim().slice(0,160);
  if(body.estimatedDeliveryAt!==undefined){const value=String(body.estimatedDeliveryAt).trim();if(value&&Number.isNaN(new Date(value).getTime()))return Response.json({error:"Tahmini teslim tarihi geçersiz."},{status:400});updates.estimatedDeliveryAt=value?new Date(value).toISOString():null;}
  if(body.internalNote!==undefined)updates.internalNote=String(body.internalNote).trim().slice(0,2000);
  if(body.status==="shipped"&&!existing.shippedAt)updates.shippedAt=new Date().toISOString();
  const[order]=await db.update(orders).set(updates).where(eq(orders.id,orderId)).returning();
  if(releasePromotion&&existing.promotionId)await releasePromotionClaim(db,{orderId,promotionId:existing.promotionId});
  const notificationEvents:Partial<Record<string,NotificationEvent>>={confirmed:"confirmed",shipped:"shipped",cancelled:"cancelled"};
  const notificationEvent=body.status!==undefined&&nextStatus!==existing.status?notificationEvents[nextStatus]:undefined;
  if(notificationEvent)await queueNotification(order,notificationEvent);
  await recordAudit({user,action:"order.update",entityType:"order",entityId:order.id,summary:`${order.orderNumber} siparişi güncellendi.`,before:{status:existing.status,paymentStatus:existing.paymentStatus,shippingCarrier:existing.shippingCarrier,trackingNumber:existing.trackingNumber},after:{status:order.status,paymentStatus:order.paymentStatus,shippingCarrier:order.shippingCarrier,trackingNumber:order.trackingNumber}});
  return Response.json({order});
}
