"use client";

import { useEffect, useState } from "react";

type Notification={id:number;orderId:number;orderNumber:string;eventType:string;recipient:string;subject:string;body:string;status:string;attempts:number;lastError:string;sentAt:string|null;createdAt:string};
const labels:Record<string,string>={received:"Sipariş talebi alındı",confirmed:"Sipariş onaylandı",shipped:"Kargoya verildi",cancelled:"Sipariş iptal edildi"};

export default function NotificationCenter() {
  const [items,setItems]=useState<Notification[]>([]);
  const [message,setMessage]=useState("Yükleniyor…");
  const load=async()=>{const response=await fetch("/api/notifications");const data=await response.json();if(response.ok){setItems(data.notifications??[]);setMessage("");}else setMessage(data.error??"Bildirimler yüklenemedi.");};
  useEffect(()=>{void load();},[]);
  async function setStatus(id:number,status:"draft"|"dismissed"){const response=await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});setMessage(response.ok?(status==="dismissed"?"Bildirim arşivlendi.":"Bildirim kuyruğa geri alındı."):"Bildirim güncellenemedi.");if(response.ok)await load();}
  const waiting=items.filter(item=>item.status==="draft");
  return <main className="admin-shell notification-shell">
    <header className="admin-header"><div><p>MÜŞTERİ İLETİŞİMİ</p><h1>Sipariş bildirimleri</h1></div><div><a href="/admin">Panele dön ↗</a><a href="/admin/yayina-hazirlik">Yayına hazırlık ↗</a></div></header>
    <section className="notification-status"><div><b>{waiting.length}</b><span>Hazır bildirim</span></div><p><strong>Gönderim kapalı</strong>E-posta sağlayıcısı bağlanana kadar mesajlar yalnızca taslak olarak saklanır.</p></section>
    {message&&<p className="admin-message" role="status">{message}</p>}
    <section className="notification-list">{items.length===0?<div className="admin-card empty">Henüz sipariş bildirimi oluşmadı.</div>:items.map(item=><article className={`admin-card ${item.status==="dismissed"?"dismissed":""}`} key={item.id}><header><div><span>{labels[item.eventType]??item.eventType}</span><h2>{item.subject}</h2><a href={`/admin/siparis/${item.orderId}`}>{item.orderNumber} →</a></div><time>{new Date(item.createdAt).toLocaleString("tr-TR")}</time></header><div className="notification-recipient"><span>ALICI</span><b>{item.recipient}</b></div><pre>{item.body}</pre><footer><span>{item.status==="draft"?"Gönderim için hazır · sağlayıcı bekleniyor":"Arşivlendi"}</span><button onClick={()=>setStatus(item.id,item.status==="draft"?"dismissed":"draft")}>{item.status==="draft"?"Arşivle":"Kuyruğa geri al"}</button></footer></article>)}</section>
  </main>;
}
