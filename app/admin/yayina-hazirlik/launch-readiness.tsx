"use client";

import { FormEvent, useEffect, useState } from "react";

type Check={key:string;label:string;ready:boolean;detail:string};
type Health={key:string;level:"healthy"|"warning"|"paused"|"info";label:string;detail:string};
type Operations={generatedAt:string;orderIntakeStatus:"open"|"paused";metrics:{newOrders24h:number;activeOrders:number;staleOrders:number;staleReturns:number;draftNotifications:number};health:Health[]};
type Readiness={salesMode:string;checks:Check[];readyCount:number;total:number;readyForLive:boolean;operations:Operations};
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
  async function runOperation(action:"pause_intake"|"resume_intake"|"safe_mode"){
    const warnings={pause_intake:"Sipariş talebi alımını durdurmak istediğinize emin misiniz?",safe_mode:"Mağazayı ödeme alınmayan güvenli sipariş-talebi moduna geçirmek istediğinize emin misiniz?"};
    if(warnings[action]&&!window.confirm(warnings[action]))return;
    setBusy(true);setMessage("");
    const response=await fetch("/api/launch-operations",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({action})});
    const data=await response.json();
    setMessage(response.ok?data.message:data.error??"Operasyon işlemi tamamlanamadı.");
    if(response.ok)await load();
    setBusy(false);
  }
  return <main className="admin-shell launch-shell">
    <header className="admin-header"><div><p>SATIŞA GEÇİŞ</p><h1>Yayına hazırlık merkezi</h1></div><div><a href="/admin">Panele dön ↗</a><a href="/admin/entegrasyonlar">Entegrasyonlar ↗</a><a href="/">Mağazayı gör ↗</a></div></header>
    {!readiness?<section className="admin-card launch-loading">{message}</section>:<>
      <section className={`launch-score ${readiness.readyForLive?"ready":"waiting"}`}><div><p>GENEL DURUM</p><h2>{readiness.readyCount} / {readiness.total}</h2></div><div><strong>{readiness.readyForLive?"Canlı satışa hazır":"Hazırlık devam ediyor"}</strong><span>{readiness.salesMode==="live"?"Canlı satış modu":"Güvenli sipariş-talebi modu"}</span></div></section>
      <section className="admin-card launch-operations"><div className="list-title"><div><p className="section-kicker">SİSTEM SAĞLIĞI</p><h2>Açılış günü görünümü</h2></div><span>{new Date(readiness.operations.generatedAt).toLocaleTimeString("tr-TR")} itibarıyla</span></div><div className="launch-health-grid">{readiness.operations.health.map(item=><article className={item.level} key={item.key}><i>{item.level==="healthy"?"✓":item.level==="paused"?"×":item.level==="warning"?"!":"•"}</i><div><b>{item.label}</b><p>{item.detail}</p></div></article>)}</div><div className="launch-metrics"><span><b>{readiness.operations.metrics.newOrders24h}</b>Son 24 saat sipariş</span><span><b>{readiness.operations.metrics.activeOrders}</b>Aktif sipariş</span><span className={readiness.operations.metrics.staleOrders?"warning":""}><b>{readiness.operations.metrics.staleOrders}</b>Geciken sipariş</span><span className={readiness.operations.metrics.staleReturns?"warning":""}><b>{readiness.operations.metrics.staleReturns}</b>Geciken iade</span><span><b>{readiness.operations.metrics.draftNotifications}</b>Bildirim taslağı</span></div></section>
      <section className="launch-response-grid"><article className="admin-card emergency-card"><p className="section-kicker">ACİL DURUM KONTROLÜ</p><h2>Sipariş güvenlik anahtarı</h2><p>Siparişlerde teknik veya operasyonel bir sorun görürseniz yeni talep alımını anında durdurun. Mevcut kayıtlar ve sepetler silinmez.</p><div>{readiness.operations.orderIntakeStatus==="open"?<button className="danger" onClick={()=>runOperation("pause_intake")} disabled={busy}>Sipariş alımını durdur</button>:<button className="resume" onClick={()=>runOperation("resume_intake")} disabled={busy}>Sipariş alımını yeniden aç</button>}<button onClick={()=>runOperation("safe_mode")} disabled={busy}>Güvenli sipariş moduna dön</button></div><small>Her müdahale yönetim işlem geçmişine kaydedilir.</small></article><article className="admin-card runbook-card"><p className="section-kicker">SORUN ANINDA</p><h2>4 adımlık müdahale planı</h2><ol><li><b>Talep alımını durdurun</b><span>Yeni sipariş oluşmasını geçici olarak engelleyin.</span></li><li><b>Operasyon merkezini kontrol edin</b><a href="/admin/operasyon">Geciken sipariş ve stok uyarılarını aç →</a></li><li><b>Veri ve görsel yedeği alın</b><a href="/admin/veri-guvenligi">Yedekleme merkezine git →</a></li><li><b>İşlem geçmişini inceleyin</b><a href="/admin/islem-gecmisi">Son yönetim değişikliklerini aç →</a></li></ol></article></section>
      <section className="launch-grid">{readiness.checks.map(check=><article className={`admin-card launch-check ${check.ready?"ready":"waiting"}`} key={check.key}><i>{check.ready?"✓":"!"}</i><div><h2>{check.label}</h2><p>{check.detail}</p>{check.key==="catalog"&&<a href="/admin/katalog-kalitesi">Ürün denetimini aç →</a>}{check.key==="shipping"&&<a href="/admin/teslimat-ayarlari">Teslimat kurallarını aç →</a>}{check.key==="email"&&<a href="/admin/entegrasyonlar">E-posta entegrasyonunu aç →</a>}</div><span>{check.ready?"Hazır":"Bekliyor"}</span></article>)}</section>
      <section className="admin-card launch-controls"><div><p className="section-kicker">SATIŞ MODU</p><h2>Kontrollü geçiş</h2><p className="settings-note">Ödeme sağlayıcısıyla sözleşme yapılana kadar sipariş-talebi modunu koruyun. Canlı satış modu tüm kontroller tamamlanmadan etkinleşmez.</p></div><form className="admin-form" onSubmit={save}><label>Ödeme sağlayıcısı<input value={settings.paymentProviderName} onChange={event=>setSettings({...settings,paymentProviderName:event.target.value})} placeholder="iyzico / PayTR / diğer"/></label><label>Ödeme entegrasyonu<select value={settings.paymentProviderStatus} onChange={event=>setSettings({...settings,paymentProviderStatus:event.target.value})}><option value="not_started">Başlanmadı</option><option value="application">Başvuru yapıldı</option><option value="sandbox">Test ortamı bağlı</option><option value="active">Canlı ve aktif</option></select></label><label className="wide">Site satış modu<select value={settings.salesMode} onChange={event=>setSettings({...settings,salesMode:event.target.value})}><option value="order_request">Sipariş talebi · ödeme alınmaz</option><option value="live">Canlı satış · ödeme alınır</option></select></label><button disabled={busy}>{busy?"Kontrol ediliyor…":"Ayarı doğrula ve kaydet"}</button></form>{message&&<p className="admin-message" role="status">{message}</p>}</section>
    </>}
  </main>;
}
