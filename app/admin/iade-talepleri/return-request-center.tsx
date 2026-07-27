"use client";

import { useEffect, useState } from "react";
import { allowedReturnRequestStatusTargets, isTerminalReturnRequestStatus, returnRequestStatusLabels } from "../../return-lifecycle";

type RequestItem={id:number;requestNumber:string;orderId:number;orderNumber:string;requestType:string;reason:string;details:string;privacyAcknowledgedAt:string;status:string;adminNote:string;createdAt:string;customerName:string;email:string;orderStatus:string;total:number;market:string};
const typeLabels:Record<string,string>={cancellation:"İptal",return:"İade",exchange:"Değişim"};
const statusLabels:Record<string,string>=returnRequestStatusLabels;

function RequestCard({item,onSaved}:{item:RequestItem;onSaved:()=>Promise<void>}) {
  const [status,setStatus]=useState(item.status);const[note,setNote]=useState(item.adminNote);const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");
  async function save(){setBusy(true);const response=await fetch("/api/return-requests",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,status,adminNote:note})});const data=await response.json();setMessage(response.ok?"Talep güncellendi.":data.error??"Güncellenemedi.");if(response.ok)await onSaved();setBusy(false);}
  const terminal=isTerminalReturnRequestStatus(item.status);const statusTargets=allowedReturnRequestStatusTargets(item.status);
  return <article className={`admin-card return-request-card status-${item.status}`}>
    <header><div><span>{typeLabels[item.requestType]??item.requestType} · {statusLabels[item.status]??item.status}</span><h2>{item.requestNumber}</h2><a href={`/admin/siparis/${item.orderId}`}>{item.orderNumber} →</a></div><time>{new Date(item.createdAt).toLocaleString("tr-TR")}</time></header>
    <div className="request-meta"><p><span>MÜŞTERİ</span><b>{item.customerName}</b><a href={`mailto:${item.email}`}>{item.email}</a><small>{item.privacyAcknowledgedAt?`Gizlilik onayı: ${new Date(item.privacyAcknowledgedAt).toLocaleString("tr-TR")}`:"Eski kayıt · onay zamanı yok"}</small></p><p><span>GEREKÇE</span><b>{item.reason}</b><small>{item.details||"Ek açıklama yok."}</small></p><p><span>SİPARİŞ</span><b>{item.market==="TR"?`${item.total.toLocaleString("tr-TR")} TL`:`€${item.total.toLocaleString("en-US")}`}</b><small>Sipariş durumu: {item.orderStatus}</small></p></div>
    <div className="request-actions"><label>Talep durumu<select value={status} onChange={event=>setStatus(event.target.value)} disabled={terminal}>{statusTargets.map(value=><option value={value} key={value}>{statusLabels[value]}</option>)}</select></label><label>İç değerlendirme notu<textarea rows={3} value={note} onChange={event=>setNote(event.target.value)} placeholder="Müşteriye görünmez." disabled={terminal}/></label><button onClick={save} disabled={busy||terminal}>{terminal?"Talep kapalı":busy?"Kaydediliyor…":"Talebi kaydet"}</button></div>{message&&<p className="admin-message">{message}</p>}
  </article>;
}

export default function ReturnRequestCenter() {
  const [items,setItems]=useState<RequestItem[]>([]);const[filter,setFilter]=useState("open");const[message,setMessage]=useState("Yükleniyor…");
  const load=async()=>{const response=await fetch("/api/return-requests");const data=await response.json();if(response.ok){setItems(data.requests??[]);setMessage("");}else setMessage(data.error??"Talepler yüklenemedi.");};
  useEffect(()=>{void load();},[]);
  const visible=items.filter(item=>filter==="all"||(filter==="open"?["new","reviewing","approved"].includes(item.status):item.status===filter));
  return <main className="admin-shell return-admin-shell"><header className="admin-header"><div><p>SATIŞ SONRASI</p><h1>İade ve iptal talepleri</h1></div><div><a href="/admin">Panele dön ↗</a><a href="/iade-talebi">Müşteri formu ↗</a></div></header><section className="return-admin-summary"><article><b>{items.filter(item=>item.status==="new").length}</b><span>Yeni</span></article><article><b>{items.filter(item=>item.status==="reviewing").length}</b><span>İnceleniyor</span></article><article><b>{items.filter(item=>item.status==="approved").length}</b><span>Onaylanan</span></article><article><b>{items.filter(item=>item.status==="completed").length}</b><span>Tamamlanan</span></article></section><nav className="return-filters">{[["open","Açık talepler"],["new","Yeni"],["reviewing","İnceleniyor"],["approved","Onaylandı"],["completed","Tamamlandı"],["rejected","Reddedildi"],["all","Tümü"]].map(([value,label])=><button className={filter===value?"active":""} onClick={()=>setFilter(value)} key={value}>{label}</button>)}</nav>{message&&<p className="admin-message">{message}</p>}<section className="return-request-list">{visible.length?visible.map(item=><RequestCard key={item.id} item={item} onSaved={load}/>):<div className="admin-card empty">Bu durumda talep bulunmuyor.</div>}</section></main>;
}
