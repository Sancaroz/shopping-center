import { and, desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { contactMessages, orders } from "../../../db/schema";
import { recordAudit } from "../../audit-log";
import { getChatGPTUser } from "../../chatgpt-auth";
import { enforceRateLimit } from "../../rate-limit";
import { containsLikelyCardNumber, isValidEmail, normalizeEmail, readBoundedJson } from "../../public-form-security";
import { canTransitionSupportStatus, isTerminalSupportStatus } from "../../support-lifecycle";

export const dynamic = "force-dynamic";
const noStore={"Cache-Control":"no-store"};

export async function GET() {
  if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" }, { status:401 });
  const messages=await getDb().select().from(contactMessages).orderBy(desc(contactMessages.id));
  return Response.json({ messages },{headers:noStore});
}

export async function POST(request:Request) {
  const parsed=await readBoundedJson(request);if(parsed.error)return parsed.error;const body=parsed.body!;
  if(String(body.company??"").trim()) return Response.json({ ok:true }, { status:201,headers:noStore });
  const name=String(body.name??"").trim().slice(0,120);
  const email=normalizeEmail(body.email);
  const subject=String(body.subject??"").trim().slice(0,160);
  const message=String(body.message??"").trim().slice(0,4000);
  const orderNumber=String(body.orderNumber??"").trim().toUpperCase().slice(0,40);
  if(name.length<2||!isValidEmail(email)||!subject||message.length<10||body.privacyAcknowledged!==true)return Response.json({error:"Zorunlu alanları ve gizlilik onayını eksiksiz doldurun."},{status:400,headers:noStore});
  if(containsLikelyCardNumber(message))return Response.json({error:"Güvenliğiniz için mesajınıza kart numarası yazmayın."},{status:400,headers:noStore});
  const limited=await enforceRateLimit(request,{scope:"contact",identifier:email,limit:5,windowMinutes:60});if(limited)return limited;
  const db=getDb();const[matchedOrder]=orderNumber?await db.select({id:orders.id}).from(orders).where(and(eq(orders.orderNumber,orderNumber),eq(orders.email,email))).limit(1):[];
  await db.insert(contactMessages).values({name,email,subject,message,orderNumber,orderId:matchedOrder?.id??null,privacyAcknowledgedAt:new Date().toISOString()});
  return Response.json({ok:true},{status:201,headers:noStore});
}

export async function PATCH(request:Request) {
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const parsed=await readBoundedJson(request,8_000);if(parsed.error)return parsed.error;const body=parsed.body!;const id=Number(body.id);const status=String(body.status??"");const priorityInput=body.priority===undefined?"":String(body.priority);if(!Number.isInteger(id)||id<1||(priorityInput&&!['low','normal','high','urgent'].includes(priorityInput)))return Response.json({error:"Geçersiz destek kaydı"},{status:400});const db=getDb();const[before]=await db.select().from(contactMessages).where(eq(contactMessages.id,id)).limit(1);if(!before)return Response.json({error:"Mesaj bulunamadı"},{status:404});if(isTerminalSupportStatus(before.status))return Response.json({error:"Çözülen destek kaydı yeniden değiştirilemez."},{status:409});if(!canTransitionSupportStatus(before.status,status))return Response.json({error:"Destek kaydı mevcut durumundan seçilen duruma geçirilemez."},{status:409});const now=new Date().toISOString();const priority=priorityInput||before.priority;const assignedTo=body.assignedTo===undefined?before.assignedTo:String(body.assignedTo).trim();const adminNote=body.adminNote===undefined?before.adminNote:String(body.adminNote).trim();if(assignedTo.length>180||adminNote.length>2000)return Response.json({error:"Destek kaydı yönetim alanlarından biri izin verilen uzunluğu aşıyor."},{status:400});if(containsLikelyCardNumber(adminNote))return Response.json({error:"İç destek notuna kart numarası veya benzeri hassas ödeme verisi yazmayın."},{status:400});if(status==="resolved"&&adminNote.length<10)return Response.json({error:"Destek kaydı çözülürken en az 10 karakterlik çözüm notu zorunludur."},{status:409});const[message]=await db.update(contactMessages).set({status,priority,assignedTo,adminNote,resolvedAt:status==="resolved"?(before.resolvedAt??now):null,updatedAt:now}).where(eq(contactMessages.id,id)).returning();await recordAudit({user,action:"support.update",entityType:"contact_message",entityId:id,summary:`${before.subject} destek kaydı güncellendi.`,before:{status:before.status,priority:before.priority,assignedTo:before.assignedTo},after:{status,priority,assignedTo,resolvedAt:message.resolvedAt}});return Response.json({message},{headers:noStore});
}
