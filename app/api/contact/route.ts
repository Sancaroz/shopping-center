import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { contactMessages } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" }, { status:401 });
  const messages=await getDb().select().from(contactMessages).orderBy(desc(contactMessages.id));
  return Response.json({ messages });
}

export async function POST(request:Request) {
  const body=await request.json().catch(()=>({})) as Record<string,unknown>;
  if(String(body.company??"").trim()) return Response.json({ ok:true }, { status:201 });
  const name=String(body.name??"").trim().slice(0,120);
  const email=String(body.email??"").trim().toLocaleLowerCase("en-US").slice(0,180);
  const subject=String(body.subject??"").trim().slice(0,160);
  const message=String(body.message??"").trim().slice(0,4000);
  const orderNumber=String(body.orderNumber??"").trim().toUpperCase().slice(0,40);
  if(!name||!email.includes("@")||!subject||message.length<10)return Response.json({error:"Lütfen zorunlu alanları eksiksiz doldurun."},{status:400});
  await getDb().insert(contactMessages).values({name,email,subject,message,orderNumber});
  return Response.json({ok:true},{status:201});
}

export async function PATCH(request:Request) {
  if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" }, { status:401 });
  const body=await request.json() as {id?:number;status?:string};const id=Number(body.id);const status=String(body.status);
  if(!id||!["new","read","resolved"].includes(status))return Response.json({error:"Geçersiz mesaj durumu"},{status:400});
  const[message]=await getDb().update(contactMessages).set({status,updatedAt:new Date().toISOString()}).where(eq(contactMessages.id,id)).returning();
  return message?Response.json({message}):Response.json({error:"Mesaj bulunamadı"},{status:404});
}
