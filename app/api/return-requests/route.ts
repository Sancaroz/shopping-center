import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { orders, returnRequests } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic="force-dynamic";

export async function GET() {
  if (!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const rows=await getDb().select({
    id:returnRequests.id,requestNumber:returnRequests.requestNumber,orderId:returnRequests.orderId,
    requestType:returnRequests.requestType,reason:returnRequests.reason,details:returnRequests.details,
    status:returnRequests.status,adminNote:returnRequests.adminNote,createdAt:returnRequests.createdAt,
    updatedAt:returnRequests.updatedAt,orderNumber:orders.orderNumber,customerName:orders.customerName,
    email:orders.email,orderStatus:orders.status,total:orders.total,market:orders.market,
  }).from(returnRequests).innerJoin(orders,eq(returnRequests.orderId,orders.id)).orderBy(desc(returnRequests.id)).limit(300);
  return Response.json({requests:rows});
}

export async function POST(request:Request) {
  const contentLength=Number(request.headers.get("content-length")??0);
  if(contentLength>12_000)return Response.json({error:"Gönderilen bilgiler çok uzun."},{status:413});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  if(!body)return Response.json({error:"Geçersiz talep."},{status:400});
  const orderNumber=String(body.orderNumber??"").trim().toUpperCase().slice(0,40);
  const email=String(body.email??"").trim().toLocaleLowerCase("en-US").slice(0,180);
  const requestType=String(body.requestType??"").trim();
  const reason=String(body.reason??"").trim().slice(0,120);
  const details=String(body.details??"").trim().slice(0,2000);
  if(!orderNumber||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!["cancellation","return","exchange"].includes(requestType)||!reason)return Response.json({error:"Zorunlu bilgileri eksiksiz girin."},{status:400});
  const db=getDb();
  const[order]=await db.select().from(orders).where(and(eq(orders.orderNumber,orderNumber),eq(orders.email,email))).limit(1);
  if(!order)return Response.json({error:"Sipariş bilgileri doğrulanamadı."},{status:404});
  if(requestType==="cancellation"&&["completed","cancelled"].includes(order.status))return Response.json({error:"Bu sipariş mevcut durumunda iptal talebine uygun değil."},{status:409});
  const existing=await db.select().from(returnRequests).where(and(eq(returnRequests.orderId,order.id),eq(returnRequests.requestType,requestType),inArray(returnRequests.status,["new","reviewing","approved"]))).limit(1);
  if(existing.length)return Response.json({error:"Bu sipariş için aynı türde açık bir talep zaten bulunuyor.",requestNumber:existing[0].requestNumber},{status:409});
  const requestNumber=`RT-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
  const[row]=await db.insert(returnRequests).values({requestNumber,orderId:order.id,requestType,reason,details}).returning();
  return Response.json({requestNumber:row.requestNumber,status:row.status},{status:201});
}

export async function PATCH(request:Request) {
  if (!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json() as {id?:number;status?:string;adminNote?:string};
  const id=Number(body.id);const status=String(body.status??"");
  if(!id||!["new","reviewing","approved","rejected","completed"].includes(status))return Response.json({error:"Geçersiz talep durumu."},{status:400});
  const[row]=await getDb().update(returnRequests).set({status,adminNote:String(body.adminNote??"").trim().slice(0,2000),updatedAt:new Date().toISOString()}).where(eq(returnRequests.id,id)).returning();
  if(!row)return Response.json({error:"Talep bulunamadı."},{status:404});
  return Response.json({request:row});
}
