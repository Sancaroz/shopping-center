import {and,eq,inArray,lte} from "drizzle-orm";
import {getDb} from "../db";
import {inventoryOperations,orders} from "../db/schema";
import {releaseOrderReservation,rollbackInventoryOperation} from "./inventory-reservations";
import {releasePromotionClaim} from "./promotions";

type Database=ReturnType<typeof getDb>;

export async function recoverStaleCreatingOrder(db:Database,order:typeof orders.$inferSelect,cutoff:string){
  const[claimed]=await db.update(orders).set({creationState:"recovering",updatedAt:new Date().toISOString()}).where(and(eq(orders.id,order.id),inArray(orders.creationState,["creating","recovering"]),eq(orders.updatedAt,order.updatedAt),lte(orders.updatedAt,cutoff))).returning();if(!claimed){const[current]=await db.select({creationState:orders.creationState}).from(orders).where(eq(orders.id,order.id)).limit(1);return !current;}
  if(claimed.inventoryApplied){
    if(claimed.inventoryOperationKey){const rolledBack=await rollbackInventoryOperation(db,claimed.inventoryOperationKey);if(!rolledBack){const[operation]=await db.select({state:inventoryOperations.state}).from(inventoryOperations).where(eq(inventoryOperations.operationKey,claimed.inventoryOperationKey)).limit(1);if(operation?.state!=="rolled_back")return false;}await db.update(orders).set({inventoryApplied:false,reservationState:"released",reservationExpiresAt:null,updatedAt:new Date().toISOString()}).where(and(eq(orders.id,claimed.id),eq(orders.creationState,"recovering")));}
    else{const released=await releaseOrderReservation(db,claimed.id,"released",true,{expectedStatus:claimed.status,releasePromotion:Boolean(claimed.promotionId),orderUpdates:{creationState:"recovering",status:"cancelled",internalNote:"Yarım kalan sipariş oluşturma işlemi otomatik olarak geri alındı."}});if(!released)return false;}
  }
  if(claimed.promotionId&&claimed.promotionClaimState==="active"){const released=await releasePromotionClaim(db,{orderId:claimed.id,promotionId:claimed.promotionId});if(!released){const[current]=await db.select({promotionClaimState:orders.promotionClaimState}).from(orders).where(eq(orders.id,claimed.id)).limit(1);if(current?.promotionClaimState!=="released")return false;}}
  await db.delete(orders).where(and(eq(orders.id,claimed.id),eq(orders.creationState,"recovering")));
  return true;
}
