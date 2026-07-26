import { asc, eq, inArray } from "drizzle-orm";
import { getDb } from "../../../db";
import { categories, products } from "../../../db/schema";
import { recordAudit } from "../../audit-log";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const db=getDb();
    const user=await getChatGPTUser();
    const rows=user ? await db.select().from(categories).orderBy(asc(categories.sortOrder),asc(categories.id)) : await db.select().from(categories).where(eq(categories.active,true)).orderBy(asc(categories.sortOrder),asc(categories.id));
    return Response.json({categories:rows});
  } catch {
    return Response.json({ categories: [] });
  }
}

export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const body = await request.json() as Record<string, unknown>;
  const nameTr = String(body.nameTr ?? "").trim();
  const slug = String(body.slug ?? "").trim();
  if (!nameTr || !slug) return Response.json({ error: "Kategori adı ve kodu zorunludur." }, { status: 400 });
  const [category] = await getDb().insert(categories).values({ nameTr, nameEn:String(body.nameEn??"").trim(), slug, parentId: Number(body.parentId) || null, imageUrl: String(body.imageUrl ?? ""), sortOrder: Number(body.sortOrder ?? 0) }).returning();
  return Response.json({ category }, { status: 201 });
}

export async function PATCH(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" },{status:401});
  const body=await request.json() as Record<string,unknown>;
  if(Array.isArray(body.order)&&body.order.length){
    const ids=body.order.map(Number).filter(Number.isInteger).filter(id=>id>0).slice(0,100);
    const db=getDb();
    for(const[sortOrder,id]of ids.entries()) await db.update(categories).set({sortOrder}).where(eq(categories.id,id));
    return Response.json({ok:true,updated:ids.length});
  }
  const id=Number(body.id);
  if(!id)return Response.json({error:"Geçersiz kategori"},{status:400});
  const updates:Partial<typeof categories.$inferInsert>={};
  if(body.nameTr!==undefined)updates.nameTr=String(body.nameTr).trim();
  if(body.nameEn!==undefined)updates.nameEn=String(body.nameEn).trim();
  if(body.slug!==undefined)updates.slug=String(body.slug).trim();
  if(body.parentId!==undefined)updates.parentId=Number(body.parentId)||null;
  if(body.imageUrl!==undefined)updates.imageUrl=String(body.imageUrl);
  if(body.sortOrder!==undefined)updates.sortOrder=Number(body.sortOrder)||0;
  if(body.active!==undefined)updates.active=Boolean(body.active);
  const[category]=await getDb().update(categories).set(updates).where(eq(categories.id,id)).returning();
  return Response.json({category});
}

function descendantIds(allCategories: Array<typeof categories.$inferSelect>, rootId:number) {
  const ids=[rootId];
  for(let index=0;index<ids.length;index++) {
    for(const category of allCategories) if(category.parentId===ids[index]&&!ids.includes(category.id)) ids.push(category.id);
  }
  return ids;
}

export async function DELETE(request: Request) {
  const user=await getChatGPTUser();
  if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const id=Number(new URL(request.url).searchParams.get("id"));
  if(!id)return Response.json({error:"Geçersiz kategori"},{status:400});
  const db=getDb();
  const categoryRows=await db.select().from(categories);
  const before=categoryRows.find(category=>category.id===id);
  if(!before)return Response.json({error:"Kategori bulunamadı."},{status:404});
  const ids=descendantIds(categoryRows,id);
  const now=new Date().toISOString();
  const archivedProducts=await db.update(products).set({active:false,marketTr:false,marketGlobal:false,featured:false,updatedAt:now}).where(inArray(products.categoryId,ids)).returning({id:products.id});
  const archivedCategories=await db.update(categories).set({active:false}).where(inArray(categories.id,ids)).returning({id:categories.id});
  await recordAudit({user,action:"category.archive",entityType:"category",entityId:id,summary:`${before.nameTr} kategorisi, alt kategorileri ve bağlı ürünleri arşivlendi.`,before:{active:before.active},after:{active:false,categoryCount:archivedCategories.length,productCount:archivedProducts.length}});
  return Response.json({ok:true,archived:true,categoryCount:archivedCategories.length,productCount:archivedProducts.length});
}
