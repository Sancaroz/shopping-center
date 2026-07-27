import {and,desc,eq,gte,isNull,lte,sql} from "drizzle-orm";
import {getDb} from "../../../db";
import {inventoryMovements,products,productVariants} from "../../../db/schema";
import {recordAudit} from "../../audit-log";
import {getChatGPTUser} from "../../chatgpt-auth";
import {containsLikelyCardNumber,readBoundedJson} from "../../public-form-security";

const MAX_STOCK=1_000_000;

export async function GET(){
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const db=getDb();const[productRows,variantRows,movements]=await Promise.all([db.select().from(products).orderBy(desc(products.id)),db.select().from(productVariants),db.select().from(inventoryMovements).orderBy(desc(inventoryMovements.id)).limit(300)]);
  return Response.json({products:productRows,variants:variantRows,movements},{headers:{"Cache-Control":"no-store"}});
}

export async function PATCH(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const parsed=await readBoundedJson(request,5_000);if(parsed.error)return parsed.error;const body=parsed.body!;const productId=Number(body.productId);
  if(!Number.isInteger(productId)||productId<1)return Response.json({error:"Geçersiz ürün."},{status:400});
  const sourcingType=String(body.sourcingType??"");if(!["factory","handmade"].includes(sourcingType))return Response.json({error:"Üretim türü fabrika veya el işçiliği olmalıdır."},{status:400});
  const unitCost=Number(body.unitCost);const leadTimeDays=Number(body.leadTimeDays);const reorderPoint=Number(body.reorderPoint);const supplierName=String(body.supplierName??"").trim();const supplierContact=String(body.supplierContact??"").trim();const supplierSku=String(body.supplierSku??"").trim();
  if(!Number.isFinite(unitCost)||unitCost<0||unitCost>1_000_000_000||!Number.isInteger(leadTimeDays)||leadTimeDays<0||leadTimeDays>365||!Number.isInteger(reorderPoint)||reorderPoint<0||reorderPoint>MAX_STOCK)return Response.json({error:"Maliyet, termin ve kritik stok değerlerini kontrol edin."},{status:400});if(supplierName.length>160||supplierContact.length>240||supplierSku.length>100)return Response.json({error:"Tedarik profili alanlarından biri izin verilen uzunluğu aşıyor."},{status:400});
  const db=getDb();const[product]=await db.update(products).set({sourcingType,supplierName,supplierContact,supplierSku,unitCost,leadTimeDays,reorderPoint,updatedAt:new Date().toISOString()}).where(and(eq(products.id,productId),eq(products.active,true))).returning();
  if(!product)return Response.json({error:"Ürün bulunamadı."},{status:404});
  await recordAudit({user,action:"inventory.profile.update",entityType:"product",entityId:productId,summary:`${product.nameTr} tedarik bilgileri güncellendi.`,after:{sourcingType,supplierName:product.supplierName,unitCost,leadTimeDays,reorderPoint}});
  return Response.json({product});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const parsed=await readBoundedJson(request,5_000);if(parsed.error)return parsed.error;const body=parsed.body!;const productId=Number(body.productId);const rawVariantId=body.variantId===undefined||body.variantId===""?null:Number(body.variantId);const variantId=rawVariantId;const delta=Number(body.quantityDelta);const movementType=String(body.movementType??"");
  if(!Number.isInteger(productId)||productId<1||(variantId!==null&&(!Number.isInteger(variantId)||variantId<1))||!Number.isInteger(delta)||delta===0||Math.abs(delta)>100000||!["purchase","production","correction","damage","return"].includes(movementType))return Response.json({error:"Geçerli ürün, hareket türü ve sıfırdan farklı adet zorunludur."},{status:400});
  if(["purchase","production","return"].includes(movementType)&&delta<0)return Response.json({error:"Tedarik, üretim ve müşteri iadesi stok miktarını artırmalıdır."},{status:400});if(movementType==="damage"&&delta>0)return Response.json({error:"Hasar veya fire kaydı stok miktarını azaltmalıdır."},{status:400});
  const reason=String(body.reason??"").trim();const movementReference=String(body.reference??"").trim();if(reason.length<10||reason.length>500)return Response.json({error:"Stok hareketi için kısa bir açıklama zorunludur; 10–500 karakter kullanın."},{status:400});if(movementReference.length<3||movementReference.length>120)return Response.json({error:"Her manuel stok hareketi için 3–120 karakterlik benzersiz referans zorunludur."},{status:400});if(containsLikelyCardNumber(reason))return Response.json({error:"Stok açıklamasına kart numarası veya benzeri hassas ödeme verisi yazmayın."},{status:400});
  const db=getDb();const[activeProduct]=await db.select({id:products.id}).from(products).where(and(eq(products.id,productId),eq(products.active,true))).limit(1);if(!activeProduct)return Response.json({error:"Ürün bulunamadı veya arşivde."},{status:404});const[duplicate]=await db.select({id:inventoryMovements.id}).from(inventoryMovements).where(and(eq(inventoryMovements.productId,productId),variantId===null?isNull(inventoryMovements.variantId):eq(inventoryMovements.variantId,variantId),eq(inventoryMovements.movementType,movementType),eq(inventoryMovements.reference,movementReference))).limit(1);if(duplicate)return Response.json({error:"Bu stok kalemi, hareket türü ve referans daha önce işlendi."},{status:409});let nextStock:number|undefined;
  if(variantId){const[row]=await db.update(productVariants).set({stock:sql`${productVariants.stock} + ${delta}`}).where(and(eq(productVariants.id,variantId),eq(productVariants.productId,productId),eq(productVariants.active,true),delta<0?gte(productVariants.stock,-delta):lte(productVariants.stock,MAX_STOCK-delta))).returning({stock:productVariants.stock});nextStock=row?.stock;}
  else{const[row]=await db.update(products).set({stock:sql`${products.stock} + ${delta}`,updatedAt:new Date().toISOString()}).where(and(eq(products.id,productId),eq(products.active,true),delta<0?gte(products.stock,-delta):lte(products.stock,MAX_STOCK-delta))).returning({stock:products.stock});nextStock=row?.stock;}
  if(nextStock===undefined)return Response.json({error:"Ürün bulunamadı veya stok sıfırın altına düşemez."},{status:409});
  let movement;try{[movement]=await db.insert(inventoryMovements).values({productId,variantId,movementType,quantityDelta:delta,previousStock:nextStock-delta,nextStock,reason,reference:movementReference,actorEmail:user.email}).returning();}catch{if(variantId)await db.update(productVariants).set({stock:nextStock-delta}).where(and(eq(productVariants.id,variantId),eq(productVariants.stock,nextStock)));else await db.update(products).set({stock:nextStock-delta,updatedAt:new Date().toISOString()}).where(and(eq(products.id,productId),eq(products.stock,nextStock)));return Response.json({error:"Stok hareketi kaydedilemedi; miktar önceki değerine geri alındı."},{status:500});}
  await recordAudit({user,action:"inventory.adjust",entityType:variantId?"variant":"product",entityId:variantId??productId,summary:`Stok ${delta>0?"artırıldı":"azaltıldı"}: ${delta>0?"+":""}${delta}.`,before:{stock:nextStock-delta},after:{stock:nextStock,movementType,reason}});
  return Response.json({movement,nextStock},{status:201});
}
