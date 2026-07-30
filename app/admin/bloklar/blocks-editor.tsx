"use client";

import { FormEvent, useEffect, useState } from "react";
import {requestJson} from "../../client-request";

type Block = {
  id: number;
  eyebrowTr: string;
  eyebrowEn: string;
  titleTr: string;
  titleEn: string;
  copyTr: string;
  copyEn: string;
  buttonTr: string;
  buttonEn: string;
  buttonUrl: string;
  imageUrl: string;
  imagePosition: string;
  sortOrder: number;
  marketTr: boolean;
  marketGlobal: boolean;
  active: boolean;
  updatedAt: string;
};

type BlockFieldsProps = { block?: Block };
type BlockPayload={blocks?:Block[];imageUrl?:string;error?:string};

function BlockFields({ block }: BlockFieldsProps) {
  return <>
    <label>Üst metin · Türkçe<input name="eyebrowTr" defaultValue={block?.eyebrowTr}/></label>
    <label>Eyebrow · English<input name="eyebrowEn" defaultValue={block?.eyebrowEn}/></label>
    <label>Başlık · Türkçe<input name="titleTr" defaultValue={block?.titleTr} required/></label>
    <label>Title · English<input name="titleEn" defaultValue={block?.titleEn}/></label>
    <label className="wide">Açıklama · Türkçe<textarea name="copyTr" defaultValue={block?.copyTr} rows={3}/></label>
    <label className="wide">Description · English<textarea name="copyEn" defaultValue={block?.copyEn} rows={3}/></label>
    <label>Buton · Türkçe<input name="buttonTr" defaultValue={block?.buttonTr || "Keşfet"}/></label>
    <label>Button · English<input name="buttonEn" defaultValue={block?.buttonEn || "Explore"}/></label>
    <label>Buton bağlantısı<input name="buttonUrl" defaultValue={block?.buttonUrl || "/magaza"}/></label>
    <label>Görsel konumu<select name="imagePosition" defaultValue={block?.imagePosition || "left"}><option value="left">Sol</option><option value="right">Sağ</option></select></label>
    <div className="checks wide block-markets"><p>GÖSTERİLECEK PAZARLAR</p><label><input name="marketTr" type="checkbox" defaultChecked={block?.marketTr ?? true}/> Türkiye</label><label><input name="marketGlobal" type="checkbox" defaultChecked={block?.marketGlobal ?? true}/> Global</label></div>
    <label className="wide">Görsel<input name="file" type="file" accept="image/png,image/jpeg,image/webp"/><small>{block ? "Yeni dosya seçmezseniz mevcut görsel korunur." : "veya medya bağlantısı"}</small><input name="imageUrl" defaultValue={block?.imageUrl} placeholder="/api/media/..."/></label>
  </>;
}

async function resolveImage(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return String(form.get("imageUrl") ?? "");
  const upload = new FormData();
  upload.set("file", file);
  const{response,data,error}=await requestJson<BlockPayload>("/api/uploads",{method:"POST",body:upload},30_000);
  if(!response?.ok||!data?.imageUrl)throw new Error(data?.error??error??"Görsel yüklenemedi.");
  return data.imageUrl;
}

function formBody(form: FormData, imageUrl: string) {
  return {
    eyebrowTr: form.get("eyebrowTr"), eyebrowEn: form.get("eyebrowEn"),
    titleTr: form.get("titleTr"), titleEn: form.get("titleEn"),
    copyTr: form.get("copyTr"), copyEn: form.get("copyEn"),
    buttonTr: form.get("buttonTr"), buttonEn: form.get("buttonEn"),
    buttonUrl: form.get("buttonUrl"), imagePosition: form.get("imagePosition"), imageUrl,
    marketTr: form.get("marketTr")==="on", marketGlobal: form.get("marketGlobal")==="on",
  };
}

export default function BlocksEditor() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [editing, setEditing] = useState<Block | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load=async()=>{const{response,data,error}=await requestJson<BlockPayload>("/api/homepage-blocks");if(!response?.ok)throw new Error(data?.error??error??"İçerik blokları yüklenemedi.");setBlocks(data?.blocks??[]);};
  useEffect(()=>{void load().catch(error=>setMessage(error instanceof Error?error.message:"İçerik blokları yüklenemedi."));},[]);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const imageUrl = await resolveImage(form);
      const{response,data,error}=await requestJson<BlockPayload>("/api/homepage-blocks",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(formBody(form,imageUrl))});
      if(!response?.ok)throw new Error(data?.error??error??"Blok eklenemedi.");
      event.currentTarget.reset(); await load(); setMessage("Özel içerik bloğu eklendi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Blok eklenemedi."); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(true); setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const imageUrl = await resolveImage(form);
      const{response,data,error}=await requestJson<BlockPayload>("/api/homepage-blocks",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:editing.id,expectedUpdatedAt:editing.updatedAt,...formBody(form,imageUrl)})});
      if(!response?.ok)throw new Error(data?.error??error??"Değişiklikler kaydedilemedi.");
      setEditing(null); await load(); setMessage("Blok güncellendi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Değişiklikler kaydedilemedi."); }
    finally { setBusy(false); }
  }

  async function patch(block: Block, data: Record<string, unknown>) {
    setBusy(true);setMessage("");try{const{response,data:result,error}=await requestJson<BlockPayload>("/api/homepage-blocks",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:block.id,expectedUpdatedAt:block.updatedAt,...data})});if(!response?.ok)throw new Error(result?.error??error??"İşlem tamamlanamadı.");await load();setMessage("Blok görünürlüğü güncellendi.");}catch(error){setMessage(error instanceof Error?error.message:"İşlem tamamlanamadı.");}finally{setBusy(false);}
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction; if (target < 0 || target >= blocks.length) return;
    setBusy(true);try{const first=blocks[index];const second=blocks[target];const{response,data,error}=await requestJson<BlockPayload>("/api/homepage-blocks",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({swap:[{id:first.id,sortOrder:second.sortOrder,expectedUpdatedAt:first.updatedAt},{id:second.id,sortOrder:first.sortOrder,expectedUpdatedAt:second.updatedAt}]})});if(!response?.ok)throw new Error(data?.error??error??"Sıralama değiştirilemedi.");await load();setMessage("Blok sırası güncellendi.");}
    catch(error){setMessage(error instanceof Error?error.message:"Sıralama değiştirilemedi.");await load().catch(()=>undefined);}finally{setBusy(false);}
  }

  async function remove(block: Block) {
    if (!confirm("Bu özel blok arşivlensin mi? İçerik ve işlem geçmişi korunacaktır.")) return;
    setBusy(true);try{const{response,data,error}=await requestJson<BlockPayload>(`/api/homepage-blocks?id=${block.id}&expectedUpdatedAt=${encodeURIComponent(block.updatedAt)}`,{method:"DELETE"});if(!response?.ok){setMessage(data?.error??error??"Blok arşivlenemedi.");return;}if(editing?.id===block.id)setEditing(null);await load();setMessage("Blok arşivlendi; içerik geçmişi korundu.");}finally{setBusy(false);}
  }

  return <main className="admin-shell">
    <header className="admin-header"><div><p>MODÜLER VİTRİN</p><h1>Özel içerik blokları</h1></div><div><a href="/">Ana sayfayı gör ↗</a><a href="/admin">Panele dön ↗</a></div></header>
    {editing && <section className="admin-card block-create block-edit"><div className="list-title"><div><p className="section-kicker">DÜZENLENİYOR</p><h2>{editing.titleTr}</h2></div><button type="button" onClick={() => setEditing(null)} disabled={busy}>Kapat ×</button></div><form key={editing.id} className="admin-form" onSubmit={save}><BlockFields block={editing}/><div className="block-form-actions"><button type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</button><button type="button" onClick={() => setEditing(null)} disabled={busy}>Vazgeç</button></div></form></section>}
    <section className="admin-card block-create"><h2>Yeni blok ekle</h2><form className="admin-form" onSubmit={add}><BlockFields/><button disabled={busy}>{busy ? "Ekleniyor…" : "Bloğu ekle"}</button></form>{message && <p className="admin-message">{message}</p>}</section>
    <section className="admin-card block-list"><div className="list-title"><h2>Eklenen bloklar</h2><span>{blocks.length} blok</span></div>{blocks.map((block, index) => <article key={block.id} className={editing?.id === block.id ? "editing" : ""}><img src={block.imageUrl} alt=""/><span><b>{block.titleTr}</b><small>{block.titleEn || "İngilizce başlık yok"} · {block.marketTr?"TR ":""}{block.marketGlobal?"GLOBAL ":""}{!block.marketTr&&!block.marketGlobal?"Pazarsız ":""}· {block.active ? "Yayında" : "Gizli"}</small></span><div><button onClick={() => move(index, -1)} disabled={busy||index === 0} aria-label="Yukarı taşı">↑</button><button onClick={() => move(index, 1)} disabled={busy||index === blocks.length - 1} aria-label="Aşağı taşı">↓</button><button onClick={() => { setEditing(block); window.scrollTo({ top: 0, behavior: "smooth" }); }} disabled={busy}>Düzenle</button><button onClick={() => patch(block, { active: !block.active })} disabled={busy}>{block.active ? "Gizle" : "Yayınla"}</button>{block.active&&<button onClick={() => remove(block)} disabled={busy}>Arşivle</button>}</div></article>)}</section>
  </main>;
}
