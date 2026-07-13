"use client";

import { useEffect, useMemo, useState } from "react";
import "./sepet.css";
import "./cart-controls.css";

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
  const [shippingSettings,setShippingSettings]=useState({shippingTr:99,freeShippingTr:1500,shippingGlobal:15,freeShippingGlobal:150});

  const load = () => fetch("/api/cart").then(response => response.json()).then(data => {
    setItems(data.items ?? []);
    setMarket(data.market === "GLOBAL" ? "GLOBAL" : "TR");
    setLoading(false);
  }).catch(() => setLoading(false));

  useEffect(() => { load(); }, []);
  useEffect(()=>{fetch("/api/settings").then(response=>response.json()).then(data=>{const s=data.settings??{};setShippingSettings({shippingTr:Number(s.shippingTr??99),freeShippingTr:Number(s.freeShippingTr??1500),shippingGlobal:Number(s.shippingGlobal??15),freeShippingGlobal:Number(s.freeShippingGlobal??150)});}).catch(()=>undefined);},[]);

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
  const shippingFee=market==="TR"?shippingSettings.shippingTr:shippingSettings.shippingGlobal;const freeLimit=market==="TR"?shippingSettings.freeShippingTr:shippingSettings.freeShippingGlobal;const shipping=total>=freeLimit?0:shippingFee;const grandTotal=total+shipping;

  return <main className="cart-page">
    <header className="cart-header"><a className="cart-brand" href="/">MYSA <span>OBJETS</span></a><a href="/">Alışverişe devam ↗</a></header>
    <section className="cart-shell">
      <div className="cart-title"><p>SEÇTİKLERİNİZ</p><h1>Alışveriş çantası</h1><span>{items.reduce((sum, item) => sum + item.quantity, 0)} ürün</span></div>
      {loading ? <p className="cart-empty">Çantanız yükleniyor…</p> : items.length === 0 ? <div className="cart-empty"><h2>Çantanız henüz boş.</h2><p>Seçkinizi oluşturmaya mağazadan başlayabilirsiniz.</p><a href="/#shop">Ürünleri keşfet →</a></div> : <div className="cart-layout">
        <div className="cart-lines">{items.map(item => {
          const unit = (market === "TR" ? item.priceTr : item.priceGlobal) + (item.priceAdjustment ?? 0);
          return <article className="cart-line" key={item.id}>
            <a className="cart-image" href={`/urun/${encodeURIComponent(item.slug)}`}><img src={item.imageUrl || "https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=600&q=85"} alt={item.name}/></a>
            <div className="cart-copy"><p>{market==="TR"?"SEÇKİLİ ÜRÜN":"CURATED PRODUCT"}</p><h2><a href={`/urun/${encodeURIComponent(item.slug)}`}>{market==="GLOBAL"?(item.nameEn||item.name):item.name}</a></h2>{item.optionValue && <span>{market==="GLOBAL"?(item.optionNameEn||item.optionName):item.optionName}: {market==="GLOBAL"?(item.optionValueEn||item.optionValue):item.optionValue}</span>}<div className="cart-quantity"><button onClick={() => setQuantity(item, item.quantity - 1)} aria-label="Adedi azalt">−</button><span>{item.quantity}</span><button onClick={() => setQuantity(item, item.quantity + 1)} disabled={item.quantity >= (item.variantStock ?? item.stock)} aria-label="Adedi artır">+</button></div><button className="cart-remove" onClick={() => remove(item.id)}>{market==="TR"?"Kaldır":"Remove"}</button></div>
            <strong>{money(unit * item.quantity)}</strong>
          </article>;
        })}</div>
        <aside className="cart-summary"><p>SİPARİŞ ÖZETİ</p><div><span>Ara toplam</span><strong>{money(total)}</strong></div><div><span>Teslimat</span><span>{shipping===0?"Ücretsiz":money(shipping)}</span></div>{shipping>0&&<small>{money(Math.max(0,freeLimit-total))} daha ekleyin, ücretsiz teslimattan yararlanın.</small>}<hr/><div className="cart-total"><span>Toplam</span><strong>{money(grandTotal)}</strong></div><a className="cart-checkout" href="/teslimat">Teslimat bilgilerine geç</a><small>Bu aşamada ödeme alınmaz. Ön sipariş talebiniz kaydedildikten sonra ödeme sistemi ayrıca bağlanacaktır.</small></aside>
      </div>}
    </section>
  </main>;
}
