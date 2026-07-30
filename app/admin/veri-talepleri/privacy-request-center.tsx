"use client";
/* eslint-disable react-hooks/purity -- deadline comparisons intentionally use the current client time */

import {FormEvent,useCallback,useEffect,useMemo,useState} from "react";
import {requestJson} from "../../client-request";
import {allowedIdentityStatusTargets,allowedPrivacyRequestStatusTargets,identityStatusLabels,isTerminalPrivacyRequestStatus,privacyRequestStatusLabels} from "../../privacy-request-lifecycle";

type Item={id:number;requestNumber:string;name:string;email:string;phone:string;requestType:string;details:string;privacyAcknowledgedAt:string;orderNumber:string;orderId:number|null;identityStatus:string;status:string;dueAt:string;assignedTo:string;adminNote:string;responseSummary:string;resolvedAt:string|null;createdAt:string;updatedAt:string};
type PrivacyPayload={requests?:Item[];request?:Item;error?:string};
const typeLabels:Record<string,string>={access:"Erişim",correction:"Düzeltme",deletion:"Silme",processing_objection:"İtiraz",other:"Diğer"};
const statusLabels:Record<string,string>=privacyRequestStatusLabels;

function RequestCard({item,onSaved}:{item:Item;onSaved:()=>Promise<void>}){
  const[busy,setBusy]=useState(false);const[message,setMessage]=useState("");
  const overdue=!item.resolvedAt&&new Date(item.dueAt).getTime()<Date.now();const terminal=isTerminalPrivacyRequestStatus(item.status);
  const statusTargets=allowedPrivacyRequestStatusTargets(item.status);const identityTargets=allowedIdentityStatusTargets(item.identityStatus);
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");try{const values=Object.fromEntries(new FormData(event.currentTarget));const{response,data,error}=await requestJson<PrivacyPayload>("/api/privacy-requests",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:item.id,...values})},30_000);setMessage(response?.ok?"Veri talebi güncellendi.":data?.error??error??"Talep güncellenemedi. Lütfen tekrar deneyin.");if(response?.ok)await onSaved();}finally{setBusy(false);}}
  return <article className={`admin-card privacy-request-card ${overdue?"overdue":""}`}>
    <header><div><span>{item.requestNumber} · {typeLabels[item.requestType]??item.requestType}</span><h2>{item.name}</h2><p>{item.email}{item.phone?` · ${item.phone}`:""}</p><small>{item.privacyAcknowledgedAt?`Gizlilik onayı: ${new Date(item.privacyAcknowledgedAt).toLocaleString("tr-TR")}`:"Eski kayıt · onay zamanı yok"}</small></div><div><strong>{overdue?"Süre aşıldı":statusLabels[item.status]??item.status}</strong><time>Son tarih: {new Date(item.dueAt).toLocaleDateString("tr-TR")}</time></div></header>
    <blockquote>{item.details}</blockquote>
    <div className="privacy-request-links">{item.orderId?<a href={`/admin/siparis/${item.orderId}`}>{item.orderNumber} siparişini aç →</a>:item.orderNumber?<span>{item.orderNumber} e-posta ile eşleşmedi</span>:<span>Sipariş bağlantısı yok</span>}<a href={`mailto:${item.email}?subject=${encodeURIComponent(`${item.requestNumber} veri talebi`)}`}>E-posta ile yanıtla ↗</a></div>
    <form onSubmit={save}><label>Durum<select name="status" defaultValue={item.status} disabled={busy||terminal}>{statusTargets.map(value=><option value={value} key={value}>{privacyRequestStatusLabels[value]}</option>)}</select></label><label>Kimlik kontrolü<select name="identityStatus" defaultValue={item.identityStatus} disabled={busy||terminal}>{identityTargets.map(value=><option value={value} key={value}>{identityStatusLabels[value]}</option>)}</select></label><label>Sorumlu<input name="assignedTo" defaultValue={item.assignedTo} maxLength={180} disabled={busy||terminal}/></label><label className="wide">İç not<textarea name="adminNote" rows={3} defaultValue={item.adminNote} maxLength={2000} placeholder="Kimlik belgesi veya hassas veri eklemeyin." disabled={busy||terminal}/></label><label className="wide">Cevap özeti<textarea name="responseSummary" rows={3} defaultValue={item.responseSummary} maxLength={2000} placeholder="Tamamlama veya ret halinde zorunludur." disabled={busy||terminal}/></label><button disabled={busy||terminal}>{terminal?"Talep sonuçlandı":busy?"Kaydediliyor…":"Talebi güncelle"}</button></form>
    {message&&<p role="status">{message}</p>}
  </article>;
}

export default function PrivacyRequestCenter(){
  const[items,setItems]=useState<Item[]>([]);const[filter,setFilter]=useState("open");const[message,setMessage]=useState("Veri talepleri yükleniyor…");const[refreshing,setRefreshing]=useState(false);const[loaded,setLoaded]=useState(false);
  const load=useCallback(async()=>{setRefreshing(true);try{const{response,data,error}=await requestJson<PrivacyPayload>("/api/privacy-requests");if(response?.ok){setItems(data?.requests??[]);setLoaded(true);setMessage("");}else setMessage(data?.error??error??"Talepler alınamadı. Lütfen tekrar deneyin.");}finally{setRefreshing(false);}},[]);
  useEffect(()=>{void load();},[load]);
  const open=items.filter(item=>!["completed","rejected"].includes(item.status));const overdue=open.filter(item=>new Date(item.dueAt).getTime()<Date.now());
  const visible=useMemo(()=>filter==="all"?items:filter==="overdue"?items.filter(item=>!["completed","rejected"].includes(item.status)&&new Date(item.dueAt).getTime()<Date.now()):filter==="completed"?items.filter(item=>["completed","rejected"].includes(item.status)):items.filter(item=>!["completed","rejected"].includes(item.status)),[filter,items]);
  return <main className="admin-shell privacy-admin-shell">
    <header className="admin-header"><div><p>KİŞİSEL VERİ HAKLARI</p><h1>Veri talebi merkezi</h1></div><div><button onClick={load} disabled={refreshing}>{refreshing?"Yenileniyor…":"Talepleri yenile"}</button><a href="/veri-talebi">Müşteri formunu gör ↗</a><a href="/admin/veri-guvenligi">Veri güvenliği ↗</a><a href="/admin">Panele dön ↗</a></div></header>
    <section className="privacy-admin-notice"><b>Kontrollü değerlendirme</b><p>Silme veya dışa aktarma otomatik yapılmaz. Önce kimlik doğrulanır, üçüncü kişilere ait bilgiler ayrıştırılır ve yasal saklama zorunlulukları değerlendirilir.</p></section>
    <section className="privacy-admin-summary"><article><b>{open.length}</b><span>Açık</span></article><article className={overdue.length?"warning":""}><b>{overdue.length}</b><span>Süresi aşılmış</span></article><article><b>{items.filter(item=>item.identityStatus==="verified").length}</b><span>Kimliği doğrulanan</span></article><article><b>{items.filter(item=>["completed","rejected"].includes(item.status)).length}</b><span>Sonuçlanan</span></article></section>
    <nav className="admin-card privacy-admin-filters">{[["open","Açık"],["overdue","Süresi aşılmış"],["completed","Sonuçlanan"],["all","Tümü"]].map(([value,label])=><button className={filter===value?"active":""} onClick={()=>setFilter(value)} key={value}>{label}</button>)}</nav>
    {message&&<div className="admin-message"><p>{message}</p><button onClick={load} disabled={refreshing}>{refreshing?"Yenileniyor…":"Tekrar dene"}</button></div>}
    <section>{visible.map(item=><RequestCard item={item} onSaved={load} key={`${item.id}-${item.updatedAt}`}/>)}{loaded&&visible.length===0&&<p className="admin-card empty">Bu filtrede veri talebi yok.</p>}</section>
  </main>;
}
