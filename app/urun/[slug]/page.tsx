import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { products, productVariants } from "../../../db/schema";
import {availableVariants,sellableStock} from "../../catalog-availability";
import ProductDetail from "./product-detail";
import "./product-detail.css";

export const dynamic = "force-dynamic";
const origin="https://mysa-objets-store.robologai.chatgpt.site";

async function findProduct(slug:string){
  try{return (await getDb().select().from(products).where(and(eq(products.slug,decodeURIComponent(slug)),eq(products.active,true))).limit(1))[0]??null;}catch{return null;}
}

export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{
  const {slug}=await params;const product=await findProduct(slug);
  if(!product)return{title:"Ürün bulunamadı — MYSA OBJETS",robots:{index:false,follow:false}};
  const title=`${product.nameTr} — MYSA OBJETS`;const description=(product.descriptionTr||`${product.nameTr}, MYSA OBJETS seçkisinde.`).slice(0,160);const url=`/urun/${encodeURIComponent(product.slug)}`;
  return{title,description,alternates:{canonical:url},openGraph:{type:"website",title,description,url,images:product.imageUrl?[{url:product.imageUrl,alt:product.nameTr}]:[]},twitter:{card:"summary_large_image",title,description,images:product.imageUrl?[product.imageUrl]:[]}};
}

export default async function ProductPage({ params }:{ params:Promise<{slug:string}> }) {
  const {slug}=await params;const product=await findProduct(slug);
  const variants=product?availableVariants(await getDb().select().from(productVariants).where(and(eq(productVariants.productId,product.id),eq(productVariants.active,true)))):[];const stock=product?sellableStock(product.stock,variants):0;
  const offer=product&&product.priceTr>0?{offers:{"@type":"Offer",priceCurrency:"TRY",price:product.priceTr,availability:`https://schema.org/${stock>0?"InStock":"OutOfStock"}`,url:`${origin}/urun/${encodeURIComponent(product.slug)}`}}:{};
  const structured=product?{"@context":"https://schema.org","@type":"Product",name:product.nameTr,description:product.descriptionTr||undefined,image:product.imageUrl?[product.imageUrl]:undefined,sku:`MYSA-${product.id}`,...offer}:null;
  return <>{structured&&<script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structured).replaceAll("<","\\u003c")}}/>}<ProductDetail slug={slug}/></>;
}
