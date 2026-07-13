import { env } from "cloudflare:workers";
import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { productImages, products } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

type MediaBucket = { delete(key:string):Promise<unknown> };

export async function GET(request:Request) {
  const productId=Number(new URL(request.url).searchParams.get("productId"));
  const db=getDb();
  const rows=productId?await db.select().from(productImages).where(eq(productImages.productId,productId)).orderBy(asc(productImages.sortOrder),asc(productImages.id)):await db.select().from(productImages).orderBy(asc(productImages.sortOrder),asc(productImages.id));
  return Response.json({ images:rows });
}

export async function POST(request:Request) {
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json() as {productId?:number;imageUrl?:string;altText?:string;sortOrder?:number};
  if(!body.productId||!body.imageUrl)return Response.json({error:"Ürün ve görsel zorunludur."},{status:400});
  const[image]=await getDb().insert(productImages).values({productId:Number(body.productId),imageUrl:String(body.imageUrl),altText:String(body.altText??""),sortOrder:Number(body.sortOrder??0)}).returning();
  return Response.json({image},{status:201});
}

export async function PATCH(request:Request) {
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json() as {id?:number;sortOrder?:number;altText?:string};
  if(!body.id)return Response.json({error:"Geçersiz görsel"},{status:400});
  const updates:Partial<typeof productImages.$inferInsert>={};if(body.sortOrder!==undefined)updates.sortOrder=Number(body.sortOrder);if(body.altText!==undefined)updates.altText=String(body.altText);
  const[image]=await getDb().update(productImages).set(updates).where(eq(productImages.id,Number(body.id))).returning();
  return Response.json({image});
}

export async function DELETE(request:Request) {
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const url=new URL(request.url);const id=Number(url.searchParams.get("id"));const productId=Number(url.searchParams.get("productId"));
  if(!id||!productId)return Response.json({error:"Geçersiz görsel"},{status:400});
  const db=getDb();const[image]=await db.select().from(productImages).where(and(eq(productImages.id,id),eq(productImages.productId,productId))).limit(1);if(!image)return Response.json({error:"Görsel bulunamadı"},{status:404});
  await db.delete(productImages).where(eq(productImages.id,id));
  const[product]=await db.select().from(products).where(eq(products.id,productId)).limit(1);if(product?.imageUrl===image.imageUrl)await db.update(products).set({imageUrl:"",updatedAt:new Date().toISOString()}).where(eq(products.id,productId));
  if(image.imageUrl.startsWith("/api/media/")){const key=decodeURIComponent(image.imageUrl.slice("/api/media/".length));const bucket=(env as unknown as {MEDIA?:MediaBucket}).MEDIA;await bucket?.delete(key);}
  return Response.json({ok:true});
}
