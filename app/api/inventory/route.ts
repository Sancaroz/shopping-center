import {and,desc,eq,gte,sql} from "drizzle-orm";
import {getDb} from "../../../db";
import {inventoryMovements,products,productVariants} from "../../../db/schema";
import {recordAudit} from "../../audit-log";
import {getChatGPTUser} from "../../chatgpt-auth";

export async function GET(){
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const db=getDb();const[productRows,variantRows,movements]=await Promise.all([db.select().from(products).orderBy(desc(products.id)),db.select().from(productVariants),db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.id)).limit(300)]);
  return Response.json({products:productRows,variants:variantRows,movements},{headers:{"Cache-Control":"no-store"}});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;const productId=Number(body?.productId);
  if(!productId)return Response.json({error:"Geçersiz ürün."},{status:400});
  const sourcingType=String(body?.sourcingType??"");if(!["factory","handmade"].includes(sourcingType))return Response.json({error:"Üretim türü fabrika veya el işçiliği olmalıdır."},{status:400});
  const unitCost=Number(body?.unitCost);const leadTimeDays=Number(body?.leadTimeDays);const reorderPoint=Number(body?.reorderPoint);
  if(!Number.isFinite(unitCost)||unitCost<0||!Number.isInteger(leadTimeDays)||leadTimeDays<0||leadTimeDays>365||!Number.isInteger(reorderPoint)||reorderPoint<0)return Response.json({error:"Maliyet, termin ve kritik stok değerlerini kontrol edin."},{status:400});
  const db=getDb();const[product]=await db.update(products).set({sourcingType,supplierName:String(body?.supplierName??"").trim().slice(0,160),supplierContact:String(body?.supplierContact??"").trim().slice(0,240),supplierSku:String(body?.supplierSku??"").trim().slice(0,100),unitCost,leadTimeDays,reorderPoint,updatedAt:new Date().toISOString()}).where(eq(products.id,productId)).returning();
  if(!product)return Response.json({error:"Ürün bulunamadı."},{status:404});
  await recordAudit({user,action:"inventory.profile.update",entityType:"product",entityId:productId,summary:`${product.nameTr} tedarik bilgileri güncellendi.`,after:{sourcingType,supplierName:product.supplierName,unitCost,leadTimeDays,reorderPoint}});
  return Response.json({product});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;const productId=Number(body?.productId);const variantId=Number(body?.variantId)||null;const delta=Number(body?.quantityDelta);const movementType=String(body?.movementType??"");
  if(!productId||!Number.isInteger(delta)||delta===0||Math.abs(delta)>100000||!["purchase","production","correction","damage","return"].includes(movementType))return Response.json({error:"Geçerli ürün, hareket türü ve sıfırdan farklı adet zorunludur."},{status:400});
  const reason=String(body?.reason??"").trim().slice(0,500);if(reason.length<3)return Response.json({error:"Stok hareketi için kısa bir açıklama zorunludur."},{status:400});
  const db=getDb();let nextStock:number|undefined;
  if(variantId){const[row]=await db.update(productVariants).set({stock:sql`${productVariants.stock} + ${delta}`}).where(delta<0?and(eq(productVariants.id,variantId),eq(productVariants.productId,productId),gte(productVariants.stock,-delta)):and(eq(productVariants.id,variantId),eq(productVariants.productId,productId))).returning({stock:productVariants.stock});nextStock=row?.stock;}
  else{const[row]=await db.update(products).set({stock:sql`${products.stock} + ${delta}`,updatedAt:new Date().toISOString()}).where(delta<0?and(eq(products.id,productId),gte(products.stock,-delta)):eq(products.id,productId)).returning({stock:products.stock});nextStock=row?.stock;}
  if(nextStock===undefined)return Response.json({error:"Ürün bulunamadı veya stok sıfırın altına düşemez."},{status:409});
  const[movement]=await db.insert(inventoryMovements).values({productId,variantId,movementType,quantityDelta:delta,previousStock:nextStock-delta,nextStock,reason,reference:String(body?.reference??"").trim().slice(0,120),actorEmail:user.email}).returning();
  await recordAudit({user,action:"inventory.adjust",entityType:variantId?"variant":"product",entityId:variantId??productId,summary:`Stok ${delta>0?"artırıldı":"azaltıldı"}: ${delta>0?"+":""}${delta}.`,before:{stock:nextStock-delta},after:{stock:nextStock,movementType,reason}});
  return Response.json({movement,nextStock},{status:201});
}
