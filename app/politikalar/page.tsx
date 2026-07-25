"use client";

import { useEffect, useState } from "react";
import "./politikalar.css";
import { getPreferredMarket, setPreferredMarket } from "../market-preference";

type PolicySettings = {
  brandName:string; brandSuffix:string; shippingTr:string; freeShippingTr:string;
  shippingGlobal:string; freeShippingGlobal:string; shippingPolicyTr:string;
  returnsPolicyTr:string; shippingPolicyGlobal:string; returnsPolicyGlobal:string;
  privacyPolicy:string; privacyPolicyGlobal:string; legalStatus:string;
  legalBusinessType:string; legalName:string; legalAddress:string; legalTaxOffice:string;
  legalTaxNumber:string; legalMersisNumber:string; legalEmail:string; legalPhone:string;
  returnAddress:string; returnCarrier:string; etbisStatus:string;
  preliminaryInformationTr:string; distanceSalesTermsTr:string;
};

const defaults:PolicySettings = {
  brandName:"MYSA", brandSuffix:"OBJETS", shippingTr:"99", freeShippingTr:"1500",
  shippingGlobal:"15", freeShippingGlobal:"150",
  shippingPolicyTr:"Sipariş talepleri onaylandıktan sonra hazırlanır. Teslimat süresi ürün ve teslimat adresine göre paylaşılır.",
  returnsPolicyTr:"İade veya değişim talebiniz için sipariş numaranızla bize ulaşın.",
  shippingPolicyGlobal:"Global order requests are reviewed before preparation. Delivery timing is confirmed according to destination.",
  returnsPolicyGlobal:"For a return or exchange request, contact us with your order number.",
  privacyPolicy:"Paylaştığınız bilgiler sipariş ve iletişim taleplerinizi işlemek amacıyla kaydedilir.",
  privacyPolicyGlobal:"Information shared through order and contact forms is stored to process your request and communicate with you.",
  legalStatus:"draft", legalBusinessType:"", legalName:"", legalAddress:"",
  legalTaxOffice:"", legalTaxNumber:"", legalMersisNumber:"", legalEmail:"",
  legalPhone:"", returnAddress:"", returnCarrier:"", etbisStatus:"not_started",
  preliminaryInformationTr:"", distanceSalesTermsTr:"",
};

export default function PoliciesPage() {
  const [market,setMarket] = useState<"TR"|"GLOBAL">("TR");
  const [settings,setSettings] = useState(defaults);
  useEffect(() => {
    const preferred=getPreferredMarket();
    setMarket(preferred);
    fetch("/api/settings").then(response=>response.json()).then(data=>{
      if(data.settings)setSettings({...defaults,...data.settings});
    }).catch(()=>undefined);
  },[]);
  const change=(next:"TR"|"GLOBAL")=>{setMarket(next);setPreferredMarket(next);};
  const isTr=market==="TR";
  const legalComplete=settings.legalStatus==="complete";
  return <main className="policies-page">
    <header className="policies-header">
      <a className="policies-brand" href="/">{settings.brandName} <span>{settings.brandSuffix}</span></a>
      <nav><a href="/magaza">{isTr?"Mağaza":"Shop"}</a><a href="/iletisim">{isTr?"Bize ulaşın":"Contact us"}</a></nav>
    </header>
    <section className="policies-hero">
      <p>{isTr?"BİLGİLENDİRME":"INFORMATION"}</p>
      <h1>{isTr?"Teslimat, iade":"Shipping, returns"}<br/><em>{isTr?"ve gizlilik.":"and privacy."}</em></h1>
      <div className="policies-switch"><button className={isTr?"active":""} onClick={()=>change("TR")}>Türkiye</button><button className={!isTr?"active":""} onClick={()=>change("GLOBAL")}>Global</button></div>
    </section>
    <section className="policies-shell">
      <aside>
        <span>{isTr?"Bu içerikler yönetim panelinden değiştirilebilir.":"These details can be updated from the admin panel."}</span>
        <a href="/siparis-takip">{isTr?"Sipariş takibi":"Track order"} →</a>
        <a href="/iletisim">{isTr?"Destek talebi":"Support request"} →</a>
      </aside>
      <div className="policies-content">
        <article><span>01</span><div><h2>{isTr?"Teslimat":"Shipping"}</h2><p>{isTr?settings.shippingPolicyTr:settings.shippingPolicyGlobal}</p><dl><div><dt>{isTr?"Standart kargo":"Standard shipping"}</dt><dd>{isTr?`${Number(settings.shippingTr).toLocaleString("tr-TR")} TL`:`€${Number(settings.shippingGlobal).toLocaleString("en-US")}`}</dd></div><div><dt>{isTr?"Ücretsiz kargo sınırı":"Free shipping threshold"}</dt><dd>{isTr?`${Number(settings.freeShippingTr).toLocaleString("tr-TR")} TL`:`€${Number(settings.freeShippingGlobal).toLocaleString("en-US")}`}</dd></div></dl></div></article>
        <article><span>02</span><div><h2>{isTr?"İade ve değişim":"Returns & exchanges"}</h2><p>{isTr?settings.returnsPolicyTr:settings.returnsPolicyGlobal}</p><a href="/iletisim">{isTr?"Destek talebi oluştur":"Contact support"} →</a></div></article>
        <article id="gizlilik"><span>03</span><div><h2>{isTr?"Gizlilik açıklaması":"Privacy notice"}</h2><p>{isTr?settings.privacyPolicy:settings.privacyPolicyGlobal}</p><small>{isTr?"Bu sayfa genel operasyonel bilgilendirmedir. Nihai hukuki metinler işletme bilgileriniz kesinleştiğinde uzman kontrolünden geçirilmelidir.":"This page provides general operational information. Final legal texts should be professionally reviewed when the business details are confirmed."}</small></div></article>
        {isTr&&legalComplete&&<article id="satici"><span>04</span><div><h2>Satıcı bilgileri</h2><dl><div><dt>Ticari unvan</dt><dd>{settings.legalName}</dd></div><div><dt>Şirket türü</dt><dd>{settings.legalBusinessType}</dd></div><div><dt>Adres</dt><dd>{settings.legalAddress}</dd></div><div><dt>Vergi dairesi / numarası</dt><dd>{settings.legalTaxOffice} · {settings.legalTaxNumber}</dd></div>{settings.legalMersisNumber&&<div><dt>MERSİS</dt><dd>{settings.legalMersisNumber}</dd></div>}<div><dt>İletişim</dt><dd>{settings.legalEmail} · {settings.legalPhone}</dd></div><div><dt>İade adresi</dt><dd>{settings.returnAddress}</dd></div>{settings.returnCarrier&&<div><dt>İade kargosu</dt><dd>{settings.returnCarrier}</dd></div>}</dl></div></article>}
        {isTr&&<article id="on-bilgilendirme"><span>{legalComplete?"05":"04"}</span><div><h2>Ön bilgilendirme</h2><p>{settings.preliminaryInformationTr}</p></div></article>}
        {isTr&&<article id="mesafeli-satis"><span>{legalComplete?"06":"05"}</span><div><h2>Mesafeli satış sözleşmesi</h2><p>{settings.distanceSalesTermsTr}</p><small>{legalComplete?"Bu metin yönetim panelindeki onaylı şirket bilgileriyle yayınlanmaktadır.":"Şirket ve ödeme altyapısı henüz tamamlanmadığı için bu metin taslaktır; mevcut akış ödeme almayan sipariş talebi oluşturur."}</small></div></article>}
      </div>
    </section>
  </main>;
}
