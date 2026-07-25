import {asc,eq} from "drizzle-orm";
import {getDb} from "../../../db";
import {inventoryMovements,productVariants} from "../../../db/schema";
import {getChatGPTUser} from "../../chatgpt-auth";

export const dynamic="force-dynamic";
export async function GET(){try{return Response.json({variants:await getDb().select().from(productVariants).orderBy(asc(productVariants.productId),asc(productVariants.id))});}catch{return Response.json({variants:[]});}}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json() as Record<string,unknown>;const productId=Number(body.productId);const sku=String(body.sku??"").trim();const optionName=String(body.optionName??"").trim();const optionValue=String(body.optionValue??"").trim();const stock=Number(body.stock??0);
  if(!productId||!sku||!optionName||!optionValue)return Response.json({error:"Ürün, seçenek, değer ve ürün kodu zorunludur."},{status:400});
  if(!Number.isInteger(stock)||stock<0)return Response.json({error:"Stok sıfır veya pozitif tam sayı olmalıdır."},{status:400});
  const db=getDb();const[variant]=await db.insert(productVariants).values({productId,sku,optionName,optionValue,optionNameEn:String(body.optionNameEn??"").trim(),optionValueEn:String(body.optionValueEn??"").trim(),stock,priceAdjustment:Number(body.priceAdjustment??0)}).returning();
  if(stock>0)await db.insert(inventoryMovements).values({productId,variantId:variant.id,movementType:"opening",quantityDelta:stock,previousStock:0,nextStock:stock,reason:"Varyant açılış stoğu",reference:"variant-create",actorEmail:user.email});
  return Response.json({variant},{status:201});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json() as Record<string,unknown>;const id=Number(body.id);if(!id)return Response.json({error:"Geçersiz varyant"},{status:400});
  const db=getDb();const[before]=await db.select().from(productVariants).where(eq(productVariants.id,id)).limit(1);if(!before)return Response.json({error:"Varyant bulunamadı"},{status:404});
  const updates:Partial<typeof productVariants.$inferInsert>={};if(body.productId!==undefined)updates.productId=Number(body.productId);if(body.sku!==undefined)updates.sku=String(body.sku).trim();if(body.optionName!==undefined)updates.optionName=String(body.optionName).trim();if(body.optionValue!==undefined)updates.optionValue=String(body.optionValue).trim();if(body.optionNameEn!==undefined)updates.optionNameEn=String(body.optionNameEn).trim();if(body.optionValueEn!==undefined)updates.optionValueEn=String(body.optionValueEn).trim();if(body.stock!==undefined){const stock=Number(body.stock);if(!Number.isInteger(stock)||stock<0)return Response.json({error:"Stok sıfır veya pozitif tam sayı olmalıdır."},{status:400});updates.stock=stock;}if(body.priceAdjustment!==undefined)updates.priceAdjustment=Number(body.priceAdjustment);
  const[variant]=await db.update(productVariants).set(updates).where(eq(productVariants.id,id)).returning();
  if(variant&&updates.stock!==undefined&&updates.stock!==before.stock)await db.insert(inventoryMovements).values({productId:variant.productId,variantId:id,movementType:"correction",quantityDelta:updates.stock-before.stock,previousStock:before.stock,nextStock:updates.stock,reason:"Varyant düzenleyicisinden stok düzeltmesi",reference:"variant-editor",actorEmail:user.email});
  return Response.json({variant});
}

export async function DELETE(request:Request){if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});const id=Number(new URL(request.url).searchParams.get("id"));if(!id)return Response.json({error:"Geçersiz varyant"},{status:400});await getDb().delete(productVariants).where(eq(productVariants.id,id));return Response.json({ok:true});}
