"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import "./teslimat.css";
import "./success-actions.css";
import {getPreferredMarket,setPreferredMarket} from "../market-preference";

type Line = { id:number; quantity:number; name:string; nameEn:string; optionValue:string|null; optionValueEn:string|null; priceTr:number; priceGlobal:number; priceAdjustment:number|null };
type Result = { orderNumber:string; subtotal:number; shippingAmount:number; total:number; market:"TR"|"GLOBAL" };

export default function CheckoutPage() {
  const [items,setItems] = useState<Line[]>([]);
  const [market,setMarket] = useState<"TR"|"GLOBAL">("TR");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [result,setResult] = useState<Result|null>(null);
  const [shippingSettings,setShippingSettings]=useState({shippingTr:99,freeShippingTr:1500,shippingGlobal:15,freeShippingGlobal:150});

  useEffect(() => { fetch("/api/cart").then(response => response.json()).then(data => { const rows=data.items??[];const next=rows.length?(data.market === "GLOBAL" ? "GLOBAL" : "TR"):getPreferredMarket();setItems(rows);setMarket(next);setPreferredMarket(next); }).catch(() => setMessage("Çantanız yüklenemedi.")); }, []);
  useEffect(()=>{fetch("/api/settings").then(response=>response.json()).then(data=>{const s=data.settings??{};setShippingSettings({shippingTr:Number(s.shippingTr??99),freeShippingTr:Number(s.freeShippingTr??1500),shippingGlobal:Number(s.shippingGlobal??15),freeShippingGlobal:Number(s.freeShippingGlobal??150)});}).catch(()=>undefined);},[]);
  const total = useMemo(() => items.reduce((sum,item) => sum + ((market === "TR" ? item.priceTr : item.priceGlobal) + Number(item.priceAdjustment ?? 0)) * item.quantity, 0), [items,market]);
  const money = (value:number) => market === "TR" ? `${value.toLocaleString("tr-TR")} TL` : `€${value.toLocaleString("en-US")}`;
  const shippingFee=market==="TR"?shippingSettings.shippingTr:shippingSettings.shippingGlobal;const freeLimit=market==="TR"?shippingSettings.freeShippingTr:shippingSettings.freeShippingGlobal;const shipping=total>=freeLimit?0:shippingFee;const grandTotal=total+shipping;

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const response = await fetch("/api/orders", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget))) });
    const data = await response.json();
    if (response.ok) { setResult(data); setItems([]); window.scrollTo({ top:0, behavior:"smooth" }); }
    else setMessage(data.error ?? "Sipariş talebi oluşturulamadı.");
    setBusy(false);
  }

  if (result) return <main className="checkout-page"><header className="checkout-header"><a className="checkout-brand" href="/">MYSA <span>OBJETS</span></a></header><section className="order-success"><p>SİPARİŞ TALEBİ ALINDI</p><h1>Teşekkür ederiz.</h1><div><span>Sipariş numaranız</span><strong>{result.orderNumber}</strong></div><p>Talebiniz güvenli biçimde kaydedildi. Henüz ödeme alınmadı; ödeme altyapısı bağlandığında bu akış güncellenecek.</p><nav><a href={`/siparis-takip?order=${encodeURIComponent(result.orderNumber)}`}>Siparişi takip et →</a><a href="/">Mağazaya dön</a></nav></section></main>;

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
          <label className="checkout-consent wide"><input type="checkbox" required/> <span>Bilgilerimin bu sipariş talebinin işlenmesi için kaydedilmesini kabul ediyorum. <a href="/politikalar#gizlilik" target="_blank">Gizlilik açıklaması ↗</a></span></label>
          {message && <p className="checkout-error wide" role="alert">{message}</p>}
          <button className="wide" disabled={busy}>{busy ? "Kaydediliyor…" : "Sipariş talebini oluştur"}</button>
        </form>
        <aside className="checkout-summary"><p>{market==="TR"?"SEÇİMİNİZ":"YOUR SELECTION"}</p>{items.map(item => <div className="checkout-line" key={item.id}><span>{market==="GLOBAL"?(item.nameEn||item.name):item.name}{item.optionValue ? ` · ${market==="GLOBAL"?(item.optionValueEn||item.optionValue):item.optionValue}` : ""}<small>{item.quantity} {market==="TR"?"adet":"pcs"}</small></span><strong>{money(((market === "TR" ? item.priceTr : item.priceGlobal) + Number(item.priceAdjustment ?? 0)) * item.quantity)}</strong></div>)}<hr/><div className="checkout-total"><span>{market==="TR"?"Ara toplam":"Subtotal"}</span><strong>{money(total)}</strong></div><div className="checkout-total"><span>{market==="TR"?"Teslimat":"Shipping"}</span><strong>{shipping===0?(market==="TR"?"Ücretsiz":"Free"):money(shipping)}</strong></div><hr/><div className="checkout-total"><span>{market==="TR"?"Genel toplam":"Total"}</span><strong>{money(grandTotal)}</strong></div><small>{market==="TR"?"Bu aşamada ödeme alınmaz; sipariş talebi toplam tutarıyla kaydedilir.":"No payment is collected at this stage; your order request is saved with its total."}</small></aside>
      </div>}
    </section>
  </main>;
}
