import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { notificationOutbox, orders } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic="force-dynamic";

export async function GET() {
  if (!(await getChatGPTUser())) return Response.json({error:"Yetkisiz erişim"},{status:401});
  const rows=await getDb().select({
    id:notificationOutbox.id,orderId:notificationOutbox.orderId,eventType:notificationOutbox.eventType,
    recipient:notificationOutbox.recipient,subject:notificationOutbox.subject,body:notificationOutbox.body,
    status:notificationOutbox.status,attempts:notificationOutbox.attempts,lastError:notificationOutbox.lastError,
    sentAt:notificationOutbox.sentAt,createdAt:notificationOutbox.createdAt,orderNumber:orders.orderNumber,
  }).from(notificationOutbox).innerJoin(orders,eq(notificationOutbox.orderId,orders.id)).orderBy(desc(notificationOutbox.id)).limit(200);
  return Response.json({notifications:rows,providerConnected:false});
}

export async function PATCH(request:Request) {
  if (!(await getChatGPTUser())) return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json() as {id?:number;status?:string};
  if(!body.id||!["draft","dismissed"].includes(String(body.status)))return Response.json({error:"Geçersiz bildirim işlemi"},{status:400});
  const[row]=await getDb().update(notificationOutbox).set({status:String(body.status),updatedAt:new Date().toISOString()}).where(eq(notificationOutbox.id,Number(body.id))).returning();
  if(!row)return Response.json({error:"Bildirim bulunamadı"},{status:404});
  return Response.json({notification:row});
}
