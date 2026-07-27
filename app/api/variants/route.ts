import {and,asc,eq} from "drizzle-orm";
import {getDb} from "../../../db";
import {categories,inventoryMovements,products,productVariants} from "../../../db/schema";
import {recordAudit} from "../../audit-log";
import {getChatGPTUser} from "../../chatgpt-auth";
import {parseCatalogMoney,parseCatalogStock} from "../../catalog-input";

export const dynamic="force-dynamic";

export async function GET(){
  try{
    const db=getDb();
    const user=await getChatGPTUser();
    if(user)return Response.json({variants:await db.select().from(productVariants).orderBy(asc(productVariants.productId),asc(productVariants.id))});
    const[variants,productRows,categoryRows]=await Promise.all([
      db.select({id:productVariants.id,productId:productVariants.productId,optionName:productVariants.optionName,optionValue:productVariants.optionValue,optionNameEn:productVariants.optionNameEn,optionValueEn:productVariants.optionValueEn,stock:productVariants.stock,priceAdjustment:productVariants.priceAdjustment}).from(productVariants).where(eq(productVariants.active,true)).orderBy(asc(productVariants.productId),asc(productVariants.id)),
      db.select({id:products.id,categoryId:products.categoryId}).from(products).where(eq(products.active,true)),
      db.select({id:categories.id,parentId:categories.parentId}).from(categories).where(eq(categories.active,true)),
    ]);
    const visibleCategoryIds=new Set(categoryRows.filter(category=>category.parentId===null||categoryRows.some(parent=>parent.id===category.parentId)).map(category=>category.id));
    const visibleProductIds=new Set(productRows.filter(product=>product.categoryId!==null&&visibleCategoryIds.has(product.categoryId)).map(product=>product.id));
    return Response.json({variants:variants.filter(variant=>visibleProductIds.has(variant.productId))});
  }catch{return Response.json({variants:[]});}
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return Response.json({error:"Geçersiz varyant verisi."},{status:400});const productId=Number(body.productId);const sku=String(body.sku??"").trim();const optionName=String(body.optionName??"").trim();const optionValue=String(body.optionValue??"").trim();const stock=parseCatalogStock(body.stock);const priceAdjustment=parseCatalogMoney(body.priceAdjustment,{allowNegative:true});
  if(!Number.isInteger(productId)||productId<1||!sku||!optionName||!optionValue)return Response.json({error:"Ürün, seçenek, değer ve ürün kodu zorunludur."},{status:400});
  if(sku.length>100||optionName.length>100||optionValue.length>160)return Response.json({error:"Varyant alanları izin verilen uzunluğu aşıyor."},{status:400});
  if(stock===null)return Response.json({error:"Stok sıfır ile 1.000.000 arasında tam sayı olmalıdır."},{status:400});if(priceAdjustment===null)return Response.json({error:"Fiyat farkı geçersiz."},{status:400});
  const db=getDb();const[product]=await db.select().from(products).where(eq(products.id,productId)).limit(1);if(!product)return Response.json({error:"Ürün bulunamadı."},{status:404});if(product.active&&((product.marketTr&&product.priceTr+priceAdjustment<=0)||(product.marketGlobal&&product.priceGlobal+priceAdjustment<=0)))return Response.json({error:"Fiyat farkı ürünün satış fiyatını sıfır veya negatif yapamaz."},{status:400});
  const[variant]=await db.insert(productVariants).values({productId,sku,optionName,optionValue,optionNameEn:String(body.optionNameEn??"").trim().slice(0,100),optionValueEn:String(body.optionValueEn??"").trim().slice(0,160),stock,priceAdjustment,active:true,updatedAt:new Date().toISOString()}).returning().catch(()=>[]);if(!variant)return Response.json({error:"Bu varyant kodu daha önce kullanılmış."},{status:409});
  if(stock>0)await db.insert(inventoryMovements).values({productId,variantId:variant.id,movementType:"opening",quantityDelta:stock,previousStock:0,nextStock:stock,reason:"Varyant açılış stoğu",reference:"variant-create",actorEmail:user.email});
  await recordAudit({user,action:"variant.create",entityType:"variant",entityId:variant.id,summary:`${variant.sku} varyantı oluşturuldu.`,after:variant});
  return Response.json({variant},{status:201});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;const id=Number(body?.id);if(!body||!Number.isInteger(id)||id<1)return Response.json({error:"Geçersiz varyant"},{status:400});
  const expectedUpdatedAt=String(body.expectedUpdatedAt??"");if(!expectedUpdatedAt)return Response.json({error:"Varyant ekranı güncel değil. Sayfayı yenileyip tekrar deneyin."},{status:409,headers:{"Cache-Control":"no-store"}});const db=getDb();const[before]=await db.select().from(productVariants).where(eq(productVariants.id,id)).limit(1);if(!before)return Response.json({error:"Varyant bulunamadı"},{status:404});if(before.updatedAt!==expectedUpdatedAt)return Response.json({error:"Varyant veya stoğu bu sırada başka bir işlemden güncellendi. Sayfayı yenileyip tekrar deneyin."},{status:409,headers:{"Cache-Control":"no-store"}});
  if(body.stock!==undefined){const requestedStock=parseCatalogStock(body.stock);if(requestedStock===null)return Response.json({error:"Stok değeri geçersiz."},{status:400});if(requestedStock!==before.stock)return Response.json({error:"Mevcut varyant stoğu yalnızca Stok Merkezi üzerinden, açıklama ve benzersiz referansla değiştirilebilir."},{status:409});}
  if(body.productId!==undefined&&Number(body.productId)!==before.productId)return Response.json({error:"Varyant başka bir ürüne taşınamaz."},{status:409});
  const updates:Partial<typeof productVariants.$inferInsert>={};if(body.sku!==undefined){const value=String(body.sku).trim();if(!value||value.length>100)return Response.json({error:"Varyant kodu geçersiz."},{status:400});updates.sku=value;}if(body.optionName!==undefined){const value=String(body.optionName).trim();if(!value||value.length>100)return Response.json({error:"Seçenek adı geçersiz."},{status:400});updates.optionName=value;}if(body.optionValue!==undefined){const value=String(body.optionValue).trim();if(!value||value.length>160)return Response.json({error:"Seçenek değeri geçersiz."},{status:400});updates.optionValue=value;}if(body.optionNameEn!==undefined)updates.optionNameEn=String(body.optionNameEn).trim().slice(0,100);if(body.optionValueEn!==undefined)updates.optionValueEn=String(body.optionValueEn).trim().slice(0,160);if(body.stock!==undefined){const stock=parseCatalogStock(body.stock);if(stock===null)return Response.json({error:"Stok sıfır ile 1.000.000 arasında tam sayı olmalıdır."},{status:400});updates.stock=stock;}if(body.priceAdjustment!==undefined){const value=parseCatalogMoney(body.priceAdjustment,{allowNegative:true});if(value===null)return Response.json({error:"Fiyat farkı geçersiz."},{status:400});updates.priceAdjustment=value;}if(body.active!==undefined)updates.active=Boolean(body.active);
  const[product]=await db.select().from(products).where(eq(products.id,before.productId)).limit(1);if(!product)return Response.json({error:"Ürün bulunamadı."},{status:404});const nextAdjustment=updates.priceAdjustment??before.priceAdjustment;if(product.active&&((product.marketTr&&product.priceTr+nextAdjustment<=0)||(product.marketGlobal&&product.priceGlobal+nextAdjustment<=0)))return Response.json({error:"Fiyat farkı ürünün satış fiyatını sıfır veya negatif yapamaz."},{status:400});
  updates.updatedAt=new Date().toISOString();const[variant]=await db.update(productVariants).set(updates).where(and(eq(productVariants.id,id),eq(productVariants.updatedAt,expectedUpdatedAt))).returning().catch(()=>[]);if(!variant)return Response.json({error:"Varyant başka bir ekrandan güncellendi, kodu kullanılıyor veya veri geçersiz. Sayfayı yenileyip tekrar deneyin."},{status:409,headers:{"Cache-Control":"no-store"}});
  await recordAudit({user,action:"variant.update",entityType:"variant",entityId:id,summary:`${variant.sku} varyantı güncellendi.`,before,after:variant});
  return Response.json({variant});
}

export async function DELETE(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const url=new URL(request.url);const id=Number(url.searchParams.get("id"));const expectedUpdatedAt=String(url.searchParams.get("expectedUpdatedAt")??"");if(!id)return Response.json({error:"Geçersiz varyant"},{status:400});if(!expectedUpdatedAt)return Response.json({error:"Varyant ekranı güncel değil. Sayfayı yenileyip tekrar deneyin."},{status:409,headers:{"Cache-Control":"no-store"}});
  const db=getDb();const[before]=await db.select().from(productVariants).where(eq(productVariants.id,id)).limit(1);if(!before)return Response.json({error:"Varyant bulunamadı"},{status:404});if(before.updatedAt!==expectedUpdatedAt)return Response.json({error:"Varyant veya stoğu bu sırada başka bir işlemden güncellendi. Sayfayı yenileyip tekrar deneyin."},{status:409,headers:{"Cache-Control":"no-store"}});
  const[variant]=await db.update(productVariants).set({active:false,updatedAt:new Date().toISOString()}).where(and(eq(productVariants.id,id),eq(productVariants.updatedAt,expectedUpdatedAt))).returning();if(!variant)return Response.json({error:"Varyant bu sırada başka bir işlemden güncellendi. Sayfayı yenileyip tekrar deneyin."},{status:409,headers:{"Cache-Control":"no-store"}});
  await recordAudit({user,action:"variant.archive",entityType:"variant",entityId:id,summary:`${before.sku} varyantı, stok geçmişi korunarak arşivlendi.`,before:{active:before.active},after:{active:false}});
  return Response.json({ok:true,archived:true,variant});
}
