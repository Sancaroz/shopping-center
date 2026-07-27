import { getDb } from "../../../db";
import { storeSettings } from "../../../db/schema";
import { recordAudit } from "../../audit-log";
import { getChatGPTUser } from "../../chatgpt-auth";
import { readBoundedJson } from "../../public-form-security";

export const dynamic = "force-dynamic";

async function saveSetting(key:string,value:string) {
  await getDb().insert(storeSettings).values({key,value,updatedAt:new Date().toISOString()})
    .onConflictDoUpdate({target:storeSettings.key,set:{value,updatedAt:new Date().toISOString()}});
}

export async function PATCH(request:Request) {
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const parsed=await readBoundedJson(request,2_000);if(parsed.error)return parsed.error;const action=parsed.body?.action;
  if(!["pause_intake","resume_intake","safe_mode"].includes(String(action)))return Response.json({error:"Geçersiz operasyon işlemi"},{status:400});
  if(action==="pause_intake"){
    await saveSetting("orderIntakeStatus","paused");
    await recordAudit({user,action:"launch.intake.pause",entityType:"launch_operations",summary:"Sipariş talebi alımı acil durum anahtarıyla durduruldu.",after:{orderIntakeStatus:"paused"}});
    return Response.json({message:"Sipariş talebi alımı durduruldu.",orderIntakeStatus:"paused"});
  }
  if(action==="resume_intake"){
    await saveSetting("orderIntakeStatus","open");
    await recordAudit({user,action:"launch.intake.resume",entityType:"launch_operations",summary:"Sipariş talebi alımı yeniden açıldı.",after:{orderIntakeStatus:"open"}});
    return Response.json({message:"Sipariş talebi alımı yeniden açıldı.",orderIntakeStatus:"open"});
  }
  await saveSetting("salesMode","order_request");
  await recordAudit({user,action:"launch.safe_mode",entityType:"launch_operations",summary:"Mağaza güvenli sipariş-talebi moduna alındı.",after:{salesMode:"order_request"}});
  return Response.json({message:"Güvenli sipariş-talebi modu etkinleştirildi.",salesMode:"order_request"});
}
