import {and,eq,exists,gte,sql} from "drizzle-orm";
import {getDb} from "../db";
import {orders,promotionRedemptions,promotions} from "../db/schema";

type Database=ReturnType<typeof getDb>;

export async function evaluatePromotion(db:Database,input:{code:string;market:"TR"|"GLOBAL";subtotal:number}){
  const code=input.code.trim().toUpperCase();if(!code)return{ok:true as const,promotion:null,discountAmount:0};
  const[promotion]=await db.select().from(promotions).where(eq(promotions.code,code)).limit(1);const invalid={ok:false as const,error:"İndirim kodu geçersiz veya kullanıma kapalı."};
  if(!promotion||!promotion.active)return invalid;
  const now=Date.now();if((promotion.startsAt&&new Date(promotion.startsAt).getTime()>now)||(promotion.endsAt&&new Date(promotion.endsAt).getTime()<now))return invalid;
  if(promotion.market!=="BOTH"&&promotion.market!==input.market)return{ok:false as const,error:"İndirim kodu bu mağazada geçerli değil."};
  if(promotion.usageLimit>0&&promotion.usedCount>=promotion.usageLimit)return{ok:false as const,error:"İndirim kodunun kullanım sınırı doldu."};
  if(input.subtotal<promotion.minSubtotal)return{ok:false as const,error:`Bu kod için sepet tutarı en az ${promotion.minSubtotal} olmalıdır.`};
  const raw=promotion.discountType==="percentage"?input.subtotal*promotion.discountValue/100:promotion.discountValue;const capped=promotion.maxDiscount>0?Math.min(raw,promotion.maxDiscount):raw;const discountAmount=Math.round(Math.min(Math.max(capped,0),input.subtotal)*100)/100;
  if(discountAmount<=0)return invalid;
  return{ok:true as const,promotion,discountAmount};
}

export async function hashPromotionEmail(email:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(email.trim().toLocaleLowerCase("en-US")));return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");}

export async function releasePromotionClaim(db:Database,input:{orderId:number;promotionId:number}){
  const activeOrderClaim=exists(db.select({id:orders.id}).from(orders).where(and(eq(orders.id,input.orderId),eq(orders.promotionId,input.promotionId),eq(orders.promotionClaimState,"active"))));
  const decrement=db.update(promotions).set({usedCount:sql`${promotions.usedCount}-1`,updatedAt:new Date().toISOString()}).where(and(eq(promotions.id,input.promotionId),gte(promotions.usedCount,1),activeOrderClaim));
  const results=await db.batch([decrement,db.delete(promotionRedemptions).where(and(eq(promotionRedemptions.orderId,input.orderId),eq(promotionRedemptions.promotionId,input.promotionId))),db.update(orders).set({promotionClaimState:"released",updatedAt:new Date().toISOString()}).where(and(eq(orders.id,input.orderId),eq(orders.promotionId,input.promotionId),eq(orders.promotionClaimState,"active"))).returning({id:orders.id})]);const released=results.at(-1);return Array.isArray(released)&&released.length>0;
}
