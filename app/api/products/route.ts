import { and, desc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { categories, inventoryMovements, productImages, products, productVariants } from "../../../db/schema";
import { catalogQuality } from "../../catalog-quality";
import { recordAudit } from "../../audit-log";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isCatalogImageUrl, parseCatalogMoney, parseCatalogStock } from "../../catalog-input";

export const dynamic = "force-dynamic";

type ProductRecord = typeof products.$inferSelect;

function publicationIssues(product: ProductRecord, variants: Array<typeof productVariants.$inferSelect>, categoryActive?:boolean) {
  return catalogQuality(product,variants,[],categoryActive).blockers;
}

export async function GET() {
  try {
    const db = getDb();
    const user = await getChatGPTUser();
    if(user)return Response.json({products:await db.select().from(products).orderBy(desc(products.id))});
    const[rows,categoryRows]=await Promise.all([db.select().from(products).where(eq(products.active,true)).orderBy(desc(products.id)),db.select().from(categories).where(eq(categories.active,true))]);
    const visibleCategoryIds=new Set(categoryRows.filter(category=>category.parentId===null||categoryRows.some(parent=>parent.id===category.parentId)).map(category=>category.id));
    return Response.json({products:rows.filter(product=>product.categoryId!==null&&visibleCategoryIds.has(product.categoryId))});
  } catch {
    return Response.json({ products: [], status: "catalog_initializing" });
  }
}

export async function POST(request: Request) {
  const user=await getChatGPTUser();if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(()=>null) as Record<string, unknown>|null;if(!body)return Response.json({error:"Geçersiz ürün verisi."},{status:400});
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
      db.select().from(productVariants).where(and(eq(productVariants.productId, duplicateId),eq(productVariants.active,true))),
    ]);
    if (images.length) await db.insert(productImages).values(images.map(image => ({ productId: product.id, imageUrl: image.imageUrl, altText: image.altText, sortOrder: image.sortOrder })));
    if (variants.length) await db.insert(productVariants).values(variants.map(variant => ({ productId: product.id, sku: `${variant.sku}-COPY-${suffix}`, optionName: variant.optionName, optionValue: variant.optionValue, optionNameEn: variant.optionNameEn, optionValueEn: variant.optionValueEn, stock: 0, priceAdjustment: variant.priceAdjustment })));
    await recordAudit({user,action:"product.duplicate",entityType:"product",entityId:product.id,summary:`${source.nameTr} ürünü taslak olarak kopyalandı.`,before:{sourceProductId:source.id},after:product});
    return Response.json({ product, copiedImages: images.length, copiedVariants: variants.length }, { status: 201 });
  }
  const nameTr = String(body.nameTr ?? "").trim();
  const slug = String(body.slug ?? "").trim().toLocaleLowerCase("en-US");const imageUrl=String(body.imageUrl??"").trim();const nameEn=String(body.nameEn??"").trim();const descriptionTr=String(body.descriptionTr??"");const descriptionEn=String(body.descriptionEn??"");const categoryId=Number(body.categoryId)||null;
  const priceTr=parseCatalogMoney(body.priceTr);const priceGlobal=parseCatalogMoney(body.priceGlobal);const stock=parseCatalogStock(body.stock);
  if (!nameTr || !slug) return Response.json({ error: "Ürün adı ve kodu zorunludur." }, { status: 400 });
  if(nameTr.length>200||nameEn.length>200||descriptionTr.length>10_000||descriptionEn.length>10_000||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>160)return Response.json({error:"Ürün metinleri veya kodu izin verilen sınırları aşıyor."},{status:400});
  if(categoryId!==null&&(!Number.isInteger(categoryId)||categoryId<1))return Response.json({error:"Kategori geçersiz."},{status:400});
  if(priceTr===null||priceGlobal===null)return Response.json({error:"Fiyat sıfır ile 100.000.000 arasında olmalıdır."},{status:400});
  if(stock===null)return Response.json({error:"Stok sıfır ile 1.000.000 arasında tam sayı olmalıdır."},{status:400});
  if(!isCatalogImageUrl(imageUrl))return Response.json({error:"Görsel bağlantısı güvenli bir HTTPS veya site içi adres olmalıdır."},{status:400});
  const db = getDb();
  if(categoryId){const[category]=await db.select({id:categories.id}).from(categories).where(eq(categories.id,categoryId)).limit(1);if(!category)return Response.json({error:"Kategori bulunamadı."},{status:400});}
  const [product] = await db.insert(products).values({
    nameTr, slug,
    nameEn,descriptionTr,descriptionEn,categoryId,
    imageUrl,priceTr,priceGlobal,stock,
    marketTr: Boolean(body.marketTr),
    marketGlobal: Boolean(body.marketGlobal),
    active: false,
  }).returning().catch(()=>[]);if(!product)return Response.json({error:"Bu ürün kodu daha önce kullanılmış."},{status:409});
  if(product.stock>0)await db.insert(inventoryMovements).values({productId:product.id,movementType:"opening",quantityDelta:product.stock,previousStock:0,nextStock:product.stock,reason:"Ürün açılış stoğu",reference:"product-create",actorEmail:user.email});
  await recordAudit({user,action:"product.create",entityType:"product",entityId:product.id,summary:`${product.nameTr} ürünü taslak olarak oluşturuldu.`,after:product});
  return Response.json({ product }, { status: 201 });
}

export async function PATCH(request: Request) {
  const user=await getChatGPTUser();if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json().catch(()=>null) as Record<string, unknown>|null;if(!body)return Response.json({error:"Geçersiz ürün verisi."},{status:400});
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
    if (selectedProducts.some(product=>({...product,...bulkUpdates}).active)) {
      const [selectedVariants, categoryRows] = await Promise.all([
        db.select().from(productVariants).where(inArray(productVariants.productId, ids)),
        db.select().from(categories),
      ]);
      const categoryState=new Map(categoryRows.map(category=>[category.id,category.active]));
      const incomplete = selectedProducts.map(product => {const candidate={...product,...bulkUpdates} as ProductRecord;return ({
        product:candidate,
        issues: candidate.active?publicationIssues(candidate, selectedVariants.filter(variant => variant.productId === product.id),candidate.categoryId?categoryState.get(candidate.categoryId):undefined):[],
      });}).filter(item => item.issues.length);
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
  if (body.nameTr !== undefined){const value=String(body.nameTr).trim();if(value.length>200)return Response.json({error:"Ürün adı 200 karakteri aşamaz."},{status:400});updates.nameTr=value;}
  if (body.nameEn !== undefined){const value=String(body.nameEn).trim();if(value.length>200)return Response.json({error:"İngilizce ürün adı 200 karakteri aşamaz."},{status:400});updates.nameEn=value;}
  if (body.slug !== undefined){const value=String(body.slug).trim().toLocaleLowerCase("en-US");if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)||value.length>160)return Response.json({error:"Ürün kodu yalnızca küçük harf, rakam ve tire içermelidir."},{status:400});updates.slug=value;}
  if (body.descriptionTr !== undefined){const value=String(body.descriptionTr);if(value.length>10_000)return Response.json({error:"Türkçe açıklama 10.000 karakteri aşamaz."},{status:400});updates.descriptionTr=value;}
  if (body.descriptionEn !== undefined){const value=String(body.descriptionEn);if(value.length>10_000)return Response.json({error:"İngilizce açıklama 10.000 karakteri aşamaz."},{status:400});updates.descriptionEn=value;}
  if (body.categoryId !== undefined){const categoryId=Number(body.categoryId)||null;if(categoryId!==null&&(!Number.isInteger(categoryId)||categoryId<1))return Response.json({error:"Kategori geçersiz."},{status:400});updates.categoryId=categoryId;}
  if (body.imageUrl !== undefined){const imageUrl=String(body.imageUrl).trim();if(!isCatalogImageUrl(imageUrl))return Response.json({error:"Görsel bağlantısı güvenli bir HTTPS veya site içi adres olmalıdır."},{status:400});updates.imageUrl=imageUrl;}
  if (body.priceTr !== undefined){const price=parseCatalogMoney(body.priceTr);if(price===null)return Response.json({error:"Türkiye fiyatı geçersiz."},{status:400});updates.priceTr=price;}
  if (body.priceGlobal !== undefined){const price=parseCatalogMoney(body.priceGlobal);if(price===null)return Response.json({error:"Global fiyat geçersiz."},{status:400});updates.priceGlobal=price;}
  if (body.stock !== undefined){const stock=parseCatalogStock(body.stock);if(stock===null)return Response.json({error:"Stok sıfır ile 1.000.000 arasında tam sayı olmalıdır."},{status:400});updates.stock=stock;}
  if (body.marketTr !== undefined) updates.marketTr = Boolean(body.marketTr);
  if (body.marketGlobal !== undefined) updates.marketGlobal = Boolean(body.marketGlobal);
  if (body.featured !== undefined) updates.featured = Boolean(body.featured);
  if (body.active !== undefined) updates.active = Boolean(body.active);
  const candidate = { ...currentBefore, ...updates } as ProductRecord;
  if (candidate.active) {
    const [variants,categoryRows] = await Promise.all([db.select().from(productVariants).where(eq(productVariants.productId, id)),db.select().from(categories)]);
    const categoryState=new Map(categoryRows.map(category=>[category.id,category.active]));
    const issues = publicationIssues(candidate, variants,candidate.categoryId?categoryState.get(candidate.categoryId):undefined);
    if (issues.length) return Response.json({
      error: `Ürün yayınlanmadan önce tamamlanmalı: ${issues.join(", ")}.`,
      issues,
    }, { status: 409 });
  }
  const [product] = await db.update(products).set(updates).where(eq(products.id, id)).returning().catch(()=>[]);if(!product)return Response.json({error:"Ürün kodu başka bir kayıtta kullanılıyor veya veri geçersiz."},{status:409});
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
