import {and,eq,gt} from "drizzle-orm";
import {getDb} from "../../../../db";
import {newsletterSubscribers} from "../../../../db/schema";
import {hashVerificationToken} from "../../../order-verification";

export const dynamic="force-dynamic";const noStore={"Cache-Control":"no-store"};
export async function POST(request:Request){const body=await request.json().catch(()=>({})) as Record<string,unknown>;const token=String(body.token??"");if(!token)return Response.json({error:"Doğrulama bağlantısı geçersiz."},{status:400,headers:noStore});const hash=await hashVerificationToken(token);const db=getDb();const now=new Date().toISOString();const[subscriber]=await db.update(newsletterSubscribers).set({status:"active",verifiedAt:now,verificationTokenHash:"",verificationExpiresAt:null,updatedAt:now}).where(and(eq(newsletterSubscribers.verificationTokenHash,hash),gt(newsletterSubscribers.verificationExpiresAt,now))).returning();return subscriber?Response.json({ok:true,market:subscriber.market},{headers:noStore}):Response.json({error:"Doğrulama bağlantısı geçersiz veya süresi dolmuş."},{status:410,headers:noStore});}
