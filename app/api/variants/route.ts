import { asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { productVariants } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";
export async function GET() { try { return Response.json({ variants: await getDb().select().from(productVariants).orderBy(asc(productVariants.productId), asc(productVariants.id)) }); } catch { return Response.json({ variants: [] }); } }
export async function POST(request:Request) { if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" },{status:401}); const body=await request.json() as Record<string,unknown>; const productId=Number(body.productId); const sku=String(body.sku??"").trim(); const optionName=String(body.optionName??"").trim(); const optionValue=String(body.optionValue??"").trim(); if(!productId||!sku||!optionName||!optionValue)return Response.json({error:"Ürün, seçenek, değer ve ürün kodu zorunludur."},{status:400}); const [variant]=await getDb().insert(productVariants).values({productId,sku,optionName,optionValue,stock:Number(body.stock??0),priceAdjustment:Number(body.priceAdjustment??0)}).returning(); return Response.json({variant},{status:201}); }
export async function DELETE(request:Request) { if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" },{status:401}); const id=Number(new URL(request.url).searchParams.get("id")); if(!id)return Response.json({error:"Geçersiz varyant"},{status:400}); await getDb().delete(productVariants).where(eq(productVariants.id,id)); return Response.json({ok:true}); }
