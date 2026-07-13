"use client";

import { useEffect, useMemo, useState } from "react";
import "./sepet.css";
import "./cart-controls.css";

type CartItem = {
  id: number;
  quantity: number;
  name: string;
  slug: string;
  imageUrl: string;
  priceTr: number;
  priceGlobal: number;
  stock: number;
  variantStock: number | null;
  optionName: string | null;
  optionValue: string | null;
  priceAdjustment: number | null;
};

export default function CartPage() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [market, setMarket] = useState<"TR" | "GLOBAL">("TR");
  const [loading, setLoading] = useState(true);

  const load = () => fetch("/api/cart").then(response => response.json()).then(data => {
    setItems(data.items ?? []);
    setMarket(data.market === "GLOBAL" ? "GLOBAL" : "TR");
    setLoading(false);
  }).catch(() => setLoading(false));

  useEffect(() => { load(); }, []);

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

  return <main className="cart-page">
    <header className="cart-header"><a className="cart-brand" href="/">MYSA <span>OBJETS</span></a><a href="/">Alışverişe devam ↗</a></header>
    <section className="cart-shell">
      <div className="cart-title"><p>SEÇTİKLERİNİZ</p><h1>Alışveriş çantası</h1><span>{items.reduce((sum, item) => sum + item.quantity, 0)} ürün</span></div>
      {loading ? <p className="cart-empty">Çantanız yükleniyor…</p> : items.length === 0 ? <div className="cart-empty"><h2>Çantanız henüz boş.</h2><p>Seçkinizi oluşturmaya mağazadan başlayabilirsiniz.</p><a href="/#shop">Ürünleri keşfet →</a></div> : <div className="cart-layout">
        <div className="cart-lines">{items.map(item => {
          const unit = (market === "TR" ? item.priceTr : item.priceGlobal) + (item.priceAdjustment ?? 0);
          return <article className="cart-line" key={item.id}>
            <a className="cart-image" href={`/urun/${encodeURIComponent(item.slug)}`}><img src={item.imageUrl || "https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=600&q=85"} alt={item.name}/></a>
            <div className="cart-copy"><p>SEÇKİLİ ÜRÜN</p><h2><a href={`/urun/${encodeURIComponent(item.slug)}`}>{item.name}</a></h2>{item.optionValue && <span>{item.optionName}: {item.optionValue}</span>}<div className="cart-quantity"><button onClick={() => setQuantity(item, item.quantity - 1)} aria-label="Adedi azalt">−</button><span>{item.quantity}</span><button onClick={() => setQuantity(item, item.quantity + 1)} disabled={item.quantity >= (item.variantStock ?? item.stock)} aria-label="Adedi artır">+</button></div><button className="cart-remove" onClick={() => remove(item.id)}>Kaldır</button></div>
            <strong>{money(unit * item.quantity)}</strong>
          </article>;
        })}</div>
        <aside className="cart-summary"><p>SİPARİŞ ÖZETİ</p><div><span>Ara toplam</span><strong>{money(total)}</strong></div><div><span>Teslimat</span><span>Sonraki adımda</span></div><hr/><div className="cart-total"><span>Toplam</span><strong>{money(total)}</strong></div><a className="cart-checkout" href="/teslimat">Teslimat bilgilerine geç</a><small>Bu aşamada ödeme alınmaz. Ön sipariş talebiniz kaydedildikten sonra ödeme sistemi ayrıca bağlanacaktır.</small></aside>
      </div>}
    </section>
  </main>;
}
