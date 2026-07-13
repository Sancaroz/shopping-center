"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import "./teslimat.css";

type Line = { id:number; quantity:number; name:string; optionValue:string|null; priceTr:number; priceGlobal:number; priceAdjustment:number|null };
type Result = { orderNumber:string; subtotal:number; market:"TR"|"GLOBAL" };

export default function CheckoutPage() {
  const [items,setItems] = useState<Line[]>([]);
  const [market,setMarket] = useState<"TR"|"GLOBAL">("TR");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [result,setResult] = useState<Result|null>(null);

  useEffect(() => { fetch("/api/cart").then(response => response.json()).then(data => { setItems(data.items ?? []); setMarket(data.market === "GLOBAL" ? "GLOBAL" : "TR"); }).catch(() => setMessage("Çantanız yüklenemedi.")); }, []);
  const total = useMemo(() => items.reduce((sum,item) => sum + ((market === "TR" ? item.priceTr : item.priceGlobal) + Number(item.priceAdjustment ?? 0)) * item.quantity, 0), [items,market]);
  const money = (value:number) => market === "TR" ? `${value.toLocaleString("tr-TR")} TL` : `€${value.toLocaleString("en-US")}`;

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/orders", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const data = await response.json();
    if (response.ok) { setResult(data); setItems([]); window.scrollTo({ top:0, behavior:"smooth" }); }
    else setMessage(data.error ?? "Sipariş talebi oluşturulamadı.");
    setBusy(false);
  }

  if (result) return <main className="checkout-page"><header className="checkout-header"><a className="checkout-brand" href="/">MYSA <span>OBJETS</span></a></header><section className="order-success"><p>SİPARİŞ TALEBİ ALINDI</p><h1>Teşekkür ederiz.</h1><div><span>Sipariş numaranız</span><strong>{result.orderNumber}</strong></div><p>Talebiniz güvenli biçimde kaydedildi. Henüz ödeme alınmadı; ödeme altyapısı bağlandığında bu akış güncellenecek.</p><a href="/">Mağazaya dön →</a></section></main>;

  return <main className="checkout-page">
    <header className="checkout-header"><a className="checkout-brand" href="/">MYSA <span>OBJETS</span></a><a href="/sepet">← Çantaya dön</a></header>
    <section className="checkout-shell">
      <div className="checkout-intro"><p>GÜVENLİ SİPARİŞ TALEBİ</p><h1>Teslimat bilgileri</h1><span>Bu adımda ödeme alınmaz.</span></div>
      {!items.length ? <div className="checkout-empty"><p>Devam etmek için çantanıza ürün ekleyin.</p><a href="/#shop">Ürünleri keşfet →</a></div> : <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submit}>
          <label>Ad soyad<input name="customerName" autoComplete="name" required/></label>
          <label>E-posta<input name="email" type="email" autoComplete="email" required/></label>
          <label>Telefon<input name="phone" type="tel" autoComplete="tel" required/></label>
          <label>Ülke<input name="country" autoComplete="country-name" defaultValue={market === "TR" ? "Türkiye" : ""} required/></label>
          <label className="wide">Adres<textarea name="address" rows={4} autoComplete="street-address" required/></label>
          <label>Şehir<input name="city" autoComplete="address-level2" required/></label>
          <label>Posta kodu<input name="postalCode" autoComplete="postal-code"/></label>
          <label className="wide">Sipariş notu <small>İsteğe bağlı</small><textarea name="note" rows={3}/></label>
          <label className="checkout-consent wide"><input type="checkbox" required/> Bilgilerimin bu sipariş talebinin işlenmesi için kaydedilmesini kabul ediyorum.</label>
          {message && <p className="checkout-error wide" role="alert">{message}</p>}
          <button className="wide" disabled={busy}>{busy ? "Kaydediliyor…" : "Sipariş talebini oluştur"}</button>
        </form>
        <aside className="checkout-summary"><p>SEÇİMİNİZ</p>{items.map(item => <div className="checkout-line" key={item.id}><span>{item.name}{item.optionValue ? ` · ${item.optionValue}` : ""}<small>{item.quantity} adet</small></span><strong>{money(((market === "TR" ? item.priceTr : item.priceGlobal) + Number(item.priceAdjustment ?? 0)) * item.quantity)}</strong></div>)}<hr/><div className="checkout-total"><span>Ara toplam</span><strong>{money(total)}</strong></div><small>Ödeme ve kargo ücreti bu sürümde aktif değildir.</small></aside>
      </div>}
    </section>
  </main>;
}
