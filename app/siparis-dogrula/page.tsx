import {eq} from "drizzle-orm";
import {getDb} from "../../db";
import {orders} from "../../db/schema";
import {releaseOrderReservation} from "../inventory-reservations";
import {hashVerificationToken} from "../order-verification";
import "./verification.css";

export const dynamic="force-dynamic";

async function verifyToken(token:string){
  let state:"invalid"|"expired"|"verified"="invalid";
  let orderNumber="";
  if(!/^[a-f0-9]{64}$/i.test(token))return{state,orderNumber};
  const hash=await hashVerificationToken(token);
  const db=getDb();
  const[order]=await db.select().from(orders).where(eq(orders.verificationTokenHash,hash)).limit(1);
  if(!order)return{state,orderNumber};
  orderNumber=order.orderNumber;
  const now=new Date();
  if(order.status==="cancelled"||!order.verificationExpiresAt||new Date(order.verificationExpiresAt)<now){
    await releaseOrderReservation(db,order.id,"expired");
    await db.update(orders).set({status:"cancelled",verificationTokenHash:"",verificationExpiresAt:null,updatedAt:now.toISOString()}).where(eq(orders.id,order.id));
    state="expired";
  }else{
    await db.update(orders).set({emailVerifiedAt:now.toISOString(),verificationTokenHash:"",verificationExpiresAt:null,updatedAt:now.toISOString()}).where(eq(orders.id,order.id));
    state="verified";
  }
  return{state,orderNumber};
}

export default async function VerifyOrderPage({searchParams}:{searchParams:Promise<{token?:string}>}){
  const{token=""}=await searchParams;
  const{state,orderNumber}=await verifyToken(token);
  const copy={verified:["E-posta adresiniz doğrulandı.",`${orderNumber} numaralı talebiniz ve stok rezervasyonunuz korunuyor.`],expired:["Doğrulama süresi doldu.","24 saatlik stok rezervasyonu serbest bırakıldı. Yeni bir sipariş talebi oluşturabilirsiniz."],invalid:["Bağlantı geçersiz.","Doğrulama bağlantısı eksik, değiştirilmiş veya daha önce kullanılmış olabilir."]}[state];
  return <main className="verification-page"><a href="/" className="verification-brand">MYSA <span>OBJETS</span></a><section><p>SİPARİŞ DOĞRULAMA</p><h1>{copy[0]}</h1><span>{copy[1]}</span><div><a href={orderNumber?`/siparis-takip?order=${encodeURIComponent(orderNumber)}`:"/magaza"}>{orderNumber?"Siparişi takip et":"Mağazaya dön"} →</a></div></section></main>;
}
