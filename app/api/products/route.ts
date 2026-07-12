import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { products } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = getDb();
  return Response.json({ products: await db.select().from(products).orderBy(desc(products.id)) });
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
    descriptionTr: String(body.descriptionTr ?? ""),
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
  const [product] = await db.update(products).set({
    active: body.active === undefined ? true : Boolean(body.active),
    stock: Number(body.stock ?? 0),
    updatedAt: new Date().toISOString(),
  }).where(eq(products.id, id)).returning();
  return Response.json({ product });
}

export async function DELETE(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Geçersiz ürün" }, { status: 400 });
  await getDb().delete(products).where(eq(products.id, id));
  return Response.json({ ok: true });
}
