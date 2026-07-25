import type { MetadataRoute } from "next";
import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { products } from "../db/schema";

const origin="https://mysa-objets-store.robologai.chatgpt.site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticPaths=["","/magaza","/siparis-takip","/iletisim","/politikalar"];
  const entries:MetadataRoute.Sitemap=staticPaths.map(path=>({url:`${origin}${path}`,changeFrequency:path===""?"weekly":"monthly",priority:path===""?1:0.7}));
  try{
    const rows=await getDb().select({slug:products.slug,updatedAt:products.updatedAt}).from(products).where(eq(products.active,true));
    entries.push(...rows.map(row=>({url:`${origin}/urun/${encodeURIComponent(row.slug)}`,lastModified:new Date(row.updatedAt),changeFrequency:"weekly" as const,priority:0.8})));
  }catch{}
  return entries;
}
