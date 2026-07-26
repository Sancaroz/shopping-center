import {eq} from "drizzle-orm";
import {getDb} from "../../../../db";
import {newsletterSubscribers} from "../../../../db/schema";
import {hashVerificationToken} from "../../../order-verification";

export const dynamic="force-dynamic";const noStore={"Cache-Control":"no-store"};
export async function POST(request:Request){const body=await request.json().catch(()=>({})) as Record<string,unknown>;const token=String(body.token??"");if(!token)return Response.json({error:"Abonelik bağlantısı geçersiz."},{status:400,headers:noStore});const hash=await hashVerificationToken(token);const now=new Date().toISOString();const[subscriber]=await getDb().update(newsletterSubscribers).set({status:"unsubscribed",unsubscribedAt:now,verificationTokenHash:"",verificationExpiresAt:null,updatedAt:now}).where(eq(newsletterSubscribers.unsubscribeTokenHash,hash)).returning();return subscriber?Response.json({ok:true,market:subscriber.market},{headers:noStore}):Response.json({error:"Abonelik bağlantısı geçersiz."},{status:404,headers:noStore});}
