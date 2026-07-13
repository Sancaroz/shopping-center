import type { Metadata } from "next";
import { getDb } from "../db";
import { storeSettings } from "../db/schema";
import "./globals.css";

const seoDefaults={seoTitle:"MYSA OBJETS — Seçkili Yaşam Ürünleri",seoDescription:"Eviniz, gardırobunuz ve dostlarınız için zamansız, özenle seçilmiş yaşam ürünleri.",seoKeywords:"seçkili yaşam ürünleri, tekstil, ev, aksesuar, pet",seoImageUrl:"/og.png"};

export async function generateMetadata():Promise<Metadata>{
  let settings=seoDefaults;
  try{const rows=await getDb().select().from(storeSettings);settings={...seoDefaults,...Object.fromEntries(rows.map(row=>[row.key,row.value]))};}catch{}
  const keywords=settings.seoKeywords.split(",").map(item=>item.trim()).filter(Boolean);
  return {metadataBase:new URL("https://mysa-objets-store.robologai.chatgpt.site"),title:settings.seoTitle,description:settings.seoDescription,keywords,alternates:{canonical:"/"},openGraph:{type:"website",title:settings.seoTitle,description:settings.seoDescription,images:[{url:settings.seoImageUrl,width:1200,height:630,alt:settings.seoTitle}]},twitter:{card:"summary_large_image",title:settings.seoTitle,description:settings.seoDescription,images:[settings.seoImageUrl]},icons:{icon:"/favicon.svg",shortcut:"/favicon.svg"},robots:{index:true,follow:true}};
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body>{children}</body>
    </html>
  );
}
