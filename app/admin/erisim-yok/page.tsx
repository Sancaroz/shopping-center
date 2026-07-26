import { chatGPTSignOutPath, getAuthenticatedChatGPTUser } from "../../chatgpt-auth";
import "../admin.css";

export const dynamic = "force-dynamic";

export default async function AccessDeniedPage({ searchParams }: { searchParams:Promise<{reason?:string}> }) {
  const user=await getAuthenticatedChatGPTUser();
  const {reason}=await searchParams;
  return <main className="admin-shell" style={{maxWidth:720,margin:"auto"}}><section className="admin-card" style={{marginTop:80}}><p className="section-kicker">ERİŞİM SINIRLI</p><h1>{reason==="owner"?"Bu alan mağaza sahibine ait":"Bu hesap yönetim listesinde değil"}</h1><p style={{fontFamily:"Georgia,serif",lineHeight:1.7,color:"#687066"}}>{user?`${user.email} hesabının bu yönetim alanına erişim yetkisi bulunmuyor. Mağaza sahibinden hesabınızı Yönetim ekibi sayfasına eklemesini isteyin.`:"Yönetim panelini açmak için yetkili bir ChatGPT hesabıyla oturum açın."}</p><div style={{display:"flex",gap:16,marginTop:25}}><a href="/">Mağazaya dön ↗</a>{user&&<a href={chatGPTSignOutPath("/admin")}>Başka hesapla oturum aç ↗</a>}</div></section></main>;
}
