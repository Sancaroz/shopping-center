import type { productImages, products, productVariants } from "../db/schema";

type Product=typeof products.$inferSelect;
type Variant=typeof productVariants.$inferSelect;
type Image=typeof productImages.$inferSelect;

export function catalogQuality(product:Product,variants:Variant[],images:Image[],categoryActive?:boolean){
  const blockers:string[]=[];const warnings:string[]=[];
  if(!product.nameTr.trim())blockers.push("Türkçe ürün adı eksik");
  if(!product.descriptionTr.trim())blockers.push("Türkçe açıklama eksik");
  if(!product.slug.trim())blockers.push("Ürün adresi eksik");
  else if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(product.slug))blockers.push("Ürün adresi uygun formatta değil");
  if(!product.categoryId)blockers.push("Kategori seçilmemiş");
  else if(categoryActive===false)blockers.push("Kategori yayında değil");
  if(!product.imageUrl.trim())blockers.push("Kapak görseli eksik");
  if(!product.marketTr&&!product.marketGlobal)blockers.push("Satış pazarı seçilmemiş");
  if(product.marketTr&&product.priceTr<=0)blockers.push("Türkiye fiyatı eksik");
  if(product.marketGlobal&&product.priceGlobal<=0)blockers.push("Global fiyat eksik");
  if(product.marketGlobal&&!product.nameEn.trim())blockers.push("İngilizce ürün adı eksik");
  if(product.marketGlobal&&!product.descriptionEn.trim())blockers.push("İngilizce açıklama eksik");
  const sellableStock=variants.length?variants.reduce((sum,variant)=>sum+Math.max(0,variant.stock),0):Math.max(0,product.stock);
  if(sellableStock<1)blockers.push("Satılabilir stok yok");
  if(product.descriptionTr.trim().length>0&&product.descriptionTr.trim().length<100)warnings.push("Türkçe açıklama kısa");
  const uniqueImages=new Set([product.imageUrl,...images.map(image=>image.imageUrl)].filter(Boolean));
  if(uniqueImages.size<2)warnings.push("İkinci ürün görseli önerilir");
  if(images.some(image=>!image.altText.trim()))warnings.push("Galeri görseli alternatif metni eksik");
  if(sellableStock>0&&sellableStock<=5)warnings.push("Stok seviyesi düşük");
  const score=Math.max(0,100-blockers.length*15-warnings.length*5);
  return{blockers,warnings,score,ready:blockers.length===0,sellableStock,imageCount:uniqueImages.size};
}
