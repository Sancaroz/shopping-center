"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {requestJson} from "../../client-request";

type Member = { id:number; email:string; displayName:string; role:string; active:boolean; createdAt:string };
type TeamPayload={members?:Member[];message?:string;error?:string};

export default function TeamCenter({ currentEmail }: { currentEmail:string }) {
  const [members,setMembers]=useState<Member[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const{response,data:result,error}=await requestJson<TeamPayload>("/api/admin-users");if(response?.ok)setMembers(result?.members??[]);else setMessage(result?.error??error??"Ekip yüklenemedi. Lütfen tekrar deneyin.");},[]);
  useEffect(()=>{void load();},[load]);

  async function add(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);setMessage("");const element=event.currentTarget;try{const form=new FormData(element);const{response,data:result,error}=await requestJson<TeamPayload>("/api/admin-users",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:form.get("email"),displayName:form.get("displayName")})});setMessage(response?.ok?result?.message??"Yönetici eklendi.":result?.error??error??"Yönetici eklenemedi. Lütfen tekrar deneyin.");if(response?.ok){element.reset();await load();}}finally{setBusy(false);}}
  async function toggle(member:Member){setBusy(true);setMessage("");try{const{response,data:result,error}=await requestJson<TeamPayload>("/api/admin-users",{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:member.id,active:!member.active})});setMessage(response?.ok?result?.message??"Erişim güncellendi.":result?.error??error??"Erişim güncellenemedi. Lütfen tekrar deneyin.");if(response?.ok)await load();}finally{setBusy(false);}}

  return <main className="admin-shell team-shell">
    <header className="admin-header"><div><p>ERİŞİM GÜVENLİĞİ</p><h1>Yönetim ekibi</h1></div><div><a href="/admin">Panele dön ↗</a><a href="/admin/islem-gecmisi">İşlem geçmişi ↗</a></div></header>
    <section className="team-notice"><b>Yönetim paneli e-posta izin listesiyle korunuyor.</b><p>Yalnızca aşağıdaki etkin hesaplar panele ve yönetim API&apos;lerine erişebilir. Mağaza sahibi hesabı tektir ve kapatılamaz. Yeni yöneticiye otomatik davet e-postası gönderilmez; kişinin bu e-posta adresiyle ChatGPT&apos;de oturum açması ve özel site erişimine sahip olması gerekir.</p></section>
    <section className="admin-card team-add"><div><p className="section-kicker">YENİ YÖNETİCİ</p><h2>Ekip üyesi ekle</h2><p>Yeni kişiler standart yönetici olur. Ekip erişimini yalnızca mağaza sahibi yönetebilir.</p></div><form onSubmit={add}><label>Ad soyad<input name="displayName" maxLength={120} placeholder="Ekip üyesinin adı" /></label><label>E-posta<input name="email" type="email" required maxLength={254} placeholder="ornek@firma.com" /></label><button disabled={busy}>{busy?"İşleniyor…":"Yönetici ekle"}</button></form></section>
    {message&&<p className="admin-message">{message}</p>}
    <section className="admin-card team-list"><div className="list-title"><div><p className="section-kicker">YETKİLİ HESAPLAR</p><h2>{members.length} ekip üyesi</h2></div></div>{members.map(member=><article key={member.id} className={member.active?"":"inactive"}><div><b>{member.displayName||member.email}</b><span>{member.email}{member.email===currentEmail?" · Siz":""}</span></div><small>{member.role==="owner"?"Mağaza sahibi":"Yönetici"}</small><strong className={member.active?"active":""}>{member.active?"Erişim açık":"Erişim kapalı"}</strong><button disabled={busy||member.role==="owner"} onClick={()=>toggle(member)}>{member.role==="owner"?"Korunuyor":member.active?"Erişimi kapat":"Erişimi aç"}</button></article>)}</section>
  </main>;
}
