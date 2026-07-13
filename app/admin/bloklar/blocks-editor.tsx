"use client";

import { FormEvent, useEffect, useState } from "react";

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
  active: boolean;
};

type BlockFieldsProps = { block?: Block };

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
    <label className="wide">Görsel<input name="file" type="file" accept="image/*"/><small>{block ? "Yeni dosya seçmezseniz mevcut görsel korunur." : "veya medya bağlantısı"}</small><input name="imageUrl" defaultValue={block?.imageUrl} placeholder="/api/media/..."/></label>
  </>;
}

async function resolveImage(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || !file.size) return String(form.get("imageUrl") ?? "");
  const upload = new FormData();
  upload.set("file", file);
  const response = await fetch("/api/uploads", { method: "POST", body: upload });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Görsel yüklenemedi.");
  return String(data.imageUrl);
}

function formBody(form: FormData, imageUrl: string) {
  return {
    eyebrowTr: form.get("eyebrowTr"), eyebrowEn: form.get("eyebrowEn"),
    titleTr: form.get("titleTr"), titleEn: form.get("titleEn"),
    copyTr: form.get("copyTr"), copyEn: form.get("copyEn"),
    buttonTr: form.get("buttonTr"), buttonEn: form.get("buttonEn"),
    buttonUrl: form.get("buttonUrl"), imagePosition: form.get("imagePosition"), imageUrl,
  };
}

export default function BlocksEditor() {
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [editing, setEditing] = useState<Block | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => { const data = await fetch("/api/homepage-blocks").then(r => r.json()); setBlocks(data.blocks ?? []); };
  useEffect(() => { void load(); }, []);

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const imageUrl = await resolveImage(form);
      const response = await fetch("/api/homepage-blocks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(formBody(form, imageUrl)) });
      if (!response.ok) throw new Error("Blok eklenemedi.");
      event.currentTarget.reset(); await load(); setMessage("Özel içerik bloğu eklendi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Blok eklenemedi."); }
    finally { setBusy(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!editing) return; setBusy(true); setMessage("");
    try {
      const form = new FormData(event.currentTarget);
      const imageUrl = await resolveImage(form);
      const response = await fetch("/api/homepage-blocks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editing.id, ...formBody(form, imageUrl) }) });
      if (!response.ok) throw new Error("Değişiklikler kaydedilemedi.");
      setEditing(null); await load(); setMessage("Blok güncellendi.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Değişiklikler kaydedilemedi."); }
    finally { setBusy(false); }
  }

  async function patch(id: number, data: Record<string, unknown>, reload = true) {
    const response = await fetch("/api/homepage-blocks", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...data }) });
    if (!response.ok) throw new Error("İşlem tamamlanamadı.");
    if (reload) await load();
  }

  async function move(index: number, direction: -1 | 1) {
    const target = index + direction; if (target < 0 || target >= blocks.length) return;
    try { await Promise.all([patch(blocks[index].id, { sortOrder: blocks[target].sortOrder }, false), patch(blocks[target].id, { sortOrder: blocks[index].sortOrder }, false)]); await load(); }
    catch { setMessage("Sıralama değiştirilemedi."); }
  }

  async function remove(id: number) {
    if (!confirm("Bu özel blok silinsin mi?")) return;
    const response = await fetch(`/api/homepage-blocks?id=${id}`, { method: "DELETE" });
    if (!response.ok) { setMessage("Blok silinemedi."); return; }
    if (editing?.id === id) setEditing(null); await load(); setMessage("Blok silindi.");
  }

  return <main className="admin-shell">
    <header className="admin-header"><div><p>MODÜLER VİTRİN</p><h1>Özel içerik blokları</h1></div><div><a href="/">Ana sayfayı gör ↗</a><a href="/admin">Panele dön ↗</a></div></header>
    {editing && <section className="admin-card block-create block-edit"><div className="list-title"><div><p className="section-kicker">DÜZENLENİYOR</p><h2>{editing.titleTr}</h2></div><button type="button" onClick={() => setEditing(null)}>Kapat ×</button></div><form key={editing.id} className="admin-form" onSubmit={save}><BlockFields block={editing}/><div className="block-form-actions"><button type="submit" disabled={busy}>{busy ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</button><button type="button" onClick={() => setEditing(null)}>Vazgeç</button></div></form></section>}
    <section className="admin-card block-create"><h2>Yeni blok ekle</h2><form className="admin-form" onSubmit={add}><BlockFields/><button disabled={busy}>{busy ? "Ekleniyor…" : "Bloğu ekle"}</button></form>{message && <p className="admin-message">{message}</p>}</section>
    <section className="admin-card block-list"><div className="list-title"><h2>Eklenen bloklar</h2><span>{blocks.length} blok</span></div>{blocks.map((block, index) => <article key={block.id} className={editing?.id === block.id ? "editing" : ""}><img src={block.imageUrl} alt=""/><span><b>{block.titleTr}</b><small>{block.titleEn || "İngilizce başlık yok"} · {block.active ? "Yayında" : "Gizli"}</small></span><div><button onClick={() => move(index, -1)} disabled={index === 0} aria-label="Yukarı taşı">↑</button><button onClick={() => move(index, 1)} disabled={index === blocks.length - 1} aria-label="Aşağı taşı">↓</button><button onClick={() => { setEditing(block); window.scrollTo({ top: 0, behavior: "smooth" }); }}>Düzenle</button><button onClick={() => patch(block.id, { active: !block.active })}>{block.active ? "Gizle" : "Yayınla"}</button><button onClick={() => remove(block.id)}>Sil</button></div></article>)}</section>
  </main>;
}
