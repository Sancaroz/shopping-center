import {and,desc,eq} from "drizzle-orm";
import {getDb} from "../../../db";
import {newsletterOutbox,notificationOutbox,orders} from "../../../db/schema";
import {recordAudit} from "../../audit-log";
import {getChatGPTUser} from "../../chatgpt-auth";
import {getIntegrationStatus} from "../../integrations/runtime";
import {canManageNotificationStatus} from "../../notification-lifecycle";
import {readBoundedJson} from "../../public-form-security";

export const dynamic="force-dynamic";const noStore={"Cache-Control":"no-store"};

export async function GET(){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401,headers:noStore});
  const db=getDb();const[orderRows,newsletterRows]=await Promise.all([
    db.select({id:notificationOutbox.id,orderId:notificationOutbox.orderId,eventType:notificationOutbox.eventType,recipient:notificationOutbox.recipient,subject:notificationOutbox.subject,body:notificationOutbox.body,status:notificationOutbox.status,attempts:notificationOutbox.attempts,nextAttemptAt:notificationOutbox.nextAttemptAt,lastError:notificationOutbox.lastError,sentAt:notificationOutbox.sentAt,createdAt:notificationOutbox.createdAt,orderNumber:orders.orderNumber}).from(notificationOutbox).innerJoin(orders,eq(notificationOutbox.orderId,orders.id)).orderBy(desc(notificationOutbox.id)).limit(300),
    user.role==="owner"?db.select({id:newsletterOutbox.id,eventType:newsletterOutbox.eventType,recipient:newsletterOutbox.recipient,subject:newsletterOutbox.subject,status:newsletterOutbox.status,attempts:newsletterOutbox.attempts,nextAttemptAt:newsletterOutbox.nextAttemptAt,lastError:newsletterOutbox.lastError,sentAt:newsletterOutbox.sentAt,createdAt:newsletterOutbox.createdAt}).from(newsletterOutbox).orderBy(desc(newsletterOutbox.id)).limit(300):Promise.resolve([]),
  ]);
  const notifications=[...orderRows.map(row=>({...row,source:"order"})),...newsletterRows.map(row=>({...row,source:"newsletter",orderId:null,orderNumber:"Bülten",body:"Doğrulama ve abonelikten çıkma bağlantıları güvenlik nedeniyle gizlendi."}))].sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,500);const integration=getIntegrationStatus();
  return Response.json({notifications,providerConnected:integration.email.adapterConnected,providerConfigured:integration.email.credentialsConfigured,emailMode:integration.email.mode},{headers:noStore});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401,headers:noStore});
  const parsed=await readBoundedJson(request,2_000);if(parsed.error)return parsed.error;const body=parsed.body!;const id=Number(body.id);const status=String(body.status??"");const source=body.source;
  if(!Number.isInteger(id)||id<1||!(["order","newsletter"] as unknown[]).includes(source)||!["draft","dismissed"].includes(status))return Response.json({error:"Geçersiz bildirim işlemi"},{status:400,headers:noStore});
  if(source==="newsletter"&&user.role!=="owner")return Response.json({error:"Bülten bildirimlerini yalnızca mağaza sahibi yönetebilir."},{status:403,headers:noStore});
  const db=getDb();const table=source==="newsletter"?newsletterOutbox:notificationOutbox;const[current]=await db.select().from(table).where(eq(table.id,id)).limit(1);
  if(!current)return Response.json({error:"Bildirim bulunamadı"},{status:404,headers:noStore});
  if(current.status==="cancelled")return Response.json({error:"Geçersiz doğrulama bağlantısı yeniden kuyruğa alınamaz."},{status:409,headers:noStore});
  if(!canManageNotificationStatus(current.status,status,current.attempts))return Response.json({error:current.status==="failed"&&current.attempts>=3?"Bildirim üç başarısız denemeden sonra otomatik yeniden kuyruğa alınamaz.":"Bildirim mevcut durumundan bu duruma geçirilemez."},{status:409,headers:noStore});
  const now=new Date().toISOString();const[row]=await db.update(table).set({status,deliveryClaimKey:"",deliveryClaimedAt:null,nextAttemptAt:null,...(status==="draft"?{lastError:""}:{}),updatedAt:now}).where(and(eq(table.id,id),eq(table.status,current.status),eq(table.updatedAt,current.updatedAt))).returning();
  if(!row)return Response.json({error:"Bildirim bu sırada başka bir işlem tarafından güncellendi. Güncel kuyruğu açıp tekrar deneyin."},{status:409,headers:noStore});
  await recordAudit({user,action:"notification.update",entityType:"notification",entityId:`${source}:${id}`,summary:`${source==="newsletter"?"Bülten":"Sipariş"} bildirimi ${status==="draft"?"kuyruğa geri alındı":"arşivlendi"}.`,before:{status:current.status,attempts:current.attempts},after:{status:row.status,attempts:row.attempts}});
  const notification=source==="newsletter"?{id:row.id,eventType:row.eventType,recipient:row.recipient,subject:row.subject,status:row.status,attempts:row.attempts,nextAttemptAt:row.nextAttemptAt,lastError:row.lastError,sentAt:row.sentAt,createdAt:row.createdAt,updatedAt:row.updatedAt,source:"newsletter",orderId:null,orderNumber:"Bülten",body:"Doğrulama ve abonelikten çıkma bağlantıları güvenlik nedeniyle gizlendi."}:row;
  return Response.json({notification},{headers:noStore});
}
