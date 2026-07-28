"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import "./teslimat.css";
import "./success-actions.css";
import "./billing.css";
import "./promotions.css";
import {getPreferredMarket,setPreferredMarket} from "../market-preference";
import {globalCountries,shippingQuote} from "../shipping-rules";

type Line = { id:number; quantity:number; name:string; nameEn:string; optionValue:string|null; optionValueEn:string|null; priceTr:number; priceGlobal:number; priceAdjustment:number|null };
type Result = { orderNumber:string; subtotal:number; discountAmount:number; shippingAmount:number; total:number; market:"TR"|"GLOBAL" };

export default function CheckoutPage() {
  const [items,setItems] = useState<Line[]>([]);
  const [market,setMarket] = useState<"TR"|"GLOBAL">("TR");
  const [busy,setBusy] = useState(false);
  const [message,setMessage] = useState("");
  const [result,setResult] = useState<Result|null>(null);
  const [requestKey]=useState(()=>crypto.randomUUID());
  const [cartRevision,setCartRevision]=useState<string|null>(null);
  const [brand,setBrand]=useState({brandName:"MYSA",brandSuffix:"OBJETS"});
  const [intakeOpen,setIntakeOpen]=useState(true);
  const [country,setCountry]=useState("Türkiye");
  const [billingType,setBillingType]=useState<"individual"|"corporate">("individual");
  const [billingSameAsDelivery,setBillingSameAsDelivery]=useState(true);
  const [promoCode,setPromoCode]=useState("");const[discount,setDiscount]=useState(0);const[promoMessage,setPromoMessage]=useState("");const[promoBusy,setPromoBusy]=useState(false);
  const [shippingSettings,setShippingSettings]=useState({shippingTr:99,freeShippingTr:1500,shippingGlobal:15,freeShippingGlobal:150,shippingGlobalEnabled:"false",shippingGlobalCountries:"",taxDisplayMode:"pending"});

  const loadCart=()=>fetch("/api/cart").then(response => response.json()).then(data => { const rows=data.items??[];const next=rows.length?(data.market === "GLOBAL" ? "GLOBAL" : "TR"):getPreferredMarket();setItems(rows);setCartRevision(typeof data.revision==="string"?data.revision:null);setMarket(next);setPreferredMarket(next); });
  useEffect(() => { loadCart().catch(() => setMessage("Çantanız yüklenemedi.")); }, []);
  useEffect(()=>{fetch("/api/settings").then(response=>response.json()).then(data=>{const s=data.settings??{};setBrand({brandName:s.brandName??"MYSA",brandSuffix:s.brandSuffix??"OBJETS"});setIntakeOpen(s.orderIntakeStatus!=="paused");setShippingSettings({shippingTr:Number(s.shippingTr??99),freeShippingTr:Number(s.freeShippingTr??1500),shippingGlobal:Number(s.shippingGlobal??15),freeShippingGlobal:Number(s.freeShippingGlobal??150),shippingGlobalEnabled:String(s.shippingGlobalEnabled??"false"),shippingGlobalCountries:String(s.shippingGlobalCountries??""),taxDisplayMode:String(s.taxDisplayMode??"pending")});}).catch(()=>undefined);},[]);
  useEffect(()=>{setCountry(market==="TR"?"Türkiye":"");setPromoCode("");setDiscount(0);setPromoMessage("");},[market]);
  const total = useMemo(() => items.reduce((sum,item) => sum + ((market === "TR" ? item.priceTr : item.priceGlobal) + Number(item.priceAdjustment ?? 0)) * item.quantity, 0), [items,market]);
  const money = (value:number) => market === "TR" ? `${value.toLocaleString("tr-TR")} TL` : `€${value.toLocaleString("en-US")}`;
  const discountedSubtotal=Math.max(0,total-discount);const countries=globalCountries(shippingSettings);const quote=shippingQuote({market,country,subtotal:discountedSubtotal,settings:shippingSettings});const shipping=quote.ok?quote.shippingAmount:0;const grandTotal=quote.ok?quote.total:discountedSubtotal;

  async function applyPromotion(){if(!promoCode.trim())return;setPromoBusy(true);setPromoMessage("");const response=await fetch("/api/promotions/validate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({code:promoCode})});const data=await response.json();if(response.ok){setPromoCode(data.code);setDiscount(data.discountAmount);setPromoMessage(market==="GLOBAL"?"Discount applied.":"İndirim uygulandı.");}else{setDiscount(0);setPromoMessage(data.error??(market==="GLOBAL"?"Code could not be applied.":"Kod uygulanamadı."));}setPromoBusy(false);}

  async function submit(event:FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const values=Object.fromEntries(new FormData(event.currentTarget));const response = await fetch("/api/orders", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({...values,requestKey,cartRevision,promoCode:discount>0?promoCode:"",billingType,billingSameAsDelivery,privacyConsent:values.privacyConsent==="on",termsConsent:values.termsConsent==="on"}) });
    const data = await response.json();
    if (response.ok) { setResult(data); setItems([]); window.scrollTo({ top:0, behavior:"smooth" }); }
    else if(data.code==="cart_changed"){await loadCart().catch(()=>undefined);setDiscount(0);setMessage(market==="GLOBAL"?"Your bag changed. We refreshed the order summary; please review it and submit again.":"Çantanız değişti. Sipariş özeti yenilendi; kontrol edip tekrar gönderin.");}
    else setMessage(data.error ?? (market==="GLOBAL"?"Your order request could not be created.":"Sipariş talebi oluşturulamadı."));
    setBusy(false);
  }

  if (result) return <main className="checkout-page"><header className="checkout-header"><a className="checkout-brand" href="/">{brand.brandName} <span>{brand.brandSuffix}</span></a></header><section className="order-success"><p>{market==="GLOBAL"?"ORDER REQUEST RECEIVED":"SİPARİŞ TALEBİ ALINDI"}</p><h1>{market==="GLOBAL"?"Thank you.":"Teşekkür ederiz."}</h1><div><span>{market==="GLOBAL"?"Your order number":"Sipariş numaranız"}</span><strong>{result.orderNumber}</strong></div><p>{market==="GLOBAL"?"Your request has been securely saved. No payment has been collected; we will contact you with the next steps.":"Talebiniz güvenli biçimde kaydedildi. Henüz ödeme alınmadı; ödeme altyapısı bağlandığında bu akış güncellenecek."}</p><nav><a href={`/siparis-takip?order=${encodeURIComponent(result.orderNumber)}`}>{market==="GLOBAL"?"Track order":"Siparişi takip et"} →</a><a href="/">{market==="GLOBAL"?"Return to shop":"Mağazaya dön"}</a></nav></section></main>;

  return <main className="checkout-page">
    <header className="checkout-header"><a className="checkout-brand" href="/">{brand.brandName} <span>{brand.brandSuffix}</span></a><a href="/sepet">← {market==="GLOBAL"?"Back to bag":"Çantaya dön"}</a></header>
    <section className="checkout-shell">
      <div className="checkout-intro"><p>{market==="GLOBAL"?"SECURE ORDER REQUEST":"GÜVENLİ SİPARİŞ TALEBİ"}</p><h1>{market==="GLOBAL"?"Delivery details":"Teslimat bilgileri"}</h1><span>{market==="GLOBAL"?"No payment is collected at this stage.":"Bu adımda ödeme alınmaz."}</span></div>
      {!items.length ? <div className="checkout-empty"><p>{market==="GLOBAL"?"Add products to your bag to continue.":"Devam etmek için çantanıza ürün ekleyin."}</p><a href="/#shop">{market==="GLOBAL"?"Explore products":"Ürünleri keşfet"} →</a></div> : <div className="checkout-layout">
        <form className="checkout-form" onSubmit={submit}>
          {!intakeOpen&&<p className="checkout-error wide" role="alert">{market==="GLOBAL"?"Order requests are temporarily paused. Please try again later.":"Sipariş talepleri kısa süreliğine durduruldu. Lütfen daha sonra yeniden deneyin."}</p>}
          <label>{market==="GLOBAL"?"Full name":"Ad soyad"}<input name="customerName" autoComplete="name" minLength={2} maxLength={120} required/></label>
          <label>{market==="GLOBAL"?"Email":"E-posta"}<input name="email" type="email" autoComplete="email" maxLength={180} required/></label>
          <label>{market==="GLOBAL"?"Phone":"Telefon"}<input name="phone" type="tel" autoComplete="tel" maxLength={40} pattern="[+0-9 ().-]+" required/></label>
          <label>{market==="GLOBAL"?"Country":"Ülke"}{market==="TR"?<input name="country" autoComplete="country-name" value="Türkiye" readOnly/>:<select name="country" autoComplete="country-name" value={country} onChange={event=>setCountry(event.target.value)} required disabled={shippingSettings.shippingGlobalEnabled!=="true"}><option value="">Select a delivery country</option>{countries.map(item=><option value={item} key={item}>{item}</option>)}</select>}</label>
          <label className="wide">{market==="GLOBAL"?"Address":"Adres"}<textarea name="address" rows={4} minLength={5} maxLength={600} autoComplete="street-address" required/></label>
          <label>{market==="GLOBAL"?"City":"Şehir"}<input name="city" minLength={2} maxLength={120} autoComplete="address-level2" required/></label>
          <label>{market==="GLOBAL"?"Postal code":"Posta kodu"}<input name="postalCode" maxLength={30} autoComplete="postal-code"/></label>
          <fieldset className="billing-fields wide"><legend>{market==="GLOBAL"?"Billing information":"Fatura bilgileri"}</legend><div className="billing-choice"><label><input type="radio" checked={billingType==="individual"} onChange={()=>setBillingType("individual")}/>{market==="GLOBAL"?"Individual":"Bireysel"}</label><label><input type="radio" checked={billingType==="corporate"} onChange={()=>setBillingType("corporate")}/>{market==="GLOBAL"?"Business":"Kurumsal"}</label></div><label className="billing-same"><input type="checkbox" checked={billingSameAsDelivery} onChange={event=>setBillingSameAsDelivery(event.target.checked)}/>{market==="GLOBAL"?"Use delivery address for billing":"Teslimat adresini fatura adresi olarak kullan"}</label><div className="billing-grid"><label className="wide">{billingType==="corporate"?(market==="GLOBAL"?"Business legal name":"Firma unvanı"):(market==="GLOBAL"?"Billing name":"Fatura adı")}<input name="billingName" maxLength={180} required={!billingSameAsDelivery||billingType==="corporate"}/></label>{!billingSameAsDelivery&&<><label className="wide">{market==="GLOBAL"?"Billing address":"Fatura adresi"}<textarea name="billingAddress" rows={3} maxLength={600} required/></label><label>{market==="GLOBAL"?"Billing city":"Fatura şehri"}<input name="billingCity" maxLength={120} required/></label><label>{market==="GLOBAL"?"Billing postal code":"Fatura posta kodu"}<input name="billingPostalCode" maxLength={30}/></label><label className="wide">{market==="GLOBAL"?"Billing country":"Fatura ülkesi"}<input name="billingCountry" maxLength={100} required/></label></>}{billingType==="corporate"&&<><label>{market==="GLOBAL"?"Tax office (optional)":"Vergi dairesi"}<input name="billingTaxOffice" maxLength={120} required={market==="TR"}/></label><label>{market==="GLOBAL"?"Tax / VAT number":"Vergi numarası"}<input name="billingTaxNumber" minLength={5} maxLength={30} required/></label></>}</div><small>{market==="GLOBAL"?"These details are stored for future invoicing. No invoice is issued or payment collected at this stage.":"Bu bilgiler ileride fatura düzenlenebilmesi için saklanır. Bu aşamada fatura kesilmez ve ödeme alınmaz."}</small></fieldset>
          <label className="wide">{market==="GLOBAL"?"Order note":"Sipariş notu"} <small>{market==="GLOBAL"?"Optional":"İsteğe bağlı"}</small><textarea name="note" rows={3} maxLength={1000}/></label>
          <label className="contact-trap" aria-hidden="true">Company<input name="company" tabIndex={-1} autoComplete="off"/></label>
          <label className="checkout-consent wide"><input name="privacyConsent" type="checkbox" required/> <span>{market==="GLOBAL"?<>I agree that my information may be stored to process this order request. <a href="/politikalar#gizlilik" target="_blank">Privacy notice ↗</a></>:<>Bilgilerimin bu sipariş talebinin işlenmesi için kaydedilmesini kabul ediyorum. <a href="/politikalar#gizlilik" target="_blank">Gizlilik açıklaması ↗</a></>}</span></label>
          <label className="checkout-consent wide"><input name="termsConsent" type="checkbox" required/> <span>{market==="GLOBAL"?<>I have read the delivery, returns and order-request information. <a href="/politikalar" target="_blank">Review information ↗</a></>:<>Teslimat, iade ve sipariş talebi bilgilendirmesini okudum. <a href="/politikalar" target="_blank">Bilgilendirmeyi incele ↗</a></>}</span></label>
          {!quote.ok&&market==="GLOBAL"&&<p className="checkout-error wide" role="alert">{shippingSettings.shippingGlobalEnabled!=="true"?"Global delivery is not open yet.":country?"Delivery is not available for the selected country.":"Select a delivery country to continue."}</p>}
          {message && <p className="checkout-error wide" role="alert">{message}</p>}
          <button className="wide" disabled={busy||!intakeOpen||!quote.ok}>{!intakeOpen?(market==="GLOBAL"?"Order requests paused":"Sipariş alımı durduruldu"):busy ? (market==="GLOBAL"?"Saving…":"Kaydediliyor…") : (market==="GLOBAL"?"Create order request":"Sipariş talebini oluştur")}</button>
        </form>
        <aside className="checkout-summary"><p>{market==="TR"?"SEÇİMİNİZ":"YOUR SELECTION"}</p>{items.map(item => <div className="checkout-line" key={item.id}><span>{market==="GLOBAL"?(item.nameEn||item.name):item.name}{item.optionValue ? ` · ${market==="GLOBAL"?(item.optionValueEn||item.optionValue):item.optionValue}` : ""}<small>{item.quantity} {market==="TR"?"adet":"pcs"}</small></span><strong>{money(((market === "TR" ? item.priceTr : item.priceGlobal) + Number(item.priceAdjustment ?? 0)) * item.quantity)}</strong></div>)}<div className="promo-entry"><label>{market==="GLOBAL"?"DISCOUNT CODE":"İNDİRİM KODU"}<span><input value={promoCode} onChange={event=>{setPromoCode(event.target.value.toUpperCase());setDiscount(0);setPromoMessage("");}} maxLength={40}/><button type="button" onClick={applyPromotion} disabled={promoBusy||!promoCode.trim()}>{promoBusy?"…":market==="GLOBAL"?"Apply":"Uygula"}</button></span></label>{promoMessage&&<small className={discount>0?"success":"error"}>{promoMessage}</small>}</div><hr/><div className="checkout-total"><span>{market==="TR"?"Ara toplam":"Subtotal"}</span><strong>{money(total)}</strong></div>{discount>0&&<div className="checkout-total checkout-discount"><span>{market==="TR"?"İndirim":"Discount"}</span><strong>−{money(discount)}</strong></div>}<div className="checkout-total"><span>{market==="TR"?"Teslimat":"Shipping"}</span><strong>{quote.ok?(shipping===0?(market==="TR"?"Ücretsiz":"Free"):money(shipping)):(market==="TR"?"Hesaplanamadı":"Select country")}</strong></div><hr/><div className="checkout-total"><span>{market==="TR"?"Genel toplam":"Total"}</span><strong>{money(grandTotal)}</strong></div><small>{shippingSettings.taxDisplayMode==="tax_included"?(market==="TR"?"Gösterilen tüketici fiyatları vergiler dâhildir. Bu aşamada ödeme alınmaz.":"Displayed consumer prices include applicable taxes. No payment is collected at this stage."):(market==="TR"?"Fiyatların vergi durumu şirket ve mali onay tamamlandığında kesinleşecektir; bu aşamada ödeme alınmaz.":"Tax treatment will be finalized after company and financial review; no payment is collected at this stage.")}</small></aside>
      </div>}
    </section>
  </main>;
}
