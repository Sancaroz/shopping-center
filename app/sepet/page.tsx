"use client";

import { useEffect, useMemo, useState } from "react";
import "./sepet.css";
import "./cart-controls.css";
import {getPreferredMarket,setPreferredMarket} from "../market-preference";

type CartItem = {
  id: number;
  quantity: number;
  name: string;
  nameEn: string;
  slug: string;
  imageUrl: string;
  priceTr: number;
  priceGlobal: number;
  stock: number;
  active: boolean;
  marketTr: boolean;
  marketGlobal: boolean;
  variantStock: number | null;
  optionName: string | null;
  optionValue: string | null;
  optionNameEn: string | null;
  optionValueEn: string | null;
  priceAdjustment: number | null;
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [market, setMarket] = useState<"TR" | "GLOBAL">("TR");
  const [loading, setLoading] = useState(true);
  const [brand,setBrand]=useState({brandName:"MYSA",brandSuffix:"OBJETS"});
  const [shippingSettings,setShippingSettings]=useState({shippingTr:99,freeShippingTr:1500,shippingGlobal:15,freeShippingGlobal:150});

  const load = () => fetch("/api/cart").then(response => response.json()).then(data => {
    const rows=data.items??[];const next=rows.length?(data.market === "GLOBAL" ? "GLOBAL" : "TR"):getPreferredMarket();
    setItems(rows);
    setMarket(next);setPreferredMarket(next);
    setLoading(false);
  }).catch(() => setLoading(false));

  useEffect(() => { load(); }, []);
  useEffect(()=>{fetch("/api/settings").then(response=>response.json()).then(data=>{const s=data.settings??{};setBrand({brandName:s.brandName??"MYSA",brandSuffix:s.brandSuffix??"OBJETS"});setShippingSettings({shippingTr:Number(s.shippingTr??99),freeShippingTr:Number(s.freeShippingTr??1500),shippingGlobal:Number(s.shippingGlobal??15),freeShippingGlobal:Number(s.freeShippingGlobal??150)});}).catch(()=>undefined);},[]);

  const total = useMemo(() => items.reduce((sum, item) => {
    const price = (market === "TR" ? item.priceTr : item.priceGlobal) + (item.priceAdjustment ?? 0);
    return sum + price * item.quantity;
  }, 0), [items, market]);

  async function remove(id: number) {
    await fetch(`/api/cart?id=${id}`, { method: "DELETE" });
    setItems(current => current.filter(item => item.id !== id));
  }

  async function setQuantity(item:CartItem, quantity:number) {
    const maximum = item.variantStock ?? item.stock;
    const next = Math.max(0, Math.min(quantity, maximum));
    const response = await fetch("/api/cart", { method:"PATCH", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ id:item.id, quantity:next }) });
    if (!response.ok) return;
    if (next === 0) setItems(current => current.filter(line => line.id !== item.id));
    else setItems(current => current.map(line => line.id === item.id ? { ...line, quantity:next } : line));
  }

  const money = (value: number) => market === "TR" ? `${value.toLocaleString("tr-TR")} TL` : `€${value.toLocaleString("en-US")}`;
  const unavailableItems=items.filter(item=>!item.active||(market==="TR"?!item.marketTr:!item.marketGlobal));
  const shippingFee=market==="TR"?shippingSettings.shippingTr:shippingSettings.shippingGlobal;const freeLimit=market==="TR"?shippingSettings.freeShippingTr:shippingSettings.freeShippingGlobal;const shipping=total>=freeLimit?0:shippingFee;const grandTotal=total+shipping;

  return <main className="cart-page">
    <header className="cart-header"><a className="cart-brand" href="/">{brand.brandName} <span>{brand.brandSuffix}</span></a><a href="/">{market==="GLOBAL"?"Continue shopping":"Alışverişe devam"} ↗</a></header>
    <section className="cart-shell">
      <div className="cart-title"><p>{market==="GLOBAL"?"YOUR SELECTION":"SEÇTİKLERİNİZ"}</p><h1>{market==="GLOBAL"?"Shopping bag":"Alışveriş çantası"}</h1><span>{items.reduce((sum, item) => sum + item.quantity, 0)} {market==="GLOBAL"?"items":"ürün"}</span></div>
      {loading ? <p className="cart-empty">{market==="GLOBAL"?"Loading your bag…":"Çantanız yükleniyor…"}</p> : items.length === 0 ? <div className="cart-empty"><h2>{market==="GLOBAL"?"Your bag is empty.":"Çantanız henüz boş."}</h2><p>{market==="GLOBAL"?"Begin your selection in the shop.":"Seçkinizi oluşturmaya mağazadan başlayabilirsiniz."}</p><a href="/#shop">{market==="GLOBAL"?"Explore products":"Ürünleri keşfet"} →</a></div> : <>{unavailableItems.length>0&&<div className="cart-market-warning" role="alert"><b>{market==="GLOBAL"?"Your bag contains unavailable products.":"Çantanızda artık bu pazarda satılmayan ürünler var."}</b><span>{market==="GLOBAL"?"Remove the marked products before continuing.":"Devam etmek için işaretli ürünleri kaldırın."}</span></div>}<div className="cart-layout">
        <div className="cart-lines">{items.map(item => {
          const unit = (market === "TR" ? item.priceTr : item.priceGlobal) + (item.priceAdjustment ?? 0);
          const unavailable=!item.active||(market==="TR"?!item.marketTr:!item.marketGlobal);return <article className={`cart-line ${unavailable?"unavailable":""}`} key={item.id}>
            <a className="cart-image" href={`/urun/${encodeURIComponent(item.slug)}`}><img src={item.imageUrl || "https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=600&q=85"} alt={item.name}/></a>
            <div className="cart-copy"><p>{unavailable?(market==="GLOBAL"?"UNAVAILABLE":"BU PAZARDA YOK"):market==="TR"?"SEÇKİLİ ÜRÜN":"CURATED PRODUCT"}</p><h2><a href={`/urun/${encodeURIComponent(item.slug)}`}>{market==="GLOBAL"?(item.nameEn||item.name):item.name}</a></h2>{item.optionValue && <span>{market==="GLOBAL"?(item.optionNameEn||item.optionName):item.optionName}: {market==="GLOBAL"?(item.optionValueEn||item.optionValue):item.optionValue}</span>}{unavailable&&<span className="cart-unavailable-note">{market==="GLOBAL"?"This product must be removed from your bag.":"Siparişe devam etmek için bu ürünü kaldırın."}</span>}<div className="cart-quantity"><button onClick={() => setQuantity(item, item.quantity - 1)} aria-label={market==="GLOBAL"?"Decrease quantity":"Adedi azalt"}>−</button><span>{item.quantity}</span><button onClick={() => setQuantity(item, item.quantity + 1)} disabled={unavailable||item.quantity >= (item.variantStock ?? item.stock)} aria-label={market==="GLOBAL"?"Increase quantity":"Adedi artır"}>+</button></div><button className="cart-remove" onClick={() => remove(item.id)}>{market==="TR"?"Kaldır":"Remove"}</button></div>
            <strong>{money(unit * item.quantity)}</strong>
          </article>;
        })}</div>
        <aside className="cart-summary"><p>{market==="GLOBAL"?"ORDER SUMMARY":"SİPARİŞ ÖZETİ"}</p><div><span>{market==="GLOBAL"?"Subtotal":"Ara toplam"}</span><strong>{money(total)}</strong></div><div><span>{market==="GLOBAL"?"Shipping":"Teslimat"}</span><span>{shipping===0?(market==="GLOBAL"?"Free":"Ücretsiz"):money(shipping)}</span></div>{shipping>0&&<small>{market==="GLOBAL"?`Add ${money(Math.max(0,freeLimit-total))} more for free shipping.`:`${money(Math.max(0,freeLimit-total))} daha ekleyin, ücretsiz teslimattan yararlanın.`}</small>}<hr/><div className="cart-total"><span>{market==="GLOBAL"?"Total":"Toplam"}</span><strong>{money(grandTotal)}</strong></div>{unavailableItems.length?<span className="cart-checkout disabled">{market==="GLOBAL"?"Remove unavailable products":"Uygun olmayan ürünleri kaldırın"}</span>:<a className="cart-checkout" href="/teslimat">{market==="GLOBAL"?"Continue to delivery":"Teslimat bilgilerine geç"}</a>}<small>{market==="GLOBAL"?"No payment is collected at this stage. Your order request will be saved for confirmation.":"Bu aşamada ödeme alınmaz. Ön sipariş talebiniz kaydedildikten sonra ödeme sistemi ayrıca bağlanacaktır."}</small></aside>
      </div></>}
    </section>
  </main>;
}
