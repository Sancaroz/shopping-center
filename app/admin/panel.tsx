"use client";

import { FormEvent, useEffect, useState } from "react";

type Product = { id:number; nameTr:string; slug:string; stock:number; priceTr:number; marketTr:boolean; marketGlobal:boolean; active:boolean; imageUrl:string };

export default function AdminPanel({ userName }: { userName:string }) {
  const [items,setItems]=useState<Product[]>([]); const [message,setMessage]=useState(""); const [busy,setBusy]=useState(false);
  const load=async()=>{ const res=await fetch("/api/products"); if(res.ok) setItems((await res.json()).products); };
  useEffect(()=>{ void load(); },[]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault(); setBusy(true); setMessage(""); const form=new FormData(event.currentTarget);
    let imageUrl=String(form.get("imageUrl")??""); const file=form.get("file");
    if(file instanceof File && file.size){ const upload=new FormData(); upload.set("file",file); const result=await fetch("/api/uploads",{method:"POST",body:upload}); const data=await result.json(); if(!result.ok){setMessage(data.error);setBusy(false);return;} imageUrl=data.imageUrl; }
    const body={nameTr:form.get("nameTr"),slug:form.get("slug"),descriptionTr:form.get("descriptionTr"),priceTr:form.get("priceTr"),priceGlobal:form.get("priceGlobal"),stock:form.get("stock"),marketTr:form.get("marketTr")==="on",marketGlobal:form.get("marketGlobal")==="on",imageUrl};
    const response=await fetch("/api/products",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); const data=await response.json();
    setMessage(response.ok?"Ürün kaydedildi.":data.error); if(response.ok){event.currentTarget.reset();await load();} setBusy(false);
  }
  async function remove(id:number){ if(!window.confirm("Bu ürünü silmek istediğinize emin misiniz?"))return; await fetch(`/api/products?id=${id}`,{method:"DELETE"}); await load(); }
  return <main className="admin-shell">
    <header className="admin-header"><div><p>MAĞAZA YÖNETİMİ</p><h1>İçerik merkezi</h1></div><div><span>{userName}</span><a href="/">Mağazayı gör ↗</a></div></header>
    <section className="admin-summary"><article><b>{items.length}</b><span>Toplam ürün</span></article><article><b>{items.filter(x=>x.marketTr).length}</b><span>Türkiye</span></article><article><b>{items.filter(x=>x.marketGlobal).length}</b><span>Global</span></article><article><b>{items.reduce((a,x)=>a+x.stock,0)}</b><span>Toplam stok</span></article></section>
    <div className="admin-grid"><section className="admin-card"><h2>Yeni ürün</h2><form onSubmit={submit} className="admin-form"><label>Ürün adı<input name="nameTr" required/></label><label>Ürün kodu / adresi<input name="slug" required placeholder="organik-havlu"/></label><label className="wide">Açıklama<textarea name="descriptionTr" rows={3}/></label><label>Türkiye fiyatı<input name="priceTr" type="number" min="0" step="0.01"/></label><label>Global fiyat (€)<input name="priceGlobal" type="number" min="0" step="0.01"/></label><label>Stok<input name="stock" type="number" min="0" defaultValue="0"/></label><label className="wide">Ürün görseli<input name="file" type="file" accept="image/*"/><small>veya görsel bağlantısı</small><input name="imageUrl" type="url" placeholder="https://..."/></label><div className="checks wide"><label><input name="marketTr" type="checkbox" defaultChecked/> Türkiye</label><label><input name="marketGlobal" type="checkbox"/> Global</label></div><button disabled={busy}>{busy?"Kaydediliyor…":"Ürünü kaydet"}</button></form>{message&&<p className="admin-message">{message}</p>}</section>
    <section className="admin-card product-list"><div className="list-title"><h2>Ürünler</h2><span>{items.length} kayıt</span></div>{items.length===0?<p className="empty">Henüz kayıtlı ürün yok.</p>:items.map(item=><article key={item.id}>{item.imageUrl?<img src={item.imageUrl} alt=""/>:<div className="image-placeholder">Görsel</div>}<div><h3>{item.nameTr}</h3><p>{item.stock} adet · {item.priceTr.toLocaleString("tr-TR")} TL</p><small>{item.marketTr?"TR ":""}{item.marketGlobal?"GLOBAL":""}</small></div><button onClick={()=>remove(item.id)} aria-label={`${item.nameTr} ürününü sil`}>Sil</button></article>)}</section></div>
  </main>;
}
