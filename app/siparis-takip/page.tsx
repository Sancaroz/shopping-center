"use client";

import { FormEvent, useEffect, useState } from "react";
import "./siparis-takip.css";

type TrackedOrder = { orderNumber:string; status:string; market:"TR"|"GLOBAL"; subtotal:number; shippingAmount:number; total:number; createdAt:string; updatedAt:string };
type TrackedItem = { id:number; productName:string; variantLabel:string; quantity:number; unitPrice:number };
type TrackingResult = { order:TrackedOrder; items:TrackedItem[] };

const steps = [
  { key:"new", label:"Talep alındı", copy:"Sipariş talebiniz güvenle kaydedildi." },
  { key:"confirmed", label:"Onaylandı", copy:"Siparişiniz tarafımızdan onaylandı." },
  { key:"preparing", label:"Hazırlanıyor", copy:"Ürünleriniz özenle hazırlanıyor." },
  { key:"completed", label:"Tamamlandı", copy:"Sipariş süreci tamamlandı." },
];

export default function OrderTrackingPage() {
  const [orderNumber,setOrderNumber]=useState("");
  const [email,setEmail]=useState("");
  const [result,setResult]=useState<TrackingResult|null>(null);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("order");
    if (value) setOrderNumber(value.toUpperCase());
  }, []);

  async function track(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setResult(null);
    const response=await fetch("/api/order-tracking",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderNumber,email})});
    const data=await response.json();
    if(response.ok)setResult(data);else setMessage(data.error??"Sipariş bilgileri alınamadı.");
    setBusy(false);
  }

  const money=(value:number,market:"TR"|"GLOBAL")=>market==="TR"?`${value.toLocaleString("tr-TR")} TL`:`€${value.toLocaleString("en-US")}`;
  const currentIndex=result?steps.findIndex(step=>step.key===result.order.status):-1;

  return <main className="tracking-page">
    <header className="tracking-header"><a className="tracking-brand" href="/">MYSA <span>OBJETS</span></a><nav><a href="/magaza">Mağaza</a><a href="/sepet">Çanta</a></nav></header>
    <section className="tracking-hero"><p>SİPARİŞ TAKİBİ</p><h1>Siparişiniz<br/><em>hangi aşamada?</em></h1><span>Sipariş numaranızı ve siparişte kullandığınız e-posta adresini girin.</span></section>
    <section className="tracking-shell">
      <form className="tracking-form" onSubmit={track}>
        <label>Sipariş numarası<input value={orderNumber} onChange={event=>setOrderNumber(event.target.value.toUpperCase())} placeholder="MS-20260713-ABC123" autoComplete="off" required/></label>
        <label>E-posta adresi<input value={email} onChange={event=>setEmail(event.target.value)} type="email" placeholder="ornek@email.com" autoComplete="email" required/></label>
        <button disabled={busy}>{busy?"Kontrol ediliyor…":"Siparişi bul"}</button>
      </form>
      <p className="tracking-privacy">Bilgileriniz yalnızca siparişinizi doğrulamak için kullanılır.</p>
      {message&&<p className="tracking-error" role="alert">{message}</p>}
      {result&&<div className="tracking-result">
        <div className="tracking-result-head"><div><p>SİPARİŞ NUMARASI</p><h2>{result.order.orderNumber}</h2><span>{new Date(result.order.createdAt).toLocaleDateString("tr-TR")} · {result.order.market}</span></div><strong>{result.order.status==="cancelled"?"İptal edildi":steps[currentIndex]?.label}</strong></div>
        {result.order.status==="cancelled"?<div className="cancelled-state"><b>Sipariş iptal edildi</b><p>Bu sipariş için stok ayrılmamıştır. Ayrıntı gerekiyorsa sipariş numaranızla bizimle iletişime geçebilirsiniz.</p></div>:<ol className="tracking-progress">{steps.map((step,index)=><li key={step.key} className={index<currentIndex?"done":index===currentIndex?"current":""}><i>{index<currentIndex?"✓":index+1}</i><div><b>{step.label}</b><span>{step.copy}</span></div></li>)}</ol>}
        <div className="tracking-details"><section><div className="tracking-section-title"><h3>Ürünler</h3><span>{result.items.reduce((sum,item)=>sum+item.quantity,0)} adet</span></div>{result.items.map(item=><article key={item.id}><div><b>{item.productName}</b>{item.variantLabel&&<span>{item.variantLabel}</span>}<small>{item.quantity} adet × {money(item.unitPrice,result.order.market)}</small></div><strong>{money(item.unitPrice*item.quantity,result.order.market)}</strong></article>)}</section><aside><p>ARA TOPLAM <b>{money(result.order.subtotal,result.order.market)}</b></p><p>TESLİMAT <b>{result.order.shippingAmount===0?"Ücretsiz":money(result.order.shippingAmount,result.order.market)}</b></p><hr/><p className="tracking-total">TOPLAM <b>{money(result.order.total,result.order.market)}</b></p><small>Son güncelleme: {new Date(result.order.updatedAt).toLocaleString("tr-TR")}</small></aside></div>
      </div>}
    </section>
  </main>;
}
