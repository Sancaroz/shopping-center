import { eq } from "drizzle-orm";
import { getDb } from "../db";
import { categories, homepageBlocks, productImages, products, storeSettings } from "../db/schema";

const usageLabels={product:"ürün",category:"kategori",gallery:"ürün galerisi",setting:"site ayarı",homepageBlock:"ana sayfa bloğu"} as const;
export type MediaUsage=typeof usageLabels[keyof typeof usageLabels];

export function mediaUrl(key:string) {
  return `/api/media/${encodeURIComponent(key)}`;
}

export function mediaKeyFromUrl(imageUrl:string) {
  if(!imageUrl.startsWith("/api/media/"))return null;
  try {
    const key=decodeURIComponent(imageUrl.slice("/api/media/".length));
    return /^products\/[a-zA-Z0-9._-]+$/.test(key)&&!key.includes("..")?key:null;
  } catch { return null; }
}

export async function findMediaUsage(imageUrl:string):Promise<MediaUsage[]> {
  const db=getDb();
  const [product,category,gallery,setting,homepageBlock]=await Promise.all([
    db.select({id:products.id}).from(products).where(eq(products.imageUrl,imageUrl)).limit(1),
    db.select({id:categories.id}).from(categories).where(eq(categories.imageUrl,imageUrl)).limit(1),
    db.select({id:productImages.id}).from(productImages).where(eq(productImages.imageUrl,imageUrl)).limit(1),
    db.select({key:storeSettings.key}).from(storeSettings).where(eq(storeSettings.value,imageUrl)).limit(1),
    db.select({id:homepageBlocks.id}).from(homepageBlocks).where(eq(homepageBlocks.imageUrl,imageUrl)).limit(1),
  ]);
  return [product.length&&usageLabels.product,category.length&&usageLabels.category,gallery.length&&usageLabels.gallery,setting.length&&usageLabels.setting,homepageBlock.length&&usageLabels.homepageBlock].filter(Boolean) as MediaUsage[];
}

export async function listMediaUsage() {
  const db=getDb();
  const [productRows,categoryRows,galleryRows,settingRows,blockRows]=await Promise.all([
    db.select({url:products.imageUrl}).from(products),
    db.select({url:categories.imageUrl}).from(categories),
    db.select({url:productImages.imageUrl}).from(productImages),
    db.select({url:storeSettings.value}).from(storeSettings),
    db.select({url:homepageBlocks.imageUrl}).from(homepageBlocks),
  ]);
  const usage=new Map<string,Set<MediaUsage>>();
  const add=(rows:{url:string}[],label:MediaUsage)=>rows.forEach(({url})=>{if(!mediaKeyFromUrl(url))return;const labels=usage.get(url)??new Set<MediaUsage>();labels.add(label);usage.set(url,labels);});
  add(productRows,usageLabels.product);add(categoryRows,usageLabels.category);add(galleryRows,usageLabels.gallery);add(settingRows,usageLabels.setting);add(blockRows,usageLabels.homepageBlock);
  return new Map([...usage].map(([url,labels])=>[url,[...labels]]));
}
