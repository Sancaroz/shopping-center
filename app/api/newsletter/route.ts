import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { newsletterSubscribers } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic="force-dynamic";

export async function GET(){if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});const subscribers=await getDb().select().from(newsletterSubscribers).orderBy(desc(newsletterSubscribers.id));return Response.json({subscribers});}

export async function POST(request:Request){const body=await request.json().catch(()=>({})) as Record<string,unknown>;const email=String(body.email??"").trim().toLocaleLowerCase("en-US").slice(0,180);const market=body.market==="GLOBAL"?"GLOBAL":"TR";if(!email.includes("@"))return Response.json({error:"Geçerli bir e-posta adresi girin."},{status:400});const now=new Date().toISOString();await getDb().insert(newsletterSubscribers).values({email,market,status:"active",consentAt:now,updatedAt:now}).onConflictDoUpdate({target:newsletterSubscribers.email,set:{market,status:"active",consentAt:now,updatedAt:now}});return Response.json({ok:true},{status:201});}

export async function PATCH(request:Request){if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});const body=await request.json() as{id?:number;status?:string};const id=Number(body.id);const status=String(body.status);if(!id||!["active","unsubscribed"].includes(status))return Response.json({error:"Geçersiz abone durumu"},{status:400});const[subscriber]=await getDb().update(newsletterSubscribers).set({status,updatedAt:new Date().toISOString()}).where(eq(newsletterSubscribers.id,id)).returning();return subscriber?Response.json({subscriber}):Response.json({error:"Abone bulunamadı"},{status:404});}
