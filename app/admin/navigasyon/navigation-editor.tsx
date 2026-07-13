"use client";

import {FormEvent,useEffect,useState} from "react";

type Values={nav1Label:string;nav1Url:string;nav2Label:string;nav2Url:string;nav3Label:string;nav3Url:string;nav4Label:string;nav4Url:string};
const defaults:Values={nav1Label:"Mağaza",nav1Url:"/magaza",nav2Label:"Koleksiyonlar",nav2Url:"/magaza",nav3Label:"Hikâyemiz",nav3Url:"#story",nav4Label:"Journal",nav4Url:"#journal"};

export default function NavigationEditor(){
  const[values,setValues]=useState(defaults);const[message,setMessage]=useState("Yükleniyor…");const[busy,setBusy]=useState(false);
  useEffect(()=>{fetch("/api/settings").then(r=>r.json()).then(data=>{setValues({...defaults,...data.settings});setMessage("");}).catch(()=>setMessage("Menü ayarları yüklenemedi."));},[]);
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);const response=await fetch("/api/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify(values)});setMessage(response.ok?"Üst menü güncellendi.":"Menü kaydedilemedi.");setBusy(false);}
  const update=(key:keyof Values,value:string)=>setValues(current=>({...current,[key]:value}));
  return <main className="admin-shell editor-shell"><header className="admin-header"><div><p>ANA SAYFA</p><h1>Üst menü yönetimi</h1></div><div><a href="/">Ana sayfayı gör ↗</a><a href="/admin">Panele dön ↗</a></div></header><section className="admin-card editor-card"><p className="settings-note">Menü yazılarını ve hedeflerini değiştirebilirsiniz. Site içi sayfalar için <b>/magaza</b>, bölüm bağlantıları için <b>#journal</b> biçimini kullanın.</p><form className="admin-form" onSubmit={save}>{([1,2,3,4] as const).map(number=><div className="wide admin-form" key={number}><label>Menü {number} yazısı<input value={values[`nav${number}Label`]} onChange={event=>update(`nav${number}Label`,event.target.value)} required/></label><label>Menü {number} hedefi<input value={values[`nav${number}Url`]} onChange={event=>update(`nav${number}Url`,event.target.value)} placeholder="/magaza veya #journal" required/></label></div>)}<button disabled={busy}>{busy?"Kaydediliyor…":"Menüyü kaydet"}</button></form>{message&&<p className="admin-message">{message}</p>}</section></main>;
}
