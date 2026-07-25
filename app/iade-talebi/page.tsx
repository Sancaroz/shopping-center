"use client";

import { FormEvent, useEffect, useState } from "react";
import "./iade-talebi.css";
import { getPreferredMarket } from "../market-preference";

export default function ReturnRequestPage() {
  const [market,setMarket]=useState<"TR"|"GLOBAL">("TR");
  const [brand,setBrand]=useState({brandName:"MYSA",brandSuffix:"OBJETS"});
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [requestNumber,setRequestNumber]=useState("");
  useEffect(()=>{setMarket(getPreferredMarket());fetch("/api/settings").then(r=>r.json()).then(data=>data.settings&&setBrand({brandName:data.settings.brandName??"MYSA",brandSuffix:data.settings.brandSuffix??"OBJETS"})).catch(()=>undefined);},[]);
  const en=market==="GLOBAL";
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");setRequestNumber("");
    const response=await fetch("/api/return-requests",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(event.currentTarget)))});
    const data=await response.json();
    if(response.ok){setRequestNumber(data.requestNumber);event.currentTarget.reset();}else setMessage(data.error??(en?"Request could not be created.":"Talep oluşturulamadı."));
    setBusy(false);
  }
  return <main className="return-page">
    <header><a className="return-brand" href="/">{brand.brandName} <span>{brand.brandSuffix}</span></a><nav><a href="/siparis-takip">{en?"Track order":"Sipariş takibi"}</a><a href="/iletisim">{en?"Contact":"İletişim"}</a></nav></header>
    <section className="return-hero"><p>{en?"AFTER-SALES SUPPORT":"SATIŞ SONRASI DESTEK"}</p><h1>{en?"Cancellation, return":"İptal, iade"}<br/><em>{en?"or exchange.":"veya değişim."}</em></h1><span>{en?"Submit a request securely using the order number and email address on your order.":"Sipariş numaranız ve siparişte kullandığınız e-posta ile güvenli bir talep oluşturun."}</span></section>
    <section className="return-shell">
      <aside><h2>{en?"Before you submit":"Talep oluşturmadan önce"}</h2><p>{en?"Submitting this form does not automatically cancel the order or issue a refund. Our team reviews every request and contacts you with the next step.":"Bu form siparişi otomatik iptal etmez ve otomatik para iadesi başlatmaz. Ekibimiz talebi inceleyip sonraki adım için sizinle iletişime geçer."}</p><a href="/politikalar">{en?"Read policies":"Politikaları incele"} →</a></aside>
      <form onSubmit={submit}>
        <label>{en?"Order number":"Sipariş numarası"}<input name="orderNumber" placeholder="MS-20260725-ABC123" autoComplete="off" required/></label>
        <label>{en?"Order email":"Siparişteki e-posta"}<input name="email" type="email" autoComplete="email" required/></label>
        <label>{en?"Request type":"Talep türü"}<select name="requestType" required defaultValue=""><option value="" disabled>{en?"Select":"Seçin"}</option><option value="cancellation">{en?"Cancellation":"İptal"}</option><option value="return">{en?"Return":"İade"}</option><option value="exchange">{en?"Exchange":"Değişim"}</option></select></label>
        <label>{en?"Reason":"Gerekçe"}<select name="reason" required defaultValue=""><option value="" disabled>{en?"Select":"Seçin"}</option><option>{en?"Changed my mind":"Fikrim değişti"}</option><option>{en?"Wrong product or option":"Yanlış ürün veya seçenek"}</option><option>{en?"Damaged product":"Hasarlı ürün"}</option><option>{en?"Product not as expected":"Ürün beklentime uygun değil"}</option><option>{en?"Delivery issue":"Teslimat sorunu"}</option><option>{en?"Other":"Diğer"}</option></select></label>
        <label className="wide">{en?"Details":"Açıklama"} <small>{en?"Optional":"İsteğe bağlı"}</small><textarea name="details" rows={5} maxLength={2000}/></label>
        {message&&<p className="return-error wide" role="alert">{message}</p>}
        {requestNumber&&<div className="return-success wide" role="status"><span>{en?"REQUEST NUMBER":"TALEP NUMARASI"}</span><strong>{requestNumber}</strong><p>{en?"Your request was received. We will contact you after review.":"Talebiniz alındı. İncelemenin ardından sizinle iletişime geçeceğiz."}</p></div>}
        <button className="wide" disabled={busy}>{busy?(en?"Saving…":"Kaydediliyor…"):(en?"Submit request":"Talep oluştur")}</button>
      </form>
    </section>
  </main>;
}
