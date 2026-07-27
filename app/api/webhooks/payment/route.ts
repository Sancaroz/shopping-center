import {eq} from "drizzle-orm";
import {getDb} from "../../../../db";
import {paymentWebhookReceipts} from "../../../../db/schema";
import {getIntegrationStatus,getPaymentWebhookSecret} from "../../../integrations/runtime";
import {verifyWebhookSignature} from "../../../integrations/webhook-signature";

export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
const MAX_WEBHOOK_BYTES=100_000;

async function readBoundedBody(request:Request){
  const declared=Number(request.headers.get("content-length")??0);if(Number.isFinite(declared)&&declared>MAX_WEBHOOK_BYTES)return null;
  if(!request.body)return new Uint8Array();const reader=request.body.getReader();const chunks:Uint8Array[]=[];let total=0;
  while(true){const{done,value}=await reader.read();if(done)break;if(value){total+=value.byteLength;if(total>MAX_WEBHOOK_BYTES){await reader.cancel();return null;}chunks.push(value);}}
  const body=new Uint8Array(total);let offset=0;for(const chunk of chunks){body.set(chunk,offset);offset+=chunk.byteLength;}return body;
}

async function sha256(value:Uint8Array){const digest=await crypto.subtle.digest("SHA-256",value as BufferSource);return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");}

export async function POST(request:Request){
  const integration=getIntegrationStatus();const secret=getPaymentWebhookSecret();
  if(!integration.payment.credentialsConfigured||!secret)return Response.json({error:"Ödeme webhook bağlantısı etkin değil."},{status:503,headers:noStore});
  if(!String(request.headers.get("content-type")??"").toLocaleLowerCase("en-US").startsWith("application/json"))return Response.json({error:"Webhook içeriği JSON olmalıdır."},{status:415,headers:noStore});
  const eventId=String(request.headers.get("x-mysa-event-id")??"").trim();const eventType=String(request.headers.get("x-mysa-event-type")??"").trim();
  if(!/^[A-Za-z0-9._:-]{8,160}$/.test(eventId)||!/^[A-Za-z0-9._:-]{3,80}$/.test(eventType))return Response.json({error:"Webhook olay kimliği veya türü geçersiz."},{status:400,headers:noStore});
  const bodyBytes=await readBoundedBody(request);if(!bodyBytes)return Response.json({error:"Webhook içeriği çok büyük."},{status:413,headers:noStore});
  let rawBody="";try{rawBody=new TextDecoder("utf-8",{fatal:true}).decode(bodyBytes);const payload=JSON.parse(rawBody);if(!payload||typeof payload!=="object"||Array.isArray(payload))throw new Error("invalid payload");}catch{return Response.json({error:"Webhook içeriği geçerli bir JSON nesnesi olmalıdır."},{status:400,headers:noStore});}
  const timestamp=String(request.headers.get("x-mysa-timestamp")??"");const verification=await verifyWebhookSignature({rawBody,eventId,eventType,signature:request.headers.get("x-mysa-signature")??"",timestamp,secret});
  if(!verification.valid)return Response.json({error:"Webhook imzası doğrulanamadı."},{status:401,headers:noStore});
  const provider=integration.payment.provider.trim().toLocaleLowerCase("en-US");const eventKey=`${provider}:${eventId}`;const payloadHash=await sha256(bodyBytes);const db=getDb();
  const[receipt]=await db.insert(paymentWebhookReceipts).values({eventKey,provider:integration.payment.provider,mode:integration.payment.mode,eventType,payloadHash,payloadBytes:bodyBytes.byteLength,signatureTimestamp:Number(timestamp),status:"awaiting_adapter"}).onConflictDoNothing().returning();
  if(!receipt){const[existing]=await db.select().from(paymentWebhookReceipts).where(eq(paymentWebhookReceipts.eventKey,eventKey)).limit(1);if(!existing||existing.payloadHash!==payloadHash||existing.eventType!==eventType)return Response.json({error:"Aynı olay kimliği farklı içerikle tekrar kullanılamaz."},{status:409,headers:noStore});return Response.json({accepted:true,processed:false,duplicate:true,message:"Olay daha önce güvenli biçimde kaydedildi; sipariş durumu değiştirilmedi."},{status:200,headers:noStore});}
  return Response.json({accepted:true,processed:false,duplicate:false,message:"İmza doğrulandı ve olay güvenli biçimde kaydedildi; sağlayıcı adaptörü etkinleşene kadar sipariş durumu değiştirilmedi."},{status:202,headers:noStore});
}
