import { getDb } from "../../../db";
import { storeSettings } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const defaults = { brandName: "MYSA", brandSuffix: "OBJETS", announcementTr: "1.500 TL üzeri ücretsiz gönderim", announcementGlobal: "Complimentary shipping over €150", heroEyebrow: "Yavaş yaşam için seçilmiş parçalar" };
export async function GET() { try { const rows = await getDb().select().from(storeSettings); return Response.json({ settings: { ...defaults, ...Object.fromEntries(rows.map(row => [row.key, row.value])) } }); } catch { return Response.json({ settings: defaults }); } }
export async function PUT(request: Request) { if (!(await getChatGPTUser())) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 }); const body = await request.json() as Record<string, unknown>; const db = getDb(); const allowed = Object.keys(defaults) as (keyof typeof defaults)[]; await db.batch(allowed.map(key => db.insert(storeSettings).values({ key, value: String(body[key] ?? defaults[key]), updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: storeSettings.key, set: { value: String(body[key] ?? defaults[key]), updatedAt: new Date().toISOString() } }))); return Response.json({ settings: body }); }
