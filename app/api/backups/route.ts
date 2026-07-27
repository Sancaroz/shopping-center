import { desc, lt } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs, carts, requestThrottles } from "../../../db/schema";
import { recordAudit } from "../../audit-log";
import { verifyBackupEnvelope } from "../../backup-format";
import { getChatGPTOwner } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const MAX_BACKUP_BYTES = 10 * 1024 * 1024;

export async function GET() {
  if (!(await getChatGPTOwner())) return Response.json({ error: "Yedekleme yalnızca mağaza sahibine açıktır." }, { status: 403 });
  const rows = await getDb().select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(300);
  const history = rows
    .filter((row) => row.entityType === "backup" || row.action === "data.retention_cleanup")
    .slice(0, 20)
    .map((row) => ({ id: row.id, action: row.action, summary: row.summary, actorName: row.actorName, createdAt: row.createdAt }));
  return Response.json({ history, retention: { requestThrottleHours: 48, abandonedCartDays: 35 } });
}

export async function POST(request: Request) {
  const user = await getChatGPTOwner();
  if (!user) return Response.json({ error: "Yedekleme yalnızca mağaza sahibine açıktır." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > MAX_BACKUP_BYTES) return Response.json({ error: "Yedek dosyası 10 MB sınırını aşıyor." }, { status: 413 });
  const raw = await request.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES) return Response.json({ error: "Yedek dosyası 10 MB sınırını aşıyor." }, { status: 413 });
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return Response.json({ error: "Dosya geçerli JSON içermiyor." }, { status: 400 });
  }
  const report = await verifyBackupEnvelope(parsed);
  await recordAudit({
    user,
    action: "backup.verify",
    entityType: "backup",
    summary: report.valid ? "Yedek geri yükleme provası başarıyla tamamlandı." : "Yedek geri yükleme provasında sorun bulundu.",
    after: { valid: report.valid, counts: report.counts, errors: report.errors },
  });
  return Response.json(report, { status: report.valid ? 200 : 422, headers: { "Cache-Control": "no-store" } });
}

export async function DELETE() {
  const user = await getChatGPTOwner();
  if (!user) return Response.json({ error: "Yedekleme yalnızca mağaza sahibine açıktır." }, { status: 403 });
  const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
  const cartCutoff = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString();
  const db=getDb();const[staleRows,staleCarts]=await db.batch([
    db.delete(requestThrottles).where(lt(requestThrottles.updatedAt,cutoff)).returning({keyHash:requestThrottles.keyHash}),
    db.delete(carts).where(lt(carts.updatedAt,cartCutoff)).returning({id:carts.id}),
  ]);
  await recordAudit({
    user,
    action: "data.retention_cleanup",
    entityType: "maintenance",
    summary: `${staleRows.length} güvenlik sayacı ve ${staleCarts.length} süresi dolmuş sepet temizlendi.`,
    after: { deletedRequestThrottles:staleRows.length, deletedCarts:staleCarts.length, cutoff, cartCutoff, retentionHours:48, abandonedCartDays:35 },
  });
  return Response.json({ deleted:staleRows.length, deletedCarts:staleCarts.length, cutoff, cartCutoff, message:staleRows.length||staleCarts.length?"Süresi dolmuş teknik kayıtlar temizlendi.":"Temizlenecek süresi dolmuş kayıt yok." });
}
