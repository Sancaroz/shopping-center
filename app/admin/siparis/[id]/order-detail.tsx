"use client";

import { useEffect, useState } from "react";
import "./order-detail.css";

type Order = { id:number; orderNumber:string; market:string; status:string; customerName:string; email:string; phone:string; address:string; city:string; postalCode:string; country:string; note:string; subtotal:number; createdAt:string; updatedAt:string };
type Line = { id:number; productName:string; variantLabel:string; quantity:number; unitPrice:number };
const labels:Record<string,string> = { new:"Yeni", confirmed:"Onaylandı", preparing:"Hazırlanıyor", completed:"Tamamlandı", cancelled:"İptal" };

export default function OrderDetail({ id }:{ id:number }) {
  const [order,setOrder] = useState<Order|null>(null);
  const [items,setItems] = useState<Line[]>([]);
  const [message,setMessage] = useState("Yükleniyor…");
  const load = async () => { const response=await fetch(`/api/orders?id=${id}`); const data=await response.json(); if(response.ok){setOrder(data.order);setItems(data.items);setMessage("");}else setMessage(data.error??"Sipariş yüklenemedi."); };
  useEffect(()=>{void load();},[id]);
  async function updateStatus(status:string){const response=await fetch("/api/orders",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id,status})});setMessage(response.ok?"Sipariş durumu güncellendi.":"Durum güncellenemedi.");if(response.ok)await load();}
  if(!order)return <main className="order-state"><a href="/admin">← Yönetim paneli</a><p>{message}</p></main>;
  const money=(value:number)=>order.market==="TR"?`${value.toLocaleString("tr-TR")} TL`:`€${value.toLocaleString("en-US")}`;
  return <main className="order-detail-page">
    <header className="order-detail-header"><div><a href="/admin">← Yönetim paneli</a><p>SİPARİŞ DETAYI</p><h1>{order.orderNumber}</h1></div><div className="order-header-actions"><button onClick={()=>window.print()}>Yazdır</button><select value={order.status} onChange={event=>updateStatus(event.target.value)} aria-label="Sipariş durumu"><option value="new">Yeni</option><option value="confirmed">Onaylandı</option><option value="preparing">Hazırlanıyor</option><option value="completed">Tamamlandı</option><option value="cancelled">İptal</option></select></div></header>
    {message&&<p className="order-message" role="status">{message}</p>}
    <section className="order-meta"><article><span>Durum</span><strong>{labels[order.status]??order.status}</strong></article><article><span>Tarih</span><strong>{new Date(order.createdAt).toLocaleString("tr-TR")}</strong></article><article><span>Pazar</span><strong>{order.market}</strong></article><article><span>Toplam</span><strong>{money(order.subtotal)}</strong></article></section>
    <div className="order-detail-grid">
      <section className="order-paper"><div className="order-section-title"><h2>Ürünler</h2><span>{items.reduce((sum,item)=>sum+item.quantity,0)} adet</span></div>{items.map(item=><article className="order-line" key={item.id}><div><h3>{item.productName}</h3>{item.variantLabel&&<p>{item.variantLabel}</p>}<span>{item.quantity} × {money(item.unitPrice)}</span></div><strong>{money(item.unitPrice*item.quantity)}</strong></article>)}<div className="order-grand-total"><span>Ara toplam</span><strong>{money(order.subtotal)}</strong></div></section>
      <aside><section className="order-paper"><h2>Müşteri</h2><strong>{order.customerName}</strong><a href={`mailto:${order.email}`}>{order.email}</a><a href={`tel:${order.phone}`}>{order.phone}</a></section><section className="order-paper"><h2>Teslimat adresi</h2><address>{order.address}<br/>{order.postalCode&&<>{order.postalCode} </>}{order.city}<br/>{order.country}</address></section><section className="order-paper"><h2>Sipariş notu</h2><p>{order.note||"Müşteri not bırakmadı."}</p></section></aside>
    </div>
  </main>;
}
