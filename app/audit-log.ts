import { getDb } from "../db";
import { auditLogs } from "../db/schema";
import type { ChatGPTUser } from "./chatgpt-auth";

function safeJson(value:unknown) {
  try {
    const compact=JSON.stringify(value,(_key,item)=>typeof item==="string"&&item.length>1000?`${item.slice(0,1000)}…`:item);
    if(compact.length<=5000)return compact;
    const keys=value&&typeof value==="object"&&!Array.isArray(value)?Object.keys(value).slice(0,100):[];
    return JSON.stringify({_truncated:true,keys,message:"Kayıt boyutu sınırı nedeniyle alan özeti saklandı."});
  } catch {
    return "{}";
  }
}

export async function recordAudit(input:{
  user:ChatGPTUser; action:string; entityType:string; entityId?:string|number;
  summary:string; before?:unknown; after?:unknown;
}) {
  await getDb().insert(auditLogs).values({
    actorEmail:input.user.email,
    actorName:input.user.displayName,
    action:input.action,
    entityType:input.entityType,
    entityId:String(input.entityId??""),
    summary:input.summary.slice(0,500),
    beforeJson:safeJson(input.before??{}),
    afterJson:safeJson(input.after??{}),
  });
}
