import {asc,eq} from "drizzle-orm";
import {getDb} from "../../../db";
import {inventoryMovements,productVariants} from "../../../db/schema";
import {recordAudit} from "../../audit-log";
import {getChatGPTUser} from "../../chatgpt-auth";

export const dynamic="force-dynamic";

export async function GET(){
  try{
    const db=getDb();
    const user=await getChatGPTUser();
    const variants=user?await db.select().from(productVariants).orderBy(asc(productVariants.productId),asc(productVariants.id)):await db.select().from(productVariants).where(eq(productVariants.active,true)).orderBy(asc(productVariants.productId),asc(productVariants.id));
    return Response.json({variants});
  }catch{return Response.json({variants:[]});}
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json() as Record<string,unknown>;const productId=Number(body.productId);const sku=String(body.sku??"").trim();const optionName=String(body.optionName??"").trim();const optionValue=String(body.optionValue??"").trim();const stock=Number(body.stock??0);
  if(!productId||!sku||!optionName||!optionValue)return Response.json({error:"Ürün, seçenek, değer ve ürün kodu zorunludur."},{status:400});
  if(!Number.isInteger(stock)||stock<0)return Response.json({error:"Stok sıfır veya pozitif tam sayı olmalıdır."},{status:400});
  const db=getDb();const[variant]=await db.insert(productVariants).values({productId,sku,optionName,optionValue,optionNameEn:String(body.optionNameEn??"").trim(),optionValueEn:String(body.optionValueEn??"").trim(),stock,priceAdjustment:Number(body.priceAdjustment??0),active:true}).returning();
  if(stock>0)await db.insert(inventoryMovements).values({productId,variantId:variant.id,movementType:"opening",quantityDelta:stock,previousStock:0,nextStock:stock,reason:"Varyant açılış stoğu",reference:"variant-create",actorEmail:user.email});
  await recordAudit({user,action:"variant.create",entityType:"variant",entityId:variant.id,summary:`${variant.sku} varyantı oluşturuldu.`,after:variant});
  return Response.json({variant},{status:201});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json() as Record<string,unknown>;const id=Number(body.id);if(!id)return Response.json({error:"Geçersiz varyant"},{status:400});
  const db=getDb();const[before]=await db.select().from(productVariants).where(eq(productVariants.id,id)).limit(1);if(!before)return Response.json({error:"Varyant bulunamadı"},{status:404});
  const updates:Partial<typeof productVariants.$inferInsert>={};if(body.productId!==undefined)updates.productId=Number(body.productId);if(body.sku!==undefined)updates.sku=String(body.sku).trim();if(body.optionName!==undefined)updates.optionName=String(body.optionName).trim();if(body.optionValue!==undefined)updates.optionValue=String(body.optionValue).trim();if(body.optionNameEn!==undefined)updates.optionNameEn=String(body.optionNameEn).trim();if(body.optionValueEn!==undefined)updates.optionValueEn=String(body.optionValueEn).trim();if(body.stock!==undefined){const stock=Number(body.stock);if(!Number.isInteger(stock)||stock<0)return Response.json({error:"Stok sıfır veya pozitif tam sayı olmalıdır."},{status:400});updates.stock=stock;}if(body.priceAdjustment!==undefined)updates.priceAdjustment=Number(body.priceAdjustment);if(body.active!==undefined)updates.active=Boolean(body.active);
  const[variant]=await db.update(productVariants).set(updates).where(eq(productVariants.id,id)).returning();
  if(updates.stock!==undefined&&updates.stock!==before.stock)await db.insert(inventoryMovements).values({productId:variant.productId,variantId:id,movementType:"correction",quantityDelta:updates.stock-before.stock,previousStock:before.stock,nextStock:updates.stock,reason:"Varyant düzenleyicisinden stok düzeltmesi",reference:"variant-editor",actorEmail:user.email});
  await recordAudit({user,action:"variant.update",entityType:"variant",entityId:id,summary:`${variant.sku} varyantı güncellendi.`,before,after:variant});
  return Response.json({variant});
}

export async function DELETE(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const id=Number(new URL(request.url).searchParams.get("id"));if(!id)return Response.json({error:"Geçersiz varyant"},{status:400});
  const db=getDb();const[before]=await db.select().from(productVariants).where(eq(productVariants.id,id)).limit(1);if(!before)return Response.json({error:"Varyant bulunamadı"},{status:404});
  const[variant]=await db.update(productVariants).set({active:false}).where(eq(productVariants.id,id)).returning();
  await recordAudit({user,action:"variant.archive",entityType:"variant",entityId:id,summary:`${before.sku} varyantı, stok geçmişi korunarak arşivlendi.`,before:{active:before.active},after:{active:false}});
  return Response.json({ok:true,archived:true,variant});
}
