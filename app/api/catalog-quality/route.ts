import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { categories, productImages, products, productVariants } from "../../../db/schema";
import { catalogQuality } from "../../catalog-quality";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic="force-dynamic";

export async function GET(){
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const db=getDb();
  const[productRows,variantRows,imageRows,categoryRows]=await Promise.all([
    db.select().from(products).orderBy(desc(products.id)),db.select().from(productVariants),db.select().from(productImages),db.select().from(categories),
  ]);
  const categoryMap=new Map(categoryRows.map(category=>[category.id,category]));
  const items=productRows.map(product=>{
    const category=product.categoryId?categoryMap.get(product.categoryId):undefined;
    const quality=catalogQuality(product,variantRows.filter(variant=>variant.productId===product.id),imageRows.filter(image=>image.productId===product.id),category?.active);
    return{id:product.id,name:product.nameTr,slug:product.slug,active:product.active,featured:product.featured,marketTr:product.marketTr,marketGlobal:product.marketGlobal,category:category?.nameTr??"Kategori yok",updatedAt:product.updatedAt,...quality};
  });
  return Response.json({generatedAt:new Date().toISOString(),summary:{total:items.length,active:items.filter(item=>item.active).length,draft:items.filter(item=>!item.active).length,ready:items.filter(item=>item.ready).length,blocked:items.filter(item=>!item.ready).length,warnings:items.filter(item=>item.warnings.length>0).length},items});
}
