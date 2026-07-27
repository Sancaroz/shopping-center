import { sql } from "drizzle-orm";
import { getDb } from "../db";
import { requestThrottles } from "../db/schema";

type Options={scope:string;identifier?:string;limit:number;windowMinutes:number};

async function sha256(value:string) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,"0")).join("");
}

function requestIp(request:Request) {
  return request.headers.get("cf-connecting-ip")?.trim()||
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()||
    request.headers.get("x-real-ip")?.trim()||"";
}

async function consume(scope:string,rawKey:string,limit:number,windowMinutes:number) {
  const db=getDb();const keyHash=await sha256(`${scope}|${rawKey}`);
  const now=new Date();const windowMs=windowMinutes*60_000;
  const nowIso=now.toISOString();const cutoffIso=new Date(now.getTime()-windowMs).toISOString();
  const[counter]=await db.insert(requestThrottles).values({keyHash,scope,requestCount:1,windowStartedAt:nowIso,updatedAt:nowIso}).onConflictDoUpdate({
    target:requestThrottles.keyHash,
    set:{
      scope,
      requestCount:sql`CASE WHEN ${requestThrottles.windowStartedAt} <= ${cutoffIso} THEN 1 WHEN ${requestThrottles.requestCount} <= ${limit} THEN ${requestThrottles.requestCount} + 1 ELSE ${requestThrottles.requestCount} END`,
      windowStartedAt:sql`CASE WHEN ${requestThrottles.windowStartedAt} <= ${cutoffIso} THEN ${nowIso} ELSE ${requestThrottles.windowStartedAt} END`,
      updatedAt:nowIso,
    },
  }).returning({requestCount:requestThrottles.requestCount,windowStartedAt:requestThrottles.windowStartedAt});
  if(!counter||counter.requestCount<=limit)return null;
  return Math.max(1,Math.ceil((windowMs-(now.getTime()-new Date(counter.windowStartedAt).getTime()))/1000));
}

export async function enforceRateLimit(request:Request,options:Options) {
  const keys=[requestIp(request)&&`ip:${requestIp(request)}`,options.identifier?.trim().toLocaleLowerCase("en-US")&&`id:${options.identifier.trim().toLocaleLowerCase("en-US")}`].filter(Boolean) as string[];
  for(const key of keys.length?keys:["anonymous"]){
    const retryAfter=await consume(options.scope,key,options.limit,options.windowMinutes);
    if(retryAfter)return Response.json({error:"Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin."},{status:429,headers:{"Retry-After":String(retryAfter),"Cache-Control":"no-store"}});
  }
  return null;
}
