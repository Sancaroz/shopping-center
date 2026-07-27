import { getDb } from "../../../../db";
import { categories, inventoryMovements, products, productVariants } from "../../../../db/schema";
import { recordAudit } from "../../../audit-log";
import { catalogQuality } from "../../../catalog-quality";
import { getChatGPTUser } from "../../../chatgpt-auth";
import { isCatalogImageUrl, parseCatalogMoney, parseCatalogStock } from "../../../catalog-input";

function parseCsv(input:string){const text=input.replace(/^\uFEFF/,"");const firstLine=text.split(/\r?\n/,1)[0]??"";const delimiter=(firstLine.match(/;/g)?.length??0)>(firstLine.match(/,/g)?.length??0)?";":",";const rows:string[][]=[];let row:string[]=[];let cell="";let quoted=false;for(let index=0;index<text.length;index++){const char=text[index];if(char==='"'){if(quoted&&text[index+1]==='"'){cell+='"';index++;}else quoted=!quoted;}else if(char===delimiter&&!quoted){row.push(cell.trim());cell="";}else if((char==='\n'||char==='\r')&&!quoted){if(char==='\r'&&text[index+1]==='\n')index++;row.push(cell.trim());if(row.some(Boolean))rows.push(row);row=[];cell="";}else cell+=char;}row.push(cell.trim());if(row.some(Boolean))rows.push(row);if(rows.length<2)return[];const headers=rows[0].map(value=>value.trim());return rows.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??""])));}
const bool=(value:string,fallback:boolean)=>value.trim()===""?fallback:["1","true","evet","yes","aktif"].includes(value.trim().toLocaleLowerCase("tr-TR"));
const numeric=(value:unknown)=>String(value??"").trim().replaceAll(" ","").replace(",",".");
const csvCell=(value:unknown)=>`"${String(value).replaceAll('"','""')}"`;

export async function GET(){if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});const sample={nameTr:"Organik Havlu",nameEn:"Organic Towel",slug:"organik-havlu",descriptionTr:"Ürün açıklaması",descriptionEn:"Product description",categorySlug:"banyo-ev",imageUrl:"https://...",priceTr:499,priceGlobal:24,stock:20,marketTr:"Evet",marketGlobal:"Evet",active:"Hayır"};const headers=Object.keys(sample);const csv=`\uFEFF${headers.map(csvCell).join(",")}\r\n${Object.values(sample).map(csvCell).join(",")}`;return new Response(csv,{headers:{"Content-Type":"text/csv; charset=utf-8","Content-Disposition":"attachment; filename=urun-yukleme-sablonu.csv","Cache-Control":"no-store"}});}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const form=await request.formData();const file=form.get("file");
  if(!(file instanceof File)||!file.size)return Response.json({error:"CSV dosyası seçin."},{status:400});
  if(file.size>2_000_000)return Response.json({error:"Dosya 2 MB sınırını aşıyor."},{status:413});
  const rows=parseCsv(await file.text());if(!rows.length)return Response.json({error:"CSV içinde ürün satırı bulunamadı."},{status:400});
  if(rows.length>250)return Response.json({error:"Tek seferde en fazla 250 ürün aktarabilirsiniz."},{status:400});

  const db=getDb();
  const[categoryRows,productRows,variantRows]=await Promise.all([db.select().from(categories),db.select().from(products),db.select().from(productVariants)]);
  const categoryMap=new Map(categoryRows.map(category=>[category.slug,category]));
  const existing=new Map(productRows.map(product=>[product.slug,product]));
  const seen=new Set<string>();let created=0;let updated=0;let skipped=0;let forcedDraft=0;const errors:string[]=[];const warnings:string[]=[];

  for(let index=0;index<rows.length;index++){
    const source=rows[index];const line=index+2;
    const nameTr=String(source.nameTr??"").trim();const nameEn=String(source.nameEn??"").trim();const slug=String(source.slug??"").trim().toLocaleLowerCase("en-US");const categorySlug=String(source.categorySlug??"").trim();const imageUrl=String(source.imageUrl??"").trim();
    if(!nameTr){errors.push(`${line}. satır: Türkçe ürün adı eksik.`);skipped++;continue;}
    if(nameTr.length>200||nameEn.length>200){errors.push(`${line}. satır: Ürün adı 200 karakteri aşıyor.`);skipped++;continue;}
    if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||slug.length>160){errors.push(`${line}. satır: Ürün kodu yalnızca küçük harf, rakam ve tire içermeli.`);skipped++;continue;}
    if(seen.has(slug)){errors.push(`${line}. satır: ${slug} dosya içinde birden fazla kez bulunuyor.`);skipped++;continue;}seen.add(slug);
    if(categorySlug&&!categoryMap.has(categorySlug)){errors.push(`${line}. satır: ${categorySlug} kategori kodu bulunamadı.`);skipped++;continue;}
    if(!isCatalogImageUrl(imageUrl)){errors.push(`${line}. satır: Görsel bağlantısı güvenli bir HTTPS veya site içi adres olmalı.`);skipped++;continue;}
    const current=existing.get(slug);const requestedActive=bool(String(source.active??""),current?.active??false);const category=categorySlug?categoryMap.get(categorySlug)!:null;
    const priceTr=parseCatalogMoney(numeric(source.priceTr));const priceGlobal=parseCatalogMoney(numeric(source.priceGlobal));const stock=parseCatalogStock(numeric(source.stock));if(priceTr===null||priceGlobal===null||stock===null){errors.push(`${line}. satır: Fiyat veya stok değeri geçersiz ya da izin verilen sınırı aşıyor.`);skipped++;continue;}
    const values={nameTr,nameEn,slug,descriptionTr:String(source.descriptionTr??"").trim().slice(0,10_000),descriptionEn:String(source.descriptionEn??"").trim().slice(0,10_000),categoryId:category?.id??null,imageUrl,priceTr,priceGlobal,stock:current?.stock??stock,marketTr:bool(String(source.marketTr??""),current?.marketTr??true),marketGlobal:bool(String(source.marketGlobal??""),current?.marketGlobal??false),active:requestedActive,updatedAt:new Date().toISOString()};
    if(current&&stock!==current.stock)warnings.push(`${line}. satır: Mevcut ürün stoğu korunarak diğer alanlar güncellendi; stok değişikliğini Stok Merkezi'nden kaydedin.`);
    if(requestedActive){const variants=current?variantRows.filter(variant=>variant.productId===current.id):[];const issues=catalogQuality(values as Parameters<typeof catalogQuality>[0],variants,[],category?.active).blockers;if(issues.length){values.active=false;forcedDraft++;warnings.push(`${line}. satır: ${nameTr} taslak kaydedildi (${issues.join(", ")}).`);}}
    let product:typeof products.$inferSelect;
    try{[product]=await db.insert(products).values(values).onConflictDoUpdate({target:products.slug,set:values}).returning();if(current)updated++;else created++;existing.set(slug,product);}catch{errors.push(`${line}. satır: Ürün kaydedilemedi.`);skipped++;continue;}
    const previousStock=current?.stock??0;const delta=product.stock-previousStock;
    if(delta!==0)try{await db.insert(inventoryMovements).values({productId:product.id,movementType:current?"correction":"opening",quantityDelta:delta,previousStock,nextStock:product.stock,reason:"CSV ürün aktarımı",reference:`csv-import:${line}`,actorEmail:user.email});}catch{warnings.push(`${line}. satır: Ürün kaydedildi ancak stok hareketi ayrıca kontrol edilmeli.`);}
  }
  if(created||updated)await recordAudit({user,action:"product.import",entityType:"product",summary:`CSV aktarımı: ${created} yeni, ${updated} güncellenen, ${forcedDraft} güvenli taslak.`,after:{fileName:file.name,created,updated,skipped,forcedDraft,warnings:warnings.slice(0,30)}});
  return Response.json({created,updated,skipped,forcedDraft,errors:errors.slice(0,30),warnings:warnings.slice(0,30)});
}
