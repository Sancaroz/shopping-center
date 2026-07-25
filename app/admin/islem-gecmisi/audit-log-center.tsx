"use client";

import { useEffect, useState } from "react";

type AuditLog={id:number;actorEmail:string;actorName:string;action:string;entityType:string;entityId:string;summary:string;beforeJson:string;afterJson:string;createdAt:string};
const labels:Record<string,string>={"order.update":"Sipariş güncellemesi","return_request.update":"İade/iptal talebi"};

function Changes({log}:{log:AuditLog}) {
  const before=JSON.parse(log.beforeJson||"{}") as Record<string,unknown>;
  const after=JSON.parse(log.afterJson||"{}") as Record<string,unknown>;
  const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]));
  return keys.length?<dl>{keys.map(key=><div key={key}><dt>{key}</dt><dd><del>{String(before[key]??"—")}</del><span>→</span><ins>{String(after[key]??"—")}</ins></dd></div>)}</dl>:<p className="audit-no-change">Görünür alan değişikliği yok.</p>;
}

export default function AuditLogCenter() {
  const[items,setItems]=useState<AuditLog[]>([]);const[filter,setFilter]=useState("all");const[message,setMessage]=useState("Yükleniyor…");
  useEffect(()=>{fetch("/api/audit-logs").then(async response=>({response,data:await response.json()})).then(({response,data})=>{if(response.ok){setItems(data.logs??[]);setMessage("");}else setMessage(data.error??"İşlem geçmişi yüklenemedi.");}).catch(()=>setMessage("İşlem geçmişi yüklenemedi."));},[]);
  const visible=filter==="all"?items:items.filter(item=>item.entityType===filter);
  return <main className="admin-shell audit-shell"><header className="admin-header"><div><p>GÜVENLİK VE İZLENEBİLİRLİK</p><h1>Yönetim işlem geçmişi</h1></div><div><a href="/admin">Panele dön ↗</a><a href="/admin/yayina-hazirlik">Yayına hazırlık ↗</a></div></header><section className="audit-intro"><div><b>{items.length}</b><span>Kayıtlı işlem</span></div><p>Bu kayıtlar salt okunurdur. Kritik yönetim değişikliklerinin kim tarafından ve ne zaman yapıldığını gösterir.</p></section><nav className="audit-filters">{[["all","Tüm işlemler"],["order","Siparişler"],["return_request","İade talepleri"]].map(([value,label])=><button className={filter===value?"active":""} onClick={()=>setFilter(value)} key={value}>{label}</button>)}</nav>{message&&<p className="admin-message">{message}</p>}<section className="audit-list">{visible.length?visible.map(log=><article className="admin-card" key={log.id}><header><div><span>{labels[log.action]??log.action}</span><h2>{log.summary}</h2></div><time>{new Date(log.createdAt).toLocaleString("tr-TR")}</time></header><p className="audit-actor"><b>{log.actorName}</b><span>{log.actorEmail}</span></p><Changes log={log}/></article>):<div className="admin-card empty">Henüz kayıtlı işlem bulunmuyor.</div>}</section></main>;
}
