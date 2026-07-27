import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { homepageBlocks } from "../../../db/schema";
import { recordAudit } from "../../audit-log";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isSafeImageUrl, isSafeStorefrontUrl } from "../../safe-url";

export const dynamic = "force-dynamic";
const SHORT_TEXT_LIMIT = 200;
const COPY_LIMIT = 5_000;
const MAX_BLOCKS = 20;

function text(value: unknown) { return String(value ?? "").trim(); }
function invalidText(value: string, limit: number) { return value.length > limit; }
function invalidBoolean(value: unknown) { return value !== undefined && typeof value !== "boolean"; }

function validateBlock(block: typeof homepageBlocks.$inferSelect) {
  if (!block.titleTr || invalidText(block.titleTr, SHORT_TEXT_LIMIT)) return "Türkçe başlık zorunludur ve 200 karakteri aşamaz.";
  if ([block.eyebrowTr, block.eyebrowEn, block.titleEn, block.buttonTr, block.buttonEn].some(value => invalidText(value, SHORT_TEXT_LIMIT))) return "Kısa metin alanları 200 karakteri aşamaz.";
  if ([block.copyTr, block.copyEn].some(value => invalidText(value, COPY_LIMIT))) return "Açıklamalar 5.000 karakteri aşamaz.";
  if (!isSafeStorefrontUrl(block.buttonUrl, { allowEmpty: false })) return "Buton bağlantısı site içi bir yol, bölüm bağlantısı veya güvenli HTTPS adresi olmalıdır.";
  if (!isSafeImageUrl(block.imageUrl, false)) return "Vitrin görseli site içi bir yol veya güvenli HTTPS adresi olmalıdır.";
  if (!block.marketTr && !block.marketGlobal) return "Blok en az bir pazarda gösterilmelidir.";
  if (!Number.isInteger(block.sortOrder) || block.sortOrder < 0 || block.sortOrder > 100) return "Blok sırası 0 ile 100 arasında olmalıdır.";
  return "";
}

export async function GET() {
  try {
    const db = getDb();
    const user = await getChatGPTUser();
    const blocks = user
      ? await db.select().from(homepageBlocks).orderBy(asc(homepageBlocks.sortOrder), asc(homepageBlocks.id))
      : await db.select().from(homepageBlocks).where(eq(homepageBlocks.active, true)).orderBy(asc(homepageBlocks.sortOrder), asc(homepageBlocks.id));
    return Response.json({ blocks });
  } catch {
    return Response.json({ blocks: [] });
  }
}

export async function POST(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  if ([body.marketTr, body.marketGlobal].some(invalidBoolean)) return Response.json({ error: "Pazar seçimleri geçersiz." }, { status: 400 });
  if (body.imagePosition !== undefined && body.imagePosition !== "left" && body.imagePosition !== "right") return Response.json({ error: "Görsel konumu geçersiz." }, { status: 400 });

  const db = getDb();
  const rows = await db.select().from(homepageBlocks);
  if (rows.filter(block => block.active).length >= MAX_BLOCKS) return Response.json({ error: `En fazla ${MAX_BLOCKS} etkin vitrin bloğu oluşturulabilir.` }, { status: 409 });
  const candidate = {
    id: 0,
    eyebrowTr: text(body.eyebrowTr), eyebrowEn: text(body.eyebrowEn),
    titleTr: text(body.titleTr), titleEn: text(body.titleEn),
    copyTr: text(body.copyTr), copyEn: text(body.copyEn),
    buttonTr: text(body.buttonTr ?? "Keşfet"), buttonEn: text(body.buttonEn ?? "Explore"),
    buttonUrl: text(body.buttonUrl ?? "/magaza"), imageUrl: text(body.imageUrl),
    imagePosition: body.imagePosition === "right" ? "right" : "left",
    sortOrder: rows.length, marketTr: body.marketTr ?? true, marketGlobal: body.marketGlobal ?? true,
    active: true, createdAt: "",
  } satisfies typeof homepageBlocks.$inferSelect;
  const error = validateBlock(candidate);
  if (error) return Response.json({ error }, { status: 400 });
  const [block] = await db.insert(homepageBlocks).values({
    eyebrowTr: candidate.eyebrowTr, eyebrowEn: candidate.eyebrowEn, titleTr: candidate.titleTr, titleEn: candidate.titleEn,
    copyTr: candidate.copyTr, copyEn: candidate.copyEn, buttonTr: candidate.buttonTr, buttonEn: candidate.buttonEn,
    buttonUrl: candidate.buttonUrl, imageUrl: candidate.imageUrl, imagePosition: candidate.imagePosition, sortOrder: candidate.sortOrder,
    marketTr: candidate.marketTr, marketGlobal: candidate.marketGlobal, active: candidate.active,
  }).returning();
  await recordAudit({ user, action: "homepage_block.create", entityType: "homepage_block", entityId: block.id, summary: `Vitrin bloğu oluşturuldu: ${block.titleTr}`, after: block });
  return Response.json({ block }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return Response.json({ error: "Geçersiz istek." }, { status: 400 });
  const id = Number(body.id);
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Geçersiz blok." }, { status: 400 });
  if ([body.marketTr, body.marketGlobal, body.active].some(invalidBoolean)) return Response.json({ error: "Durum seçimi geçersiz." }, { status: 400 });
  if (body.imagePosition !== undefined && body.imagePosition !== "left" && body.imagePosition !== "right") return Response.json({ error: "Görsel konumu geçersiz." }, { status: 400 });

  const db = getDb();
  const [before] = await db.select().from(homepageBlocks).where(eq(homepageBlocks.id, id)).limit(1);
  if (!before) return Response.json({ error: "Blok bulunamadı." }, { status: 404 });
  const updates: Partial<typeof homepageBlocks.$inferInsert> = {};
  for (const key of ["eyebrowTr", "eyebrowEn", "titleTr", "titleEn", "copyTr", "copyEn", "buttonTr", "buttonEn", "buttonUrl", "imageUrl"] as const) {
    if (body[key] !== undefined) updates[key] = text(body[key]);
  }
  if (body.imagePosition !== undefined) updates.imagePosition = body.imagePosition as "left" | "right";
  if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder);
  if (body.marketTr !== undefined) updates.marketTr = body.marketTr as boolean;
  if (body.marketGlobal !== undefined) updates.marketGlobal = body.marketGlobal as boolean;
  if (body.active !== undefined) updates.active = body.active as boolean;
  const candidate = { ...before, ...updates };
  const error = validateBlock(candidate);
  if (error) return Response.json({ error }, { status: 400 });
  if (!before.active && candidate.active) {
    const rows = await db.select().from(homepageBlocks);
    if (rows.filter(block => block.active).length >= MAX_BLOCKS) return Response.json({ error: `En fazla ${MAX_BLOCKS} etkin vitrin bloğu yayınlanabilir.` }, { status: 409 });
  }
  const [block] = await db.update(homepageBlocks).set(updates).where(eq(homepageBlocks.id, id)).returning();
  await recordAudit({ user, action: "homepage_block.update", entityType: "homepage_block", entityId: id, summary: `Vitrin bloğu güncellendi: ${block.titleTr}`, before, after: block });
  return Response.json({ block });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return Response.json({ error: "Geçersiz blok." }, { status: 400 });
  const db = getDb();
  const [before] = await db.select().from(homepageBlocks).where(eq(homepageBlocks.id, id)).limit(1);
  if (!before) return Response.json({ error: "Blok bulunamadı." }, { status: 404 });
  const [block] = await db.update(homepageBlocks).set({ active: false }).where(eq(homepageBlocks.id, id)).returning();
  await recordAudit({ user, action: "homepage_block.archive", entityType: "homepage_block", entityId: id, summary: `Vitrin bloğu arşivlendi: ${before.titleTr}`, before, after: block });
  return Response.json({ ok: true, block });
}
