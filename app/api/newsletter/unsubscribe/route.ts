import {eq} from "drizzle-orm";
import {getDb} from "../../../../db";
import {newsletterSubscribers} from "../../../../db/schema";
import {hashVerificationToken} from "../../../order-verification";
import {enforceRateLimit} from "../../../rate-limit";
import {isValidPublicToken,readBoundedJson} from "../../../public-form-security";
import {unsubscribeNewsletterSubscriber} from "../../../newsletter-subscription";

export const dynamic="force-dynamic";const noStore={"Cache-Control":"no-store"};
export async function POST(request:Request){const parsed=await readBoundedJson(request,2_000);if(parsed.error)return parsed.error;const token=parsed.body?.token;if(!isValidPublicToken(token))return Response.json({error:"Abonelik bağlantısı geçersiz."},{status:400,headers:noStore});const limited=await enforceRateLimit(request,{scope:"newsletter_unsubscribe",limit:20,windowMinutes:60});if(limited)return limited;const hash=await hashVerificationToken(token);const db=getDb();const[before]=await db.select({id:newsletterSubscribers.id}).from(newsletterSubscribers).where(eq(newsletterSubscribers.unsubscribeTokenHash,hash)).limit(1);if(!before)return Response.json({error:"Abonelik bağlantısı geçersiz."},{status:404,headers:noStore});const subscriber=await unsubscribeNewsletterSubscriber(db,{id:before.id,tokenHash:hash,now:new Date().toISOString()});return subscriber?Response.json({ok:true,market:subscriber.market},{headers:noStore}):Response.json({error:"Abonelik bağlantısı geçersiz."},{status:404,headers:noStore});}
