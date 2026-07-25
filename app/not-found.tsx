export default function NotFound(){
  return <main style={{minHeight:"100vh",display:"grid",placeItems:"center",padding:"32px",textAlign:"center",background:"#f3efe8",color:"#171713"}}><section><p style={{letterSpacing:".18em",fontSize:12}}>404 · SAYFA BULUNAMADI</p><h1 style={{fontFamily:"Georgia,serif",fontSize:"clamp(42px,8vw,88px)",fontWeight:400,margin:"18px 0"}}>Aradığınız sayfa burada değil.</h1><p>Bağlantı değişmiş veya içerik kaldırılmış olabilir.</p><a href="/" style={{display:"inline-block",marginTop:24,color:"inherit"}}>Ana sayfaya dön →</a></section></main>;
}
