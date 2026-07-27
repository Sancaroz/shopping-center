"use client";

import { useEffect, useState } from "react";
import { canManageNotificationStatus, notificationStatusLabel } from "../../notification-lifecycle";

type Notification={id:number;source:"order"|"newsletter";orderId:number|null;orderNumber:string;eventType:string;recipient:string;subject:string;body:string;status:string;attempts:number;lastError:string;sentAt:string|null;createdAt:string};
const labels:Record<string,string>={verification:"E-posta doğrulama",received:"Sipariş talebi alındı",confirmed:"Sipariş onaylandı",shipped:"Kargoya verildi",shipment_update:"Teslimat hareketi",cancelled:"Sipariş iptal edildi"};

export default function NotificationCenter() {
  const [items,setItems]=useState<Notification[]>([]);
  const [providerConnected,setProviderConnected]=useState(false);
  const [message,setMessage]=useState("Yükleniyor…");
  const load=async()=>{const response=await fetch("/api/notifications");const data=await response.json();if(response.ok){setItems(data.notifications??[]);setProviderConnected(data.providerConnected===true);setMessage("");}else setMessage(data.error??"Bildirimler yüklenemedi.");};
  useEffect(()=>{void load();},[]);
  async function setStatus(id:number,source:Notification["source"],status:"draft"|"dismissed"){const response=await fetch("/api/notifications",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,source,status})});setMessage(response.ok?(status==="dismissed"?"Bildirim arşivlendi.":"Bildirim kuyruğa geri alındı."):"Bildirim güncellenemedi.");if(response.ok)await load();}
  const waiting=items.filter(item=>item.status==="draft");
  return <main className="admin-shell notification-shell">
    <header className="admin-header"><div><p>MÜŞTERİ İLETİŞİMİ</p><h1>E-posta bildirimleri</h1></div><div><a href="/admin">Panele dön ↗</a><a href="/admin/yayina-hazirlik">Yayına hazırlık ↗</a></div></header>
    <section className="notification-status"><div><b>{waiting.length}</b><span>Hazır bildirim</span></div><p><strong>{providerConnected?"Gönderim bağlantısı hazır":"Gönderim kapalı"}</strong>{providerConnected?"E-posta adaptörü bağlı; kuyruk işleyicisi yalnızca taslak kayıtları gönderebilir.":"E-posta sağlayıcısı bağlanana kadar mesajlar yalnızca taslak olarak saklanır."}</p></section>
    {message&&<p className="admin-message" role="status">{message}</p>}
    <section className="notification-list">{items.length===0?<div className="admin-card empty">Henüz e-posta bildirimi oluşmadı.</div>:items.map(item=>{const nextStatus=item.status==="draft"?"dismissed":"draft";const manageable=canManageNotificationStatus(item.status,nextStatus,item.attempts);return <article className={`admin-card ${item.status!=="draft"?"dismissed":""}`} key={`${item.source}-${item.id}`}><header><div><span>{item.source==="newsletter"?"Bülten doğrulama":labels[item.eventType]??item.eventType}</span><h2>{item.subject}</h2>{item.orderId?<a href={`/admin/siparis/${item.orderId}`}>{item.orderNumber} →</a>:<small>Bülten aboneliği</small>}</div><time>{new Date(item.createdAt).toLocaleString("tr-TR")}</time></header><div className="notification-recipient"><span>ALICI</span><b>{item.recipient}</b></div><pre>{item.body}</pre><footer><span>{notificationStatusLabel(item.status,item.attempts)}{item.status==="draft"&&!providerConnected?" · sağlayıcı bekleniyor":""}</span>{manageable&&<button onClick={()=>setStatus(item.id,item.source,nextStatus)}>{item.status==="draft"?"Arşivle":item.status==="failed"?"Yeniden dene":"Kuyruğa geri al"}</button>}</footer></article>})}</section>
  </main>;
}
