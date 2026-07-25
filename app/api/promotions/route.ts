import {desc,eq} from "drizzle-orm";
import {getDb} from "../../../db";
import {promotions} from "../../../db/schema";
import {recordAudit} from "../../audit-log";
import {getChatGPTUser} from "../../chatgpt-auth";

export async function GET(){if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});return Response.json({promotions:await getDb().select().from(promotions).orderBy(desc(promotions.id))},{headers:{"Cache-Control":"no-store"}});}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});const body=await request.json().catch(()=>null) as Record<string,unknown>|null;
  const code=String(body?.code??"").trim().toUpperCase();const name=String(body?.name??"").trim().slice(0,160);const market=String(body?.market??"");const discountType=String(body?.discountType??"");const discountValue=Number(body?.discountValue);const maxDiscount=Number(body?.maxDiscount??0);const minSubtotal=Number(body?.minSubtotal??0);const usageLimit=Number(body?.usageLimit??0);const startsAt=String(body?.startsAt??"").trim()||null;const endsAt=String(body?.endsAt??"").trim()||null;
  if(!/^[A-Z0-9_-]{3,40}$/.test(code)||!name||!["TR","GLOBAL","BOTH"].includes(market)||!["percentage","fixed"].includes(discountType))return Response.json({error:"Kampanya adı, kodu, pazarı ve indirim türü geçerli olmalıdır."},{status:400});
  if(!Number.isFinite(discountValue)||discountValue<=0||(discountType==="percentage"&&discountValue>100)||!Number.isFinite(maxDiscount)||maxDiscount<0||!Number.isFinite(minSubtotal)||minSubtotal<0||!Number.isInteger(usageLimit)||usageLimit<0)return Response.json({error:"İndirim ve kullanım sınırı değerlerini kontrol edin."},{status:400});
  if((startsAt&&Number.isNaN(new Date(startsAt).getTime()))||(endsAt&&Number.isNaN(new Date(endsAt).getTime()))||(startsAt&&endsAt&&new Date(startsAt)>=new Date(endsAt)))return Response.json({error:"Kampanya tarih aralığı geçersiz."},{status:400});
  try{const[promotion]=await getDb().insert(promotions).values({code,name,market,discountType,discountValue,maxDiscount,minSubtotal,usageLimit,startsAt,endsAt,active:false}).returning();await recordAudit({user,action:"promotion.create",entityType:"promotion",entityId:promotion.id,summary:`${code} kampanyası pasif olarak oluşturuldu.`,after:{code,market,discountType,discountValue,active:false}});return Response.json({promotion},{status:201});}catch{return Response.json({error:"Bu indirim kodu daha önce kullanılmış."},{status:409});}
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});const body=await request.json().catch(()=>null) as {id?:number;active?:boolean}|null;const id=Number(body?.id);if(!id||typeof body?.active!=="boolean")return Response.json({error:"Geçersiz kampanya işlemi."},{status:400});
  const db=getDb();const[before]=await db.select().from(promotions).where(eq(promotions.id,id)).limit(1);if(!before)return Response.json({error:"Kampanya bulunamadı."},{status:404});if(body.active&&before.endsAt&&new Date(before.endsAt)<new Date())return Response.json({error:"Süresi dolmuş kampanya etkinleştirilemez."},{status:409});
  const[promotion]=await db.update(promotions).set({active:body.active,updatedAt:new Date().toISOString()}).where(eq(promotions.id,id)).returning();await recordAudit({user,action:body.active?"promotion.activate":"promotion.deactivate",entityType:"promotion",entityId:id,summary:`${promotion.code} kampanyası ${body.active?"etkinleştirildi":"durduruldu"}.`,before:{active:before.active},after:{active:promotion.active}});return Response.json({promotion});
}
