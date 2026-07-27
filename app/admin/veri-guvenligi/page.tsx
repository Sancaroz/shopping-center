import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs } from "../../../db/schema";
import { requireOwner } from "../../chatgpt-auth";
import DataSafetyCenter from "./data-safety-center";
import "../admin.css";
import "./data-safety-center.css";

export const dynamic = "force-dynamic";

export default async function DataSafetyPage() {
  await requireOwner("/admin/veri-guvenligi");
  const rows = await getDb().select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(300);
  const history = rows
    .filter((row) => row.entityType === "backup" || row.action === "data.retention_cleanup")
    .slice(0, 20)
    .map((row) => ({ id: row.id, action: row.action, summary: row.summary, actorName: row.actorName, createdAt: row.createdAt }));
  return <DataSafetyCenter initialHistory={history} />;
}
