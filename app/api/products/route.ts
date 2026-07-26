import { desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { categories, inventoryMovements, productImages, products, productVariants } from "../../../db/schema";
import { catalogQuality } from "../../catalog-quality";
import { recordAudit } from "../../audit-log";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

type ProductRecord = typeof products.$inferSelect;

function publicationIssues(product: ProductRecord, variants: Array<typeof productVariants.$inferSelect>, categoryActive?:boolean) {
  return catalogQuality(product,variants,[],categoryActive).blockers;
}

export async function GET() {
  try {
    const db = getDb();
    const user = await getChatGPTUser();
    const rows = user
      ? await db.select().from(products).orderBy(desc(products.id))
      : await db.select().from(products).where(eq(products.active, true)).orderBy(desc(products.id));
    return Response.json({ products: rows });
  } catch {
    return Response.json({ products: [], status: "catalog_initializing" });
  }
}

export async function POST(request: Request) {
  const user=await getChatGPTUser();if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const duplicateId = Number(body.duplicateId);
  if (duplicateId) {
    const db = getDb();
    const [source] = await db.select().from(products).where(eq(products.id, duplicateId)).limit(1);
    if (!source) return Response.json({ error: "Kopyalanacak ürün bulunamadı." }, { status: 404 });
    const suffix = Date.now().toString(36);
    const [product] = await db.insert(products).values({
      nameTr: `${source.nameTr} (Kopya)`, nameEn: source.nameEn ? `${source.nameEn} (Copy)` : "", slug: `${source.slug}-kopya-${suffix}`,
      descriptionTr: source.descriptionTr, descriptionEn: source.descriptionEn, categoryId: source.categoryId, imageUrl: source.imageUrl,
      priceTr: source.priceTr, priceGlobal: source.priceGlobal, currencyGlobal: source.currencyGlobal, stock: 0,
      sourcingType:source.sourcingType,supplierName:source.supplierName,supplierContact:source.supplierContact,supplierSku:source.supplierSku,unitCost:source.unitCost,leadTimeDays:source.leadTimeDays,reorderPoint:source.reorderPoint,
      marketTr: source.marketTr, marketGlobal: source.marketGlobal, featured: false, active: false,
    }).returning();
    const [images, variants] = await Promise.all([
      db.select().from(productImages).where(eq(productImages.productId, duplicateId)),
      db.select().from(productVariants).where(eq(productVariants.productId, duplicateId)),
    ]);
    if (images.length) await db.insert(productImages).values(images.map(image => ({ productId: product.id, imageUrl: image.imageUrl, altText: image.altText, sortOrder: image.sortOrder })));
    if (variants.length) await db.insert(productVariants).values(variants.map(variant => ({ productId: product.id, sku: `${variant.sku}-COPY-${suffix}`, optionName: variant.optionName, optionValue: variant.optionValue, optionNameEn: variant.optionNameEn, optionValueEn: variant.optionValueEn, stock: 0, priceAdjustment: variant.priceAdjustment })));
    await recordAudit({user,action:"product.duplicate",entityType:"product",entityId:product.id,summary:`${source.nameTr} ürünü taslak olarak kopyalandı.`,before:{sourceProductId:source.id},after:product});
    return Response.json({ product, copiedImages: images.length, copiedVariants: variants.length }, { status: 201 });
  }
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
    active: false,
  }).returning();
  if(product.stock>0)await db.insert(inventoryMovements).values({productId:product.id,movementType:"opening",quantityDelta:product.stock,previousStock:0,nextStock:product.stock,reason:"Ürün açılış stoğu",reference:"product-create",actorEmail:user.email});
  await recordAudit({user,action:"product.create",entityType:"product",entityId:product.id,summary:`${product.nameTr} ürünü taslak olarak oluşturuldu.`,after:product});
  return Response.json({ product }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user=await getChatGPTUser();if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const ids = Array.isArray(body.ids) ? body.ids.map(Number).filter(Number.isInteger).filter(id => id > 0).slice(0, 500) : [];
  if (ids.length) {
    const db=getDb();
    const selectedProducts=await db.select().from(products).where(inArray(products.id,ids));
    const bulkUpdates: Partial<typeof products.$inferInsert> = { updatedAt: new Date().toISOString() };
    if (body.active !== undefined) bulkUpdates.active = Boolean(body.active);
    if (body.marketTr !== undefined) bulkUpdates.marketTr = Boolean(body.marketTr);
    if (body.marketGlobal !== undefined) bulkUpdates.marketGlobal = Boolean(body.marketGlobal);
    if (body.featured !== undefined) bulkUpdates.featured = Boolean(body.featured);
    if (Object.keys(bulkUpdates).length === 1) return Response.json({ error: "Toplu işlem seçilmedi." }, { status: 400 });
    if (bulkUpdates.active === true) {
      const [selectedVariants, categoryRows] = await Promise.all([
        db.select().from(productVariants).where(inArray(productVariants.productId, ids)),
        db.select().from(categories),
      ]);
      const categoryState=new Map(categoryRows.map(category=>[category.id,category.active]));
      const incomplete = selectedProducts.map(product => ({
        product,
        issues: publicationIssues(product, selectedVariants.filter(variant => variant.productId === product.id),product.categoryId?categoryState.get(product.categoryId):undefined),
      })).filter(item => item.issues.length);
      if (incomplete.length) return Response.json({
        error: `${incomplete.length} ürün satışa hazır değil.`,
        incomplete: incomplete.map(item => ({ id:item.product.id, name:item.product.nameTr, issues:item.issues })),
      }, { status: 409 });
    }
    const updated = await db.update(products).set(bulkUpdates).where(inArray(products.id, ids)).returning({ id: products.id });
    await recordAudit({user,action:"product.bulk_update",entityType:"product",summary:`${updated.length} ürün toplu olarak güncellendi.`,before:{productIds:selectedProducts.map(product=>product.id)},after:{updates:bulkUpdates,productIds:updated.map(product=>product.id)}});
    return Response.json({ ok: true, updated: updated.length });
  }
  const id = Number(body.id);
  if (!id) return Response.json({ error: "Geçersiz ürün" }, { status: 400 });
  const db = getDb();
  const[currentBefore]=await db.select().from(products).where(eq(products.id,id)).limit(1);if(!currentBefore)return Response.json({error:"Ürün bulunamadı."},{status:404});
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
  if (body.stock !== undefined){const stock=Number(body.stock);if(!Number.isInteger(stock)||stock<0)return Response.json({error:"Stok sıfır veya pozitif tam sayı olmalıdır."},{status:400});updates.stock=stock;}
  if (body.marketTr !== undefined) updates.marketTr = Boolean(body.marketTr);
  if (body.marketGlobal !== undefined) updates.marketGlobal = Boolean(body.marketGlobal);
  if (body.featured !== undefined) updates.featured = Boolean(body.featured);
  if (body.active !== undefined) updates.active = Boolean(body.active);
  if (updates.active === true) {
    const [current] = await db.select().from(products).where(eq(products.id, id)).limit(1);
    if (!current) return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
    const [variants,categoryRows] = await Promise.all([db.select().from(productVariants).where(eq(productVariants.productId, id)),db.select().from(categories)]);
    const categoryState=new Map(categoryRows.map(category=>[category.id,category.active]));
    const candidate = { ...current, ...updates } as ProductRecord;
    const issues = publicationIssues(candidate, variants,candidate.categoryId?categoryState.get(candidate.categoryId):undefined);
    if (issues.length) return Response.json({
      error: `Ürün yayınlanmadan önce tamamlanmalı: ${issues.join(", ")}.`,
      issues,
    }, { status: 409 });
  }
  const [product] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
  if(product&&updates.stock!==undefined&&updates.stock!==currentBefore.stock)await db.insert(inventoryMovements).values({productId:id,movementType:"correction",quantityDelta:updates.stock-currentBefore.stock,previousStock:currentBefore.stock,nextStock:updates.stock,reason:"Ürün düzenleyicisinden stok düzeltmesi",reference:"product-editor",actorEmail:user.email});
  if(product)await recordAudit({user,action:"product.update",entityType:"product",entityId:id,summary:`${product.nameTr} ürünü güncellendi.`,before:currentBefore,after:product});
  return Response.json({ product });
}

export async function DELETE(request: Request) {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!id) return Response.json({ error: "Geçersiz ürün" }, { status: 400 });
  const db = getDb();
  const [before] = await db.select().from(products).where(eq(products.id, id)).limit(1);
  if (!before) return Response.json({ error: "Ürün bulunamadı." }, { status: 404 });
  const [product] = await db.update(products).set({ active:false, marketTr:false, marketGlobal:false, featured:false, updatedAt:new Date().toISOString() }).where(eq(products.id, id)).returning();
  await recordAudit({ user, action:"product.archive", entityType:"product", entityId:id, summary:`${before.nameTr} ürünü geri alınabilir biçimde arşivlendi.`, before:{ active:before.active, marketTr:before.marketTr, marketGlobal:before.marketGlobal, featured:before.featured }, after:{ active:false, marketTr:false, marketGlobal:false, featured:false } });
  return Response.json({ ok:true, archived:true, product });
}
