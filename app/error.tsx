"use client";

export default function ErrorPage({reset}:{reset:()=>void}){
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"32px",textAlign:"center",background:"#f3efe8",color:"#171713"}}><section><p style={{letterSpacing:".18em",fontSize:12}}>BEKLENMEYEN BİR SORUN</p><h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(38px,7vw,76px)",fontWeight:400,margin:"18px 0"}}>Sayfa yüklenemedi.</h1><p>Bilgileriniz korunuyor. Biraz sonra yeniden deneyebilirsiniz.</p><button onClick={reset} style={{marginTop:24,padding:"13px 22px",border:"1px solid currentColor",background:"transparent",cursor:"pointer"}}>Yeniden dene</button></section></main>;
}
