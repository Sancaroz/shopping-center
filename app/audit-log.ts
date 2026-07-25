import { getDb } from "../db";
import { auditLogs } from "../db/schema";
import type { ChatGPTUser } from "./chatgpt-auth";

function safeJson(value:unknown) {
  try{return JSON.stringify(value).slice(0,5000);}catch{return "{}";}
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
