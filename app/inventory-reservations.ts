import {and,eq,exists,gte,inArray,lte,sql} from "drizzle-orm";
import {getDb} from "../db";
import {inventoryMovements,inventoryOperations,orderItems,orders,products,promotionRedemptions,promotions,productVariants} from "../db/schema";

type Database=ReturnType<typeof getDb>;
type Line={productId:number;variantId:number|null;quantity:number;productName:string};
type Reserved={kind:"product"|"variant";id:number;productId:number;quantity:number;productName:string};
type ReleaseOptions={
  expectedStatus?:string;
  expectedUpdatedAt?:string;
  orderUpdates?:Partial<typeof orders.$inferInsert>;
  releasePromotion?:boolean;
};

function combineLines(lines:Line[]){
  const combined=new Map<string,Reserved>();
  for(const line of lines){
    if(!Number.isInteger(line.productId)||line.productId<1||!Number.isInteger(line.quantity)||line.quantity<1)continue;
    const kind=line.variantId?"variant":"product";const id=line.variantId??line.productId;const key=`${kind}:${id}`;const current=combined.get(key);
    if(current)current.quantity+=line.quantity;else combined.set(key,{kind,id,productId:line.productId,quantity:line.quantity,productName:line.productName});
  }
  return[...combined.values()];
}

async function rollbackInventoryOperation(db:Database,operationKey:string,items:Reserved[]){
  const rollbackKey=`rollback:${operationKey}`;const activeGuard=()=>exists(db.select({operationKey:inventoryOperations.operationKey}).from(inventoryOperations).where(and(eq(inventoryOperations.operationKey,operationKey),eq(inventoryOperations.state,"active"))));
  const stockUpdates=items.map(item=>item.kind==="variant"
    ?db.update(productVariants).set({stock:sql`${productVariants.stock}+${item.quantity}`,lastStockOperationKey:rollbackKey}).where(and(eq(productVariants.id,item.id),activeGuard()))
    :db.update(products).set({stock:sql`${products.stock}+${item.quantity}`,lastStockOperationKey:rollbackKey,updatedAt:new Date().toISOString()}).where(and(eq(products.id,item.id),activeGuard())));
  const results=await db.batch([...stockUpdates,db.update(inventoryOperations).set({state:"rolled_back",updatedAt:new Date().toISOString()}).where(and(eq(inventoryOperations.operationKey,operationKey),eq(inventoryOperations.state,"active"))).returning({operationKey:inventoryOperations.operationKey})]);
  const rolledBack=results.at(-1);return Array.isArray(rolledBack)&&rolledBack.length>0;
}

export async function reserveInventory(db:Database,lines:Line[]){
  const reserved=combineLines(lines);if(!reserved.length)return{ok:false as const,error:"Sepette ayrılabilecek geçerli ürün bulunmuyor."};
  const operationKey=`reservation:${crypto.randomUUID()}`;
  const stockUpdates=reserved.map(item=>item.kind==="variant"
    ?db.update(productVariants).set({stock:sql`${productVariants.stock}-${item.quantity}`,lastStockOperationKey:operationKey}).where(and(eq(productVariants.id,item.id),eq(productVariants.productId,item.productId),eq(productVariants.active,true),gte(productVariants.stock,item.quantity)))
    :db.update(products).set({stock:sql`${products.stock}-${item.quantity}`,lastStockOperationKey:operationKey,updatedAt:new Date().toISOString()}).where(and(eq(products.id,item.id),eq(products.active,true),gte(products.stock,item.quantity))));
  const applied=reserved.map(item=>item.kind==="variant"
    ?exists(db.select({id:productVariants.id}).from(productVariants).where(and(eq(productVariants.id,item.id),eq(productVariants.productId,item.productId),eq(productVariants.lastStockOperationKey,operationKey))))
    :exists(db.select({id:products.id}).from(products).where(and(eq(products.id,item.id),eq(products.lastStockOperationKey,operationKey)))));
  const allApplied=and(...applied)!;
  const operationInsert=db.insert(inventoryOperations).values({operationKey:sql<string>`CASE WHEN ${allApplied} THEN ${operationKey} ELSE NULL END`,kind:"reservation",state:"active"}).returning({operationKey:inventoryOperations.operationKey});
  try{
    const results=await db.batch([...stockUpdates,operationInsert]);const operation=results.at(-1);if(!Array.isArray(operation)||!operation.length)throw new Error("inventory reservation claim failed");
  }catch{
    for(const item of reserved){const[current]=item.kind==="variant"?await db.select({stock:productVariants.stock,active:productVariants.active}).from(productVariants).where(and(eq(productVariants.id,item.id),eq(productVariants.productId,item.productId))).limit(1):await db.select({stock:products.stock,active:products.active}).from(products).where(eq(products.id,item.id)).limit(1);if(!current||!current.active||current.stock<item.quantity)return{ok:false as const,error:item.kind==="variant"?`${item.productName} seçeneği artık satışta değil veya yeterli stok bulunmuyor.`:`${item.productName} artık satışta değil veya yeterli stok bulunmuyor.`};}
    return{ok:false as const,error:"Sepet stoğu bu sırada değişti. Güncel miktarlarla tekrar deneyin."};
  }
  return{ok:true as const,reserved,operationKey,rollback:()=>rollbackInventoryOperation(db,operationKey,reserved),commit:()=>db.update(inventoryOperations).set({state:"committed",updatedAt:new Date().toISOString()}).where(and(eq(inventoryOperations.operationKey,operationKey),eq(inventoryOperations.state,"active")))};
}

export async function releaseOrderReservation(db:Database,orderId:number,state="released",includeCommitted=false,options:ReleaseOptions={}){
  const[order]=await db.select().from(orders).where(eq(orders.id,orderId)).limit(1);if(!order||!order.inventoryApplied||!(order.reservationState==="active"||(includeCommitted&&order.reservationState==="committed")))return false;
  const rawLines=await db.select().from(orderItems).where(eq(orderItems.orderId,orderId));const lines=combineLines(rawLines.filter(line=>line.productId).map(line=>({productId:Number(line.productId),variantId:line.variantId,quantity:line.quantity,productName:line.productName})));
  const eligibleStates=includeCommitted?["active","committed"]:["active"];const releaseOperationKey=`reservation-release:${orderId}:${state}`;
  const transitionConditions=[eq(orders.id,orderId),eq(orders.inventoryApplied,true),inArray(orders.reservationState,eligibleStates)];
  if(options.expectedStatus!==undefined)transitionConditions.push(eq(orders.status,options.expectedStatus));
  if(options.expectedUpdatedAt!==undefined)transitionConditions.push(eq(orders.updatedAt,options.expectedUpdatedAt));
  const releaseGuard=()=>exists(db.select({id:orders.id}).from(orders).where(and(...transitionConditions)));
  const stockUpdates=[];const movementInserts=[];const movementGuards=[];
  for(const line of lines){
    const movementKey=`${releaseOperationKey}:${line.kind}:${line.id}`;movementGuards.push(exists(db.select({id:inventoryMovements.id}).from(inventoryMovements).where(eq(inventoryMovements.operationKey,movementKey))));
    if(line.kind==="variant"){
      stockUpdates.push(db.update(productVariants).set({stock:sql`${productVariants.stock}+${line.quantity}`,lastStockOperationKey:movementKey}).where(and(eq(productVariants.id,line.id),eq(productVariants.productId,line.productId),releaseGuard())));
      movementInserts.push(db.insert(inventoryMovements).select(db.select({operationKey:sql<string>`${movementKey}`,productId:sql<number>`${line.productId}`,variantId:sql<number>`${line.id}`,orderId:sql<number>`${orderId}`,movementType:sql<string>`${"reservation_release"}`,quantityDelta:sql<number>`${line.quantity}`,previousStock:sql<number>`${productVariants.stock}-${line.quantity}`,nextStock:productVariants.stock,reason:sql<string>`${state==="expired"?"Süresi dolan rezervasyon serbest bırakıldı":order.reservationState==="committed"?"İptal edilen siparişin kesinleşmiş stoğu geri verildi":"Sipariş rezervasyonu serbest bırakıldı"}`,reference:sql<string>`${order.orderNumber}`,actorEmail:sql<string>`${"system"}`}).from(productVariants).where(and(eq(productVariants.id,line.id),eq(productVariants.productId,line.productId),eq(productVariants.lastStockOperationKey,movementKey),releaseGuard()))).onConflictDoNothing());
    }else{
      stockUpdates.push(db.update(products).set({stock:sql`${products.stock}+${line.quantity}`,lastStockOperationKey:movementKey,updatedAt:new Date().toISOString()}).where(and(eq(products.id,line.id),releaseGuard())));
      movementInserts.push(db.insert(inventoryMovements).select(db.select({operationKey:sql<string>`${movementKey}`,productId:sql<number>`${line.productId}`,variantId:sql<number|null>`NULL`,orderId:sql<number>`${orderId}`,movementType:sql<string>`${"reservation_release"}`,quantityDelta:sql<number>`${line.quantity}`,previousStock:sql<number>`${products.stock}-${line.quantity}`,nextStock:products.stock,reason:sql<string>`${state==="expired"?"Süresi dolan rezervasyon serbest bırakıldı":order.reservationState==="committed"?"İptal edilen siparişin kesinleşmiş stoğu geri verildi":"Sipariş rezervasyonu serbest bırakıldı"}`,reference:sql<string>`${order.orderNumber}`,actorEmail:sql<string>`${"system"}`}).from(products).where(and(eq(products.id,line.id),eq(products.lastStockOperationKey,movementKey),releaseGuard()))).onConflictDoNothing());
    }
  }
  const releaseComplete=and(releaseGuard(),...movementGuards)!;const operationInsert=db.insert(inventoryOperations).values({operationKey:sql<string>`CASE WHEN ${releaseComplete} THEN ${releaseOperationKey} ELSE NULL END`,kind:"reservation_release",state:"committed"}).onConflictDoNothing().returning({operationKey:inventoryOperations.operationKey});
  const promotionWrites=[];
  if(options.releasePromotion&&order.promotionId){const redemptionGuard=exists(db.select({id:promotionRedemptions.id}).from(promotionRedemptions).where(and(eq(promotionRedemptions.orderId,orderId),eq(promotionRedemptions.promotionId,order.promotionId))));promotionWrites.push(db.update(promotions).set({usedCount:sql`${promotions.usedCount}-1`,updatedAt:new Date().toISOString()}).where(and(eq(promotions.id,order.promotionId),gte(promotions.usedCount,1),redemptionGuard,releaseGuard())),db.delete(promotionRedemptions).where(and(eq(promotionRedemptions.orderId,orderId),eq(promotionRedemptions.promotionId,order.promotionId),releaseGuard())));}
  const orderUpdate=db.update(orders).set({...(options.orderUpdates??{}),inventoryApplied:false,reservationState:state,reservationExpiresAt:null,updatedAt:options.orderUpdates?.updatedAt??new Date().toISOString()}).where(and(...transitionConditions,exists(db.select({operationKey:inventoryOperations.operationKey}).from(inventoryOperations).where(eq(inventoryOperations.operationKey,releaseOperationKey))))).returning({id:orders.id});
  try{const results=await db.batch([...stockUpdates,...movementInserts,operationInsert,...promotionWrites,orderUpdate]);const released=results.at(-1);return Array.isArray(released)&&released.length>0;}catch{return false;}
}

export async function releaseExpiredReservations(db:Database){
  const expired=await db.select({id:orders.id,status:orders.status,updatedAt:orders.updatedAt,promotionId:orders.promotionId,paymentStatus:orders.paymentStatus}).from(orders).where(and(eq(orders.reservationState,"active"),lte(orders.reservationExpiresAt,new Date().toISOString()))).limit(100);
  let released=0;for(const order of expired){if(await releaseOrderReservation(db,order.id,"expired",false,{expectedStatus:order.status,expectedUpdatedAt:order.updatedAt,releasePromotion:Boolean(order.promotionId&&order.paymentStatus!=="paid"),orderUpdates:{status:"cancelled",internalNote:"24 saatlik stok rezervasyonu otomatik olarak sona erdi.",verificationTokenHash:"",verificationExpiresAt:null}}))released++;}
  return released;
}
