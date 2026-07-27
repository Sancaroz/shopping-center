import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { adminUsers } from "../../../db/schema";
import { recordAudit } from "../../audit-log";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isValidEmail, normalizeEmail, readBoundedJson } from "../../public-form-security";

export const dynamic = "force-dynamic";

async function owner() {
  const user = await getChatGPTUser();
  return user?.role === "owner" ? user : null;
}

export async function GET() {
  const user = await owner();
  if (!user) return Response.json({ error: "Bu işlem yalnızca mağaza sahibine açıktır." }, { status: 403 });
  const members = await getDb().select().from(adminUsers).orderBy(asc(adminUsers.id));
  return Response.json({ members, currentAdminId: user.adminId });
}

export async function POST(request: Request) {
  const user = await owner();
  if (!user) return Response.json({ error: "Bu işlem yalnızca mağaza sahibine açıktır." }, { status: 403 });
  const parsed=await readBoundedJson(request,2_000);if(parsed.error)return parsed.error;const body=parsed.body!;
  const email = normalizeEmail(body.email);
  const displayName = String(body.displayName ?? "").trim();
  if (!isValidEmail(email)) return Response.json({ error: "Geçerli bir e-posta adresi girin." }, { status: 400 });
  if(displayName.length>120)return Response.json({error:"Yönetici adı 120 karakteri aşamaz."},{status:400});

  const db = getDb();
  const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
  if (existing) {
    if (existing.active) return Response.json({ error: "Bu e-posta zaten yönetim ekibinde." }, { status: 409 });
    await db.update(adminUsers).set({ active: true, displayName: displayName || existing.displayName, updatedAt: new Date().toISOString() }).where(eq(adminUsers.id, existing.id));
    await recordAudit({ user, action: "admin_user.reactivate", entityType: "admin_user", entityId: existing.id, summary: `${email} yönetim erişimi yeniden açıldı.`, before: existing, after: { active: true, displayName: displayName || existing.displayName } });
    return Response.json({ message: "Yönetici erişimi yeniden açıldı." });
  }

  const [created] = await db.insert(adminUsers).values({ email, displayName, role: "admin", active: true, createdBy: user.email }).returning();
  await recordAudit({ user, action: "admin_user.create", entityType: "admin_user", entityId: created.id, summary: `${email} yönetim ekibine eklendi.`, after: created });
  return Response.json({ message: "Yönetici eklendi." }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await owner();
  if (!user) return Response.json({ error: "Bu işlem yalnızca mağaza sahibine açıktır." }, { status: 403 });
  const parsed=await readBoundedJson(request,2_000);if(parsed.error)return parsed.error;const body=parsed.body!;
  const id = Number(body.id);
  if (!Number.isInteger(id)||id<1 || typeof body.active !== "boolean" || body.role!==undefined) return Response.json({ error: "Geçersiz yönetici güncellemesi." }, { status: 400 });

  const db = getDb();
  const [member] = await db.select().from(adminUsers).where(eq(adminUsers.id, id)).limit(1);
  if (!member) return Response.json({ error: "Yönetici bulunamadı." }, { status: 404 });
  if (!body.active && (member.id === user.adminId || member.role === "owner")) return Response.json({ error: "Mağaza sahibi erişimi kapatılamaz." }, { status: 409 });

  if(body.displayName!==undefined&&(typeof body.displayName!=="string"||body.displayName.trim().length>120))return Response.json({error:"Yönetici adı 120 karakteri aşamaz."},{status:400});
  const displayName = typeof body.displayName === "string" ? body.displayName.trim() : member.displayName;
  await db.update(adminUsers).set({ active: body.active, displayName, updatedAt: new Date().toISOString() }).where(eq(adminUsers.id, id));
  await recordAudit({ user, action: "admin_user.update", entityType: "admin_user", entityId: id, summary: `${member.email} yönetim erişimi ${body.active ? "açıldı" : "kapatıldı"}.`, before: member, after: { active: body.active, displayName } });
  return Response.json({ message: body.active ? "Yönetici erişimi açıldı." : "Yönetici erişimi kapatıldı." });
}
