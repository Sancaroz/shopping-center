"use client";

import { useEffect, useState } from "react";

type AuditLog={id:number;actorEmail:string;actorName:string;action:string;entityType:string;entityId:string;summary:string;beforeJson:string;afterJson:string;createdAt:string};
const labels:Record<string,string>={"order.update":"Sipariş güncellemesi","return_request.update":"İade/iptal talebi","support.update":"Destek kaydı güncellemesi","payment_transaction.create":"Ödeme işlemi kaydı","privacy_request.update":"Veri talebi güncellemesi","newsletter.unsubscribe":"Bülten aboneliği durdurma","admin_user.create":"Yönetici ekleme","admin_user.reactivate":"Yönetici erişimini açma","admin_user.update":"Yönetici erişimi güncellemesi","product.create":"Ürün oluşturma","product.duplicate":"Ürün kopyalama","product.update":"Ürün güncelleme","product.bulk_update":"Toplu ürün güncelleme","product.archive":"Ürün arşivleme","variant.create":"Varyant oluşturma","variant.update":"Varyant güncelleme","variant.archive":"Varyant arşivleme","category.create":"Kategori oluşturma","category.update":"Kategori güncelleme","category.reorder":"Kategori sıralama","category.archive":"Kategori arşivleme","settings.update":"Mağaza ayarı güncelleme"};

labels["media.upload"]="Medya yükleme";
labels["media.delete"]="Medya silme";
labels["product_image.delete"]="Galeri görseli kaldırma";
labels["product.import"]="CSV ürün aktarımı";

function Changes({log}:{log:AuditLog}) {
  const parse=(value:string)=>{try{return JSON.parse(value||"{}") as Record<string,unknown>;}catch{return {_error:"Eski kayıt özeti görüntülenemiyor."};}};
  const before=parse(log.beforeJson);
  const after=parse(log.afterJson);
  const keys=[...new Set([...Object.keys(before),...Object.keys(after)])].filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]));
  return keys.length?<dl>{keys.map(key=><div key={key}><dt>{key}</dt><dd><del>{String(before[key]??"—")}</del><span>→</span><ins>{String(after[key]??"—")}</ins></dd></div>)}</dl>:<p className="audit-no-change">Görünür alan değişikliği yok.</p>;
}

export default function AuditLogCenter() {
  const[items,setItems]=useState<AuditLog[]>([]);const[filter,setFilter]=useState("all");const[message,setMessage]=useState("Yükleniyor…");
  useEffect(()=>{fetch("/api/audit-logs").then(async response=>({response,data:await response.json()})).then(({response,data})=>{if(response.ok){setItems(data.logs??[]);setMessage("");}else setMessage(data.error??"İşlem geçmişi yüklenemedi.");}).catch(()=>setMessage("İşlem geçmişi yüklenemedi."));},[]);
  const visible=filter==="all"?items:items.filter(item=>item.entityType===filter);
  return <main className="admin-shell audit-shell"><header className="admin-header"><div><p>GÜVENLİK VE İZLENEBİLİRLİK</p><h1>Yönetim işlem geçmişi</h1></div><div><a href="/admin">Panele dön ↗</a><a href="/admin/yayina-hazirlik">Yayına hazırlık ↗</a></div></header><section className="audit-intro"><div><b>{items.length}</b><span>Kayıtlı işlem</span></div><p>Bu kayıtlar salt okunurdur. Kritik yönetim değişikliklerinin kim tarafından ve ne zaman yapıldığını gösterir.</p></section><nav className="audit-filters">{[["all","Tüm işlemler"],["product","Ürünler"],["category","Kategoriler"],["settings","Ayarlar"],["order","Siparişler"],["payment_transaction","Ödemeler"],["return_request","İade talepleri"],["contact_message","Destek"],["media","Medya"]].map(([value,label])=><button className={filter===value?"active":""} onClick={()=>setFilter(value)} key={value}>{label}</button>)}</nav>{message&&<p className="admin-message">{message}</p>}<section className="audit-list">{visible.length?visible.map(log=><article className="admin-card" key={log.id}><header><div><span>{labels[log.action]??log.action}</span><h2>{log.summary}</h2></div><time>{new Date(log.createdAt).toLocaleString("tr-TR")}</time></header><p className="audit-actor"><b>{log.actorName}</b><span>{log.actorEmail}</span></p><Changes log={log}/></article>):<div className="admin-card empty">Henüz kayıtlı işlem bulunmuyor.</div>}</section></main>;
}
