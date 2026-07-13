import { getDb } from "../../../db";
import { storeSettings } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
const defaults = {
  brandName: "MYSA",
  brandSuffix: "OBJETS",
  announcementTr: "1.500 TL üzeri ücretsiz gönderim",
  announcementGlobal: "Complimentary shipping over €150",
  heroEyebrow: "Yavaş yaşam için seçilmiş parçalar",
  heroTitle: "Gündelik olanı",
  heroTitleAccent: "olağanüstü kılın.",
  heroCopy: "Eviniz, gardırobunuz ve en yakın dostlarınız için; dokusu, işçiliği ve hikâyesi olan zamansız objeler.",
  heroButton: "Yeni seçkiyi keşfet",
  heroImageUrl: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=2000&q=90",
  introTitle: "Daha az, ama daha iyi.",
  introCopy: "Dokunmak isteyeceğiniz tekstillerden bilinçli üretilmiş aksesuarlara ve dostlarımız için özenle seçilmiş ürünlere uzanan modern bir yaşam koleksiyonu.",
  shippingTr:"99",
  freeShippingTr:"1500",
  shippingGlobal:"15",
  freeShippingGlobal:"150",
};
export async function GET() { try { const rows = await getDb().select().from(storeSettings); return Response.json({ settings: { ...defaults, ...Object.fromEntries(rows.map(row => [row.key, row.value])) } }); } catch { return Response.json({ settings: defaults }); } }
export async function PUT(request: Request) { if (!(await getChatGPTUser())) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 }); const body = await request.json() as Record<string, unknown>; const db = getDb(); const allowed = Object.keys(defaults) as (keyof typeof defaults)[]; const rows=await db.select().from(storeSettings);const current=Object.fromEntries(rows.map(row=>[row.key,row.value]));const values=Object.fromEntries(allowed.map(key=>[key,String(body[key]??current[key]??defaults[key])]));await db.batch(allowed.map(key => db.insert(storeSettings).values({ key, value: values[key], updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: storeSettings.key, set: { value: values[key], updatedAt: new Date().toISOString() } }))); return Response.json({ settings: values }); }
