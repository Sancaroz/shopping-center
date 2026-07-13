"use client";

import { useEffect,useMemo,useState } from "react";
import "./cart-notice.css";
type Product={id:number;slug:string;nameTr:string;descriptionTr:string;imageUrl:string;priceTr:number;priceGlobal:number;stock:number;marketTr:boolean;marketGlobal:boolean;active:boolean};
type Variant={id:number;productId:number;optionName:string;optionValue:string;sku:string;stock:number;priceAdjustment:number};

export default function ProductDetail({slug}:{slug:string}){
  const [product,setProduct]=useState<Product|null>(null);const [variants,setVariants]=useState<Variant[]>([]);const [selected,setSelected]=useState<number|null>(null);const [market,setMarket]=useState<"TR"|"GLOBAL">("TR");const [status,setStatus]=useState("Yükleniyor…");
  useEffect(()=>{Promise.all([fetch("/api/products").then(r=>r.json()),fetch("/api/variants").then(r=>r.json())]).then(([p,v])=>{const found=(p.products??[]).find((item:Product)=>item.slug===decodeURIComponent(slug)&&item.active);setProduct(found??null);if(found){const own=(v.variants??[]).filter((item:Variant)=>item.productId===found.id);setVariants(own);setSelected(own[0]?.id??null);setStatus("");}else setStatus("Ürün bulunamadı.");}).catch(()=>setStatus("Ürün yüklenemedi."));},[slug]);
  const choice=useMemo(()=>variants.find(v=>v.id===selected),[variants,selected]);
  async function addToCart(){
    if(!product)return;
    const response=await fetch("/api/cart",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:product.id,variantId:choice?.id??null,quantity:1,market})});
    setStatus(response.ok?"Ürün çantanıza eklendi.":"Ürün eklenemedi.");
  }
  if(!product)return <main className="detail-state"><a href="/">← Mağazaya dön</a><p>{status}</p></main>;
  const base=market==="TR"?product.priceTr:product.priceGlobal;const total=base+(choice?.priceAdjustment??0);const currency=market==="TR"?"TL":"€";
  return <main className="detail-page"><header className="detail-header"><a className="detail-brand" href="/">MYSA <span>OBJETS</span></a><div><a href="/">Mağazaya dön ↗</a><a href="/sepet">Çanta ↗</a></div></header><section className="detail-grid"><div className="detail-image"><img src={product.imageUrl||"https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=1200&q=88"} alt={product.nameTr}/></div><div className="detail-copy"><p className="detail-eyebrow">SEÇKİLİ ÜRÜN</p><h1>{product.nameTr}</h1><p className="detail-description">{product.descriptionTr||"Bu ürün için ayrıntılı açıklama yakında eklenecek."}</p><div className="detail-market"><button className={market==="TR"?"active":""} disabled={!product.marketTr} onClick={()=>setMarket("TR")}>Türkiye</button><button className={market==="GLOBAL"?"active":""} disabled={!product.marketGlobal} onClick={()=>setMarket("GLOBAL")}>Global</button></div>{variants.length>0&&<div className="detail-options"><label>{variants[0].optionName}</label><div>{variants.map(variant=><button key={variant.id} className={selected===variant.id?"active":""} disabled={variant.stock<1} onClick={()=>setSelected(variant.id)}>{variant.optionValue}</button>)}</div></div>}<div className="detail-price"><strong>{market==="TR"?`${total.toLocaleString("tr-TR")} ${currency}`:`${currency}${total}`}</strong><span>{choice?`${choice.stock} adet mevcut`:product.stock>0?`${product.stock} adet mevcut`:"Tükendi"}</span></div><button className="detail-cart" onClick={addToCart} disabled={(choice?.stock??product.stock)<1}>Çantaya ekle</button>{status&&<p className="detail-notice">{status} {status.includes("eklendi")&&<a href="/sepet">Çantayı görüntüle →</a>}</p>}<div className="detail-services"><span>Güvenli ödeme</span><span>Özenli paketleme</span><span>Kolay iade</span></div></div></section></main>;
}
