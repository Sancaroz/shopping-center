import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs } from "../../../db/schema";
import { getChatGPTOwner } from "../../chatgpt-auth";

export const dynamic="force-dynamic";

export async function GET() {
  if (!(await getChatGPTOwner()))return Response.json({error:"İşlem geçmişi yalnızca mağaza sahibine açıktır."},{status:403});
  const rows=await getDb().select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(500);
  return Response.json({logs:rows});
}
