"use client";

import { useEffect, useMemo, useState } from "react";
import "./magaza.css";
import {getPreferredMarket,setPreferredMarket} from "../market-preference";

type Market = "TR"|"GLOBAL";
type Product = { id:number; nameTr:string; nameEn:string; descriptionTr:string; descriptionEn:string; slug:string; imageUrl:string; priceTr:number; priceGlobal:number; stock:number; categoryId:number|null; marketTr:boolean; marketGlobal:boolean; active:boolean };
type Category = { id:number; nameTr:string; nameEn:string; slug:string; parentId:number|null; active:boolean };
type Settings = { brandName:string; brandSuffix:string };

export default function CatalogPage() {
  const [products,setProducts] = useState<Product[]>([]);
  const [categories,setCategories] = useState<Category[]>([]);
  const [settings,setSettings] = useState<Settings>({brandName:"MYSA",brandSuffix:"OBJETS"});
  const [market,setMarket] = useState<Market>("TR");
  const [category,setCategory] = useState<number|null>(null);
  const [query,setQuery] = useState("");
  const [sort,setSort] = useState("newest");
  const [cartCount,setCartCount] = useState(0);
  const [notice,setNotice] = useState("");
  const [loading,setLoading] = useState(true);

  useEffect(()=>{
    const preferred=getPreferredMarket();setMarket(preferred);setPreferredMarket(preferred);
    Promise.all([fetch("/api/products").then(r=>r.json()),fetch("/api/categories").then(r=>r.json()),fetch("/api/settings").then(r=>r.json()),fetch("/api/cart").then(r=>r.json())]).then(([p,c,s,cart])=>{
      const categoryRows:Category[]=(c.categories??[]).filter((item:Category)=>item.active!==false);
      setProducts((p.products??[]).filter((item:Product)=>item.active));setCategories(categoryRows);if(s.settings)setSettings(s.settings);setCartCount((cart.items??[]).reduce((sum:number,item:{quantity:number})=>sum+item.quantity,0));
      const slug=new URLSearchParams(window.location.search).get("kategori");if(slug)setCategory(categoryRows.find(item=>item.slug===slug)?.id??null);setLoading(false);
    }).catch(()=>setLoading(false));
  },[]);

  const visible = useMemo(()=>{
    const childIds=category?[category,...categories.filter(item=>item.parentId===category).map(item=>item.id)]:[];
    const needle=query.trim().toLocaleLowerCase("tr-TR");
    const rows=products.filter(product=>(market==="TR"?product.marketTr:product.marketGlobal)&&(!category||childIds.includes(Number(product.categoryId)))&&(!needle||`${market==="GLOBAL"?(product.nameEn||product.nameTr):product.nameTr} ${market==="GLOBAL"?(product.descriptionEn||product.descriptionTr):product.descriptionTr}`.toLocaleLowerCase(market==="TR"?"tr-TR":"en-US").includes(needle)));
    return [...rows].sort((a,b)=>sort==="price-asc"?(market==="TR"?a.priceTr-b.priceTr:a.priceGlobal-b.priceGlobal):sort==="price-desc"?(market==="TR"?b.priceTr-a.priceTr:b.priceGlobal-a.priceGlobal):b.id-a.id);
  },[products,categories,market,category,query,sort]);

  const productName=(product:Product)=>market==="GLOBAL"?(product.nameEn||product.nameTr):product.nameTr;const productDescription=(product:Product)=>market==="GLOBAL"?(product.descriptionEn||product.descriptionTr):product.descriptionTr;const categoryName=(item:Category)=>market==="GLOBAL"?(item.nameEn||item.nameTr):item.nameTr;
  async function addToCart(product:Product){const response=await fetch("/api/cart",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({productId:product.id,quantity:1,market})});const data=await response.json();if(response.ok){setCartCount(count=>count+1);setNotice(market==="GLOBAL"?`${productName(product)} added to your bag`:`${productName(product)} çantanıza eklendi`);window.setTimeout(()=>setNotice(""),2200);}else setNotice(data.error??(market==="GLOBAL"?"Product could not be added":"Ürün eklenemedi"));}
  const money=(product:Product)=>market==="TR"?`${product.priceTr.toLocaleString("tr-TR")} TL`:`€${product.priceGlobal.toLocaleString("en-US")}`;
  const marketProducts=useMemo(()=>products.filter(product=>market==="TR"?product.marketTr:product.marketGlobal),[products,market]);
  const availableCategoryIds=useMemo(()=>{const ids=new Set(marketProducts.map(product=>product.categoryId).filter((id):id is number=>id!==null));categories.forEach(item=>{if(item.parentId&&ids.has(item.id))ids.add(item.parentId);});return ids;},[marketProducts,categories]);
  const marketCategories=categories.filter(item=>availableCategoryIds.has(item.id));
  const roots=marketCategories.filter(item=>!item.parentId);
  const countForCategory=(id:number)=>{const ids=[id,...categories.filter(item=>item.parentId===id).map(item=>item.id)];return marketProducts.filter(product=>product.categoryId!==null&&ids.includes(product.categoryId)).length;};
  const changeMarket=(next:Market)=>{setMarket(next);setCategory(null);setPreferredMarket(next);};

  return <main className="catalog-page">
    <header className="catalog-header"><a className="catalog-brand" href="/">{settings.brandName}<span>{settings.brandSuffix}</span></a><nav><a href="/">{market==="GLOBAL"?"Home":"Ana sayfa"}</a><a className="active" href="/magaza">{market==="GLOBAL"?"Shop":"Mağaza"}</a><a href="/siparis-takip">{market==="GLOBAL"?"Track order":"Sipariş takibi"}</a><a href="/sepet">{market==="GLOBAL"?"Bag":"Çanta"} <b>{cartCount}</b></a></nav></header>
    <section className="catalog-hero"><p>{market==="GLOBAL"?"THE FULL EDIT":"TÜM SEÇKİ"}</p><h1>{market==="GLOBAL"?"Everyday living,":"Gündelik yaşam,"}<br/><em>{market==="GLOBAL"?"carefully curated.":"özenle seçildi."}</em></h1><div className="catalog-market"><button className={market==="TR"?"active":""} onClick={()=>changeMarket("TR")}>Türkiye · TRY</button><button className={market==="GLOBAL"?"active":""} onClick={()=>changeMarket("GLOBAL")}>Global · EUR</button></div></section>
    <section className="catalog-tools">
      <label className="catalog-search"><span>{market==="GLOBAL"?"SEARCH":"ARA"}</span><input value={query} onChange={event=>setQuery(event.target.value)} placeholder={market==="GLOBAL"?"Product name or description…":"Ürün adı veya açıklama…"}/><b>⌕</b></label>
      <label><span>{market==="GLOBAL"?"SORT":"SIRALA"}</span><select value={sort} onChange={event=>setSort(event.target.value)}><option value="newest">{market==="GLOBAL"?"Newest":"En yeniler"}</option><option value="price-asc">{market==="GLOBAL"?"Price: low to high":"Fiyat: düşükten yükseğe"}</option><option value="price-desc">{market==="GLOBAL"?"Price: high to low":"Fiyat: yüksekten düşüğe"}</option></select></label>
    </section>
    <div className="catalog-body">
      <aside className="catalog-filters"><p>{market==="TR"?"KATEGORİLER":"CATEGORIES"}</p><button className={category===null?"active":""} onClick={()=>setCategory(null)}>{market==="TR"?"Tüm ürünler":"All products"} <span>{marketProducts.length}</span></button>{roots.map(root=><div key={root.id}><button className={category===root.id?"active":""} onClick={()=>setCategory(root.id)}>{categoryName(root)} <span>{countForCategory(root.id)}</span></button>{marketCategories.filter(item=>item.parentId===root.id).map(child=><button className={`sub ${category===child.id?"active":""}`} key={child.id} onClick={()=>setCategory(child.id)}>— {categoryName(child)} <span>{countForCategory(child.id)}</span></button>)}</div>)}</aside>
      <section className="catalog-results"><div className="catalog-count"><span>{visible.length} {market==="TR"?"ürün":"products"}</span>{category&&<button onClick={()=>setCategory(null)}>{market==="TR"?"Filtreyi temizle":"Clear filter"} ×</button>}</div>{loading?<p className="catalog-empty">{market==="TR"?"Katalog yükleniyor…":"Loading catalog…"}</p>:visible.length===0?<div className="catalog-empty"><h2>{market==="TR"?"Bu seçime uygun ürün bulunamadı.":"No products match this selection."}</h2><button onClick={()=>{setCategory(null);setQuery("");}}>{market==="TR"?"Tüm ürünleri göster":"Show all products"} →</button></div>:<div className="catalog-grid">{visible.map(product=><article key={product.id}><div className="catalog-image"><a href={`/urun/${encodeURIComponent(product.slug)}`} aria-label={`${productName(product)} details`}></a><img src={product.imageUrl||"https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=900&q=88"} alt={productName(product)}/>{product.stock>0?<button onClick={()=>addToCart(product)} aria-label={`${productName(product)} add to bag`}>+</button>:<span>{market==="TR"?"TÜKENDİ":"SOLD OUT"}</span>}</div><div className="catalog-meta"><div><h2><a href={`/urun/${encodeURIComponent(product.slug)}`}>{productName(product)}</a></h2><p>{productDescription(product)}</p></div><strong>{money(product)}</strong></div></article>)}</div>}</section>
    </div>
    <footer className="catalog-footer"><a className="catalog-brand" href="/">{settings.brandName}<span>{settings.brandSuffix}</span></a><p>{market==="GLOBAL"?"Thoughtfully selected in Istanbul, shared worldwide.":"Türkiye’den dünyaya, özenle seçilmiş ürünler."}</p><a href="/admin">{market==="GLOBAL"?"Admin":"Yönetim"} ↗</a></footer>
    {notice&&<div className="catalog-toast" role="status">{notice}</div>}
  </main>;
}
