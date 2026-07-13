import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { products } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db = getDb();
    return Response.json({ products: await db.select().from(products).orderBy(desc(products.id)) });
  } catch {
    return Response.json({ products: [], status: "catalog_initializing" });
  }
}

export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const nameTr = String(body.nameTr ?? "").trim();
  const slug = String(body.slug ?? "").trim();
  if (!nameTr || !slug) return Response.json({ error: "Ürün adı ve kodu zorunludur." }, { status: 400 });
  const db = getDb();
  const [product] = await db.insert(products).values({
    nameTr, slug,
    nameEn: String(body.nameEn ?? "").trim(),
    descriptionTr: String(body.descriptionTr ?? ""),
    descriptionEn: String(body.descriptionEn ?? ""),
    categoryId: Number(body.categoryId) || null,
    imageUrl: String(body.imageUrl ?? ""),
    priceTr: Number(body.priceTr ?? 0),
    priceGlobal: Number(body.priceGlobal ?? 0),
    stock: Number(body.stock ?? 0),
    marketTr: Boolean(body.marketTr),
    marketGlobal: Boolean(body.marketGlobal),
  }).returning();
  return Response.json({ product }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const id = Number(body.id);
  if (!id) return Response.json({ error: "Geçersiz ürün" }, { status: 400 });
  const db = getDb();
  const updates: Partial<typeof products.$inferInsert> = { updatedAt: new Date().toISOString() };
  if (body.nameTr !== undefined) updates.nameTr = String(body.nameTr).trim();
  if (body.nameEn !== undefined) updates.nameEn = String(body.nameEn).trim();
  if (body.slug !== undefined) updates.slug = String(body.slug).trim();
  if (body.descriptionTr !== undefined) updates.descriptionTr = String(body.descriptionTr);
  if (body.descriptionEn !== undefined) updates.descriptionEn = String(body.descriptionEn);
  if (body.categoryId !== undefined) updates.categoryId = Number(body.categoryId) || null;
  if (body.imageUrl !== undefined) updates.imageUrl = String(body.imageUrl);
  if (body.priceTr !== undefined) updates.priceTr = Number(body.priceTr);
  if (body.priceGlobal !== undefined) updates.priceGlobal = Number(body.priceGlobal);
  if (body.stock !== undefined) updates.stock = Number(body.stock);
  if (body.marketTr !== undefined) updates.marketTr = Boolean(body.marketTr);
  if (body.marketGlobal !== undefined) updates.marketGlobal = Boolean(body.marketGlobal);
  if (body.active !== undefined) updates.active = Boolean(body.active);
  const [product] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
  return Response.json({ product });
}

export async function DELETE(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Geçersiz ürün" }, { status: 400 });
  await getDb().delete(products).where(eq(products.id, id));
  return Response.json({ ok: true });
}
