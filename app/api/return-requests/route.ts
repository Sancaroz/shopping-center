import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { orders, returnRequests } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { recordAudit } from "../../audit-log";
import { enforceRateLimit } from "../../rate-limit";
import { containsLikelyCardNumber, isValidEmail, isValidOrderNumber, isValidRequestKey, normalizeEmail, readBoundedJson } from "../../public-form-security";

export const dynamic="force-dynamic";

export async function GET() {
  if (!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const rows=await getDb().select({
    id:returnRequests.id,requestNumber:returnRequests.requestNumber,orderId:returnRequests.orderId,
    requestType:returnRequests.requestType,reason:returnRequests.reason,details:returnRequests.details,
    privacyAcknowledgedAt:returnRequests.privacyAcknowledgedAt,
    status:returnRequests.status,adminNote:returnRequests.adminNote,createdAt:returnRequests.createdAt,
    updatedAt:returnRequests.updatedAt,orderNumber:orders.orderNumber,customerName:orders.customerName,
    email:orders.email,orderStatus:orders.status,total:orders.total,market:orders.market,
  }).from(returnRequests).innerJoin(orders,eq(returnRequests.orderId,orders.id)).orderBy(desc(returnRequests.id)).limit(300);
  return Response.json({requests:rows});
}

export async function POST(request:Request) {
  const parsed=await readBoundedJson(request,12_000);if(parsed.error)return parsed.error;const body=parsed.body!;
  if(String(body.company??"").trim())return Response.json({ok:true},{status:201,headers:{"Cache-Control":"no-store"}});
  const orderNumber=String(body.orderNumber??"").trim().toUpperCase().slice(0,40);
  const email=normalizeEmail(body.email);
  const requestKey=String(body.requestKey??"");
  const requestType=String(body.requestType??"").trim();
  const reason=String(body.reason??"").trim().slice(0,120);
  const details=String(body.details??"").trim().slice(0,2000);
  if(!isValidOrderNumber(orderNumber)||!isValidEmail(email)||!isValidRequestKey(requestKey)||!["cancellation","return","exchange"].includes(requestType)||!reason||body.privacyAcknowledged!==true)return Response.json({error:"Zorunlu bilgileri ve gizlilik onayını eksiksiz girin."},{status:400});
  if(containsLikelyCardNumber(details))return Response.json({error:"Güvenliğiniz için açıklamaya kart numarası yazmayın."},{status:400});
  const limited=await enforceRateLimit(request,{scope:"return_request",identifier:email,limit:5,windowMinutes:60});if(limited)return limited;
  const db=getDb();
  const[duplicate]=await db.select().from(returnRequests).where(eq(returnRequests.requestKey,requestKey)).limit(1);
  if(duplicate)return Response.json({requestNumber:duplicate.requestNumber,status:duplicate.status},{status:200});
  const[order]=await db.select().from(orders).where(and(eq(orders.orderNumber,orderNumber),eq(orders.email,email))).limit(1);
  if(!order)return Response.json({error:"Sipariş bilgileri doğrulanamadı."},{status:404});
  if(requestType==="cancellation"&&["completed","cancelled"].includes(order.status))return Response.json({error:"Bu sipariş mevcut durumunda iptal talebine uygun değil."},{status:409});
  const existing=await db.select().from(returnRequests).where(and(eq(returnRequests.orderId,order.id),eq(returnRequests.requestType,requestType),inArray(returnRequests.status,["new","reviewing","approved"]))).limit(1);
  if(existing.length)return Response.json({error:"Bu sipariş için aynı türde açık bir talep zaten bulunuyor.",requestNumber:existing[0].requestNumber},{status:409});
  const requestNumber=`RT-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
  const[row]=await db.insert(returnRequests).values({requestKey,requestNumber,orderId:order.id,requestType,reason,details,privacyAcknowledgedAt:new Date().toISOString()}).onConflictDoNothing({target:returnRequests.requestKey}).returning();
  if(!row){const[retry]=await db.select().from(returnRequests).where(eq(returnRequests.requestKey,requestKey)).limit(1);if(retry)return Response.json({requestNumber:retry.requestNumber,status:retry.status},{status:200});return Response.json({error:"Talep kaydedilemedi."},{status:409});}
  return Response.json({requestNumber:row.requestNumber,status:row.status},{status:201});
}

export async function PATCH(request:Request) {
  const user=await getChatGPTUser();
  if (!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json() as {id?:number;status?:string;adminNote?:string};
  const id=Number(body.id);const status=String(body.status??"");
  if(!id||!["new","reviewing","approved","rejected","completed"].includes(status))return Response.json({error:"Geçersiz talep durumu."},{status:400});
  const db=getDb();const[existing]=await db.select().from(returnRequests).where(eq(returnRequests.id,id)).limit(1);
  if(!existing)return Response.json({error:"Talep bulunamadı."},{status:404});
  const[row]=await db.update(returnRequests).set({status,adminNote:String(body.adminNote??"").trim().slice(0,2000),updatedAt:new Date().toISOString()}).where(eq(returnRequests.id,id)).returning();
  if(!row)return Response.json({error:"Talep bulunamadı."},{status:404});
  await recordAudit({user,action:"return_request.update",entityType:"return_request",entityId:row.id,summary:`${row.requestNumber} talebi ${status} durumuna alındı.`,before:{status:existing.status,adminNote:existing.adminNote},after:{status:row.status,adminNote:row.adminNote}});
  return Response.json({request:row});
}
