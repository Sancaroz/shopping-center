import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic="force-dynamic";

export async function GET() {
  if (!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const rows=await getDb().select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(500);
  return Response.json({logs:rows});
}
