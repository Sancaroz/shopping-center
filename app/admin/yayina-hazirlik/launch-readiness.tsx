"use client";

import { FormEvent, useEffect, useState } from "react";

type Check={key:string;label:string;ready:boolean;detail:string};
type Readiness={salesMode:string;checks:Check[];readyCount:number;total:number;readyForLive:boolean};
type Settings={salesMode:string;paymentProviderStatus:string;paymentProviderName:string};

export default function LaunchReadiness() {
  const [readiness,setReadiness]=useState<Readiness|null>(null);
  const [settings,setSettings]=useState<Settings>({salesMode:"order_request",paymentProviderStatus:"not_started",paymentProviderName:""});
  const [message,setMessage]=useState("Yükleniyor…");
  const [busy,setBusy]=useState(false);
  const load=async()=>{
    const [readinessResponse,settingsResponse]=await Promise.all([fetch("/api/launch-readiness"),fetch("/api/settings")]);
    const [readinessData,settingsData]=await Promise.all([readinessResponse.json(),settingsResponse.json()]);
    if(readinessResponse.ok)setReadiness(readinessData);
    if(settingsResponse.ok)setSettings({
      salesMode:settingsData.settings.salesMode??"order_request",
      paymentProviderStatus:settingsData.settings.paymentProviderStatus??"not_started",
      paymentProviderName:settingsData.settings.paymentProviderName??"",
    });
    setMessage("");
  };
  useEffect(()=>{void load();},[]);
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy(true);setMessage("");
    const response=await fetch("/api/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(settings)});
    const data=await response.json();
    setMessage(response.ok?"Satış modu ayarları güncellendi.":data.error??"Ayarlar güncellenemedi.");
    if(response.ok)await load();
    setBusy(false);
  }
  return <main className="admin-shell launch-shell">
    <header className="admin-header"><div><p>SATIŞA GEÇİŞ</p><h1>Yayına hazırlık merkezi</h1></div><div><a href="/admin">Panele dön ↗</a><a href="/">Mağazayı gör ↗</a></div></header>
    {!readiness?<section className="admin-card launch-loading">{message}</section>:<>
      <section className={`launch-score ${readiness.readyForLive?"ready":"waiting"}`}><div><p>GENEL DURUM</p><h2>{readiness.readyCount} / {readiness.total}</h2></div><div><strong>{readiness.readyForLive?"Canlı satışa hazır":"Hazırlık devam ediyor"}</strong><span>{readiness.salesMode==="live"?"Canlı satış modu":"Güvenli sipariş-talebi modu"}</span></div></section>
      <section className="launch-grid">{readiness.checks.map(check=><article className={`admin-card launch-check ${check.ready?"ready":"waiting"}`} key={check.key}><i>{check.ready?"✓":"!"}</i><div><h2>{check.label}</h2><p>{check.detail}</p></div><span>{check.ready?"Hazır":"Bekliyor"}</span></article>)}</section>
      <section className="admin-card launch-controls"><div><p className="section-kicker">SATIŞ MODU</p><h2>Kontrollü geçiş</h2><p className="settings-note">Ödeme sağlayıcısıyla sözleşme yapılana kadar sipariş-talebi modunu koruyun. Canlı satış modu tüm kontroller tamamlanmadan etkinleşmez.</p></div><form className="admin-form" onSubmit={save}><label>Ödeme sağlayıcısı<input value={settings.paymentProviderName} onChange={event=>setSettings({...settings,paymentProviderName:event.target.value})} placeholder="iyzico / PayTR / diğer"/></label><label>Ödeme entegrasyonu<select value={settings.paymentProviderStatus} onChange={event=>setSettings({...settings,paymentProviderStatus:event.target.value})}><option value="not_started">Başlanmadı</option><option value="application">Başvuru yapıldı</option><option value="sandbox">Test ortamı bağlı</option><option value="active">Canlı ve aktif</option></select></label><label className="wide">Site satış modu<select value={settings.salesMode} onChange={event=>setSettings({...settings,salesMode:event.target.value})}><option value="order_request">Sipariş talebi · ödeme alınmaz</option><option value="live">Canlı satış · ödeme alınır</option></select></label><button disabled={busy}>{busy?"Kontrol ediliyor…":"Ayarı doğrula ve kaydet"}</button></form>{message&&<p className="admin-message" role="status">{message}</p>}</section>
    </>}
  </main>;
}
