import {and,eq,gt} from "drizzle-orm";
import {getDb} from "../../../../db";
import {newsletterSubscribers} from "../../../../db/schema";
import {hashVerificationToken} from "../../../order-verification";
import {enforceRateLimit} from "../../../rate-limit";
import {isValidPublicToken,readBoundedJson} from "../../../public-form-security";

export const dynamic="force-dynamic";const noStore={"Cache-Control":"no-store"};
export async function POST(request:Request){const parsed=await readBoundedJson(request,2_000);if(parsed.error)return parsed.error;const token=parsed.body?.token;if(!isValidPublicToken(token))return Response.json({error:"Doğrulama bağlantısı geçersiz."},{status:400,headers:noStore});const limited=await enforceRateLimit(request,{scope:"newsletter_verify",limit:20,windowMinutes:60});if(limited)return limited;const hash=await hashVerificationToken(token);const db=getDb();const now=new Date().toISOString();const[subscriber]=await db.update(newsletterSubscribers).set({status:"active",verifiedAt:now,verificationTokenHash:"",verificationExpiresAt:null,updatedAt:now}).where(and(eq(newsletterSubscribers.verificationTokenHash,hash),gt(newsletterSubscribers.verificationExpiresAt,now))).returning();return subscriber?Response.json({ok:true,market:subscriber.market},{headers:noStore}):Response.json({error:"Doğrulama bağlantısı geçersiz veya süresi dolmuş."},{status:410,headers:noStore});}
