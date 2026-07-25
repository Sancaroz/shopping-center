import {and,eq,gte,lte,sql} from "drizzle-orm";
import {getDb} from "../db";
import {orderItems,orders,products,productVariants} from "../db/schema";

type Database=ReturnType<typeof getDb>;
type Line={productId:number;variantId:number|null;quantity:number;productName:string};
type Reserved={kind:"product"|"variant";id:number;quantity:number};

async function restore(db:Database,items:Reserved[]){for(const item of items){if(item.kind==="variant")await db.update(productVariants).set({stock:sql`${productVariants.stock}+${item.quantity}`}).where(eq(productVariants.id,item.id));else await db.update(products).set({stock:sql`${products.stock}+${item.quantity}`,updatedAt:new Date().toISOString()}).where(eq(products.id,item.id));}}

export async function reserveInventory(db:Database,lines:Line[]){
  const reserved:Reserved[]=[];
  for(const line of lines){
    if(line.variantId){const updated=await db.update(productVariants).set({stock:sql`${productVariants.stock}-${line.quantity}`}).where(and(eq(productVariants.id,line.variantId),gte(productVariants.stock,line.quantity))).returning({id:productVariants.id});if(!updated.length){await restore(db,reserved);return{ok:false as const,error:`${line.productName} için yeterli stok bulunmuyor.`};}reserved.push({kind:"variant",id:line.variantId,quantity:line.quantity});}
    else{const updated=await db.update(products).set({stock:sql`${products.stock}-${line.quantity}`,updatedAt:new Date().toISOString()}).where(and(eq(products.id,line.productId),gte(products.stock,line.quantity))).returning({id:products.id});if(!updated.length){await restore(db,reserved);return{ok:false as const,error:`${line.productName} için yeterli stok bulunmuyor.`};}reserved.push({kind:"product",id:line.productId,quantity:line.quantity});}
  }
  return{ok:true as const,reserved,rollback:()=>restore(db,reserved)};
}

export async function releaseOrderReservation(db:Database,orderId:number,state="released"){
  const[order]=await db.select().from(orders).where(eq(orders.id,orderId)).limit(1);if(!order||!order.inventoryApplied||order.reservationState!=="active")return false;
  const lines=await db.select().from(orderItems).where(eq(orderItems.orderId,orderId));await restore(db,lines.filter(line=>line.productId).map(line=>({kind:line.variantId?"variant":"product",id:Number(line.variantId??line.productId),quantity:line.quantity})));
  await db.update(orders).set({inventoryApplied:false,reservationState:state,reservationExpiresAt:null,updatedAt:new Date().toISOString()}).where(eq(orders.id,orderId));return true;
}

export async function releaseExpiredReservations(db:Database){
  const expired=await db.select({id:orders.id}).from(orders).where(and(eq(orders.reservationState,"active"),lte(orders.reservationExpiresAt,new Date().toISOString()))).limit(100);
  for(const order of expired){if(await releaseOrderReservation(db,order.id,"expired"))await db.update(orders).set({status:"cancelled",internalNote:"24 saatlik stok rezervasyonu otomatik olarak sona erdi.",updatedAt:new Date().toISOString()}).where(eq(orders.id,order.id));}
  return expired.length;
}
