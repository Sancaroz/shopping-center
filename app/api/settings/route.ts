import { getDb } from "../../../db";
import { eq } from "drizzle-orm";
import { products, storeSettings } from "../../../db/schema";
import { recordAudit } from "../../audit-log";
import { getChatGPTUser } from "../../chatgpt-auth";
import { isValidEmail, isValidPhone, normalizeEmail, readBoundedJson } from "../../public-form-security";
import { isSafeExternalUrl, isSafeImageUrl, isSafeStorefrontUrl } from "../../safe-url";

export const dynamic = "force-dynamic";
const defaults = {
  brandName: "MYSA",
  brandSuffix: "OBJETS",
  brandLogoUrl: "",
  faviconUrl: "/favicon.svg",
  announcementTr: "1.500 TL üzeri ücretsiz gönderim",
  announcementGlobal: "Complimentary shipping over €150",
  showAnnouncement: "true",
  announcementUrlTr: "/magaza",
  announcementUrlGlobal: "/magaza",
  nav1Label: "Mağaza",
  nav1Url: "/magaza",
  nav2Label: "Koleksiyonlar",
  nav2Url: "/magaza",
  nav3Label: "Hikâyemiz",
  nav3Url: "#story",
  nav4Label: "Journal",
  nav4Url: "#journal",
  nav1LabelGlobal: "Shop",
  nav2LabelGlobal: "Collections",
  nav3LabelGlobal: "Our Story",
  nav4LabelGlobal: "Journal",
  heroEyebrowGlobal: "Curated pieces for considered living",
  heroTitleGlobal: "Make the everyday",
  heroTitleAccentGlobal: "extraordinary.",
  heroCopyGlobal: "Timeless objects with texture, craftsmanship and a story—for your home, wardrobe and closest companions.",
  heroButtonGlobal: "Explore the new edit",
  introTitleGlobal: "Fewer, better things.",
  introCopyGlobal: "A modern lifestyle collection spanning tactile textiles, consciously made accessories and thoughtfully selected pieces for our companions.",
  productsEyebrowGlobal: "New arrivals · Global",
  productsTitleGlobal: "Discover now",
  manifestoEyebrowGlobal: "Brand standard",
  manifestoQuoteGlobal: "Good design is not only how it looks, but how it makes your life feel.",
  manifestoPrinciple1Global: "Natural materials",
  manifestoPrinciple2Global: "Responsible production",
  manifestoPrinciple3Global: "Enduring design",
  journalEyebrowGlobal: "Living notes",
  journalTitleGlobal: "Creating small rituals at home",
  journalCopyGlobal: "Ways to turn ordinary moments into calm rituals that engage the senses.",
  journalButtonGlobal: "Read the story",
  footerTaglineGlobal: "Beautiful things for considered living.",
  newsletterTitleGlobal: "Join our letters",
  newsletterCopyGlobal: "New edits and inspiring stories, delivered occasionally.",
  footerLocationGlobal: "Istanbul · Worldwide",
  seoTitle: "MYSA OBJETS — Seçkili Yaşam Ürünleri",
  seoDescription: "Eviniz, gardırobunuz ve dostlarınız için zamansız, özenle seçilmiş yaşam ürünleri.",
  seoKeywords: "seçkili yaşam ürünleri, tekstil, ev, aksesuar, pet",
  seoImageUrl: "/og.png",
  heroEyebrow: "Yavaş yaşam için seçilmiş parçalar",
  heroTitle: "Gündelik olanı",
  heroTitleAccent: "olağanüstü kılın.",
  heroCopy: "Eviniz, gardırobunuz ve en yakın dostlarınız için; dokusu, işçiliği ve hikâyesi olan zamansız objeler.",
  heroButton: "Yeni seçkiyi keşfet",
  heroImageUrl: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=2000&q=90",
  introTitle: "Daha az, ama daha iyi.",
  introCopy: "Dokunmak isteyeceğiniz tekstillerden bilinçli üretilmiş aksesuarlara ve dostlarımız için özenle seçilmiş ürünlere uzanan modern bir yaşam koleksiyonu.",
  showCategories:"true",
  showProducts:"true",
  showJournal:"true",
  showManifesto:"true",
  homepageSectionOrder:"categories,products,custom,manifesto,journal",
  manifestoEyebrow:"Marka standardı",
  manifestoQuote:"İyi tasarım yalnızca nasıl göründüğü değil, hayatınıza nasıl hissettirdiğidir.",
  manifestoPrinciple1:"Doğal malzemeler",
  manifestoPrinciple2:"Sorumlu üretim",
  manifestoPrinciple3:"Uzun ömürlü tasarım",
  journalEyebrow:"Yaşam notları",
  journalTitle:"Evinizde küçük ritüeller yaratmak",
  journalCopy:"Sabahın ilk ışığından günün son fincanına; sıradan anları duyulara hitap eden sakin ritüellere dönüştürmenin yolları.",
  journalButton:"Yazıyı oku",
  journalImageUrl:"https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1300&q=90",
  footerTagline:"Beautiful things for considered living.",
  footerLocation:"İstanbul · Dünya",
  newsletterTitle:"Mektuplarımıza katılın",
  newsletterCopy:"Yeni seçkiler ve ilham veren hikâyeler.",
  instagramUrl:"",
  pinterestUrl:"",
  shippingTr:"99",
  freeShippingTr:"1500",
  shippingGlobal:"15",
  freeShippingGlobal:"150",
  shippingGlobalEnabled:"false",
  shippingGlobalCountries:"",
  taxDisplayMode:"pending",
  shippingPolicyTr:"Sipariş talepleri onaylandıktan sonra hazırlanır. Teslimat süresi ürün ve teslimat adresine göre paylaşılır. Kargo ücreti sipariş özetinde ayrıca gösterilir.",
  returnsPolicyTr:"İade veya değişim talebiniz için sipariş numaranızla iletişim formundan bize ulaşın. Ürünün kullanılmamış ve yeniden satışa uygun durumda olması beklenir.",
  shippingPolicyGlobal:"Global order requests are reviewed before preparation. Delivery timing and available destinations are confirmed according to the products and destination country.",
  returnsPolicyGlobal:"For a return or exchange request, contact us with your order number. Products should be unused and suitable for resale.",
  privacyPolicy:"Sipariş ve iletişim formlarında paylaştığınız bilgiler; talebinizi işlemek, teslimat sürecini yürütmek ve sizinle iletişim kurmak amacıyla kaydedilir. Ödeme veya kart bilgisi bu aşamada alınmaz. Kişisel bilgilerinizi mesaj alanlarına gereğinden fazla yazmayın.",
  privacyPolicyGlobal:"Information shared through order and contact forms is stored to process your request, arrange delivery and communicate with you. Payment or card information is not collected at this stage. Do not include unnecessary personal information in message fields.",
  legalStatus:"draft",
  legalBusinessType:"Şirket türü belirlenecek",
  legalName:"",
  legalAddress:"",
  legalTaxOffice:"",
  legalTaxNumber:"",
  legalMersisNumber:"",
  legalEmail:"",
  legalPhone:"",
  returnAddress:"",
  returnCarrier:"",
  etbisStatus:"not_started",
  preliminaryInformationTr:"TASLAK — Sipariş öncesinde ürünün temel nitelikleri, vergiler dâhil toplam fiyatı, teslimat masrafları, satıcı bilgileri, cayma hakkı ve başvuru yolları müşteriye açıkça gösterilecektir. Şirket ve ödeme altyapısı kesinleştiğinde uzman kontrolüyle tamamlanacaktır.",
  distanceSalesTermsTr:"TASLAK — Mesafeli satış sözleşmesi; satıcı ve alıcı bilgileri, ürünler, toplam bedel, ödeme, teslimat, cayma hakkı, iade süreci, uyuşmazlık çözümü ve yürürlük hükümleriyle şirket kurulduktan sonra tamamlanacaktır.",
  salesMode:"order_request",
  orderIntakeStatus:"open",
  paymentProviderStatus:"not_started",
  paymentProviderName:"",
};
const storefrontUrlKeys = ["announcementUrlTr", "announcementUrlGlobal", "nav1Url", "nav2Url", "nav3Url", "nav4Url"] as const;
const imageUrlKeys = ["brandLogoUrl", "faviconUrl", "seoImageUrl", "heroImageUrl", "journalImageUrl"] as const;
const externalUrlKeys = ["instagramUrl", "pinterestUrl"] as const;
const longTextKeys = new Set(["shippingPolicyTr", "returnsPolicyTr", "shippingPolicyGlobal", "returnsPolicyGlobal", "privacyPolicy", "privacyPolicyGlobal", "preliminaryInformationTr", "distanceSalesTermsTr"]);
const booleanKeys = ["showAnnouncement", "showCategories", "showProducts", "showJournal", "showManifesto", "shippingGlobalEnabled"] as const;
const ownerOnlyKeys=new Set<keyof typeof defaults>(["legalStatus","legalBusinessType","legalName","legalAddress","legalTaxOffice","legalTaxNumber","legalMersisNumber","legalEmail","legalPhone","etbisStatus","preliminaryInformationTr","distanceSalesTermsTr","salesMode","paymentProviderStatus","paymentProviderName","taxDisplayMode"]);
const allowedEnums: Partial<Record<keyof typeof defaults, readonly string[]>> = {
  legalStatus: ["draft", "complete"], salesMode: ["order_request", "live"], orderIntakeStatus: ["open", "paused"],
  paymentProviderStatus: ["not_started", "application", "sandbox", "active"], etbisStatus: ["not_started", "in_progress", "complete"], taxDisplayMode: ["pending", "tax_included"],
};
export async function GET() { try { const rows = await getDb().select().from(storeSettings); return Response.json({ settings: { ...defaults, ...Object.fromEntries(rows.map(row => [row.key, row.value])) } }); } catch { return Response.json({ settings: defaults }); } }
export async function PUT(request: Request) {
  const user=await getChatGPTUser();
  if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const parsed=await readBoundedJson(request,160_000);if(parsed.error)return parsed.error;const body=parsed.body!;
  const db = getDb(); const allowed = Object.keys(defaults) as (keyof typeof defaults)[];
  const protectedKey=allowed.find(key=>ownerOnlyKeys.has(key)&&body[key]!==undefined);if(user.role!=="owner"&&protectedKey)return Response.json({error:"Şirket, ödeme ve canlı satış ayarlarını yalnızca mağaza sahibi değiştirebilir."},{status:403});
  const invalidType=allowed.find(key=>body[key]!==undefined&&!(["string","number","boolean"].includes(typeof body[key])));
  if(invalidType)return Response.json({error:`${invalidType} alanı geçersiz.`},{status:400});
  const rows=await db.select().from(storeSettings);const current=Object.fromEntries(rows.map(row=>[row.key,row.value]));const values=Object.fromEntries(allowed.map(key=>[key,String(body[key]??current[key]??defaults[key])]));
  const oversized=allowed.find(key=>values[key].length>(longTextKeys.has(key)?50_000:10_000));
  if(oversized)return Response.json({error:`${oversized} alanı izin verilen uzunluğu aşıyor.`},{status:400});
  const unsafeStorefrontUrl=storefrontUrlKeys.find(key=>!isSafeStorefrontUrl(values[key],{allowEmpty:false}));
  if(unsafeStorefrontUrl)return Response.json({error:`${unsafeStorefrontUrl} güvenli bir site içi yol, bölüm bağlantısı veya HTTPS adresi olmalıdır.`},{status:400});
  const unsafeImageUrl=imageUrlKeys.find(key=>!isSafeImageUrl(values[key]));
  if(unsafeImageUrl)return Response.json({error:`${unsafeImageUrl} güvenli bir site içi görsel yolu veya HTTPS adresi olmalıdır.`},{status:400});
  const unsafeExternalUrl=externalUrlKeys.find(key=>!isSafeExternalUrl(values[key]));
  if(unsafeExternalUrl)return Response.json({error:`${unsafeExternalUrl} güvenli bir HTTPS adresi olmalıdır.`},{status:400});
  const invalidBoolean=booleanKeys.find(key=>values[key]!=="true"&&values[key]!=="false");
  if(invalidBoolean)return Response.json({error:`${invalidBoolean} açık veya kapalı olmalıdır.`},{status:400});
  const invalidEnum=allowed.find(key=>allowedEnums[key]&&!allowedEnums[key]!.includes(values[key]));
  if(invalidEnum)return Response.json({error:`${invalidEnum} seçimi geçersiz.`},{status:400});
  const shippingNumbers=["shippingTr","freeShippingTr","shippingGlobal","freeShippingGlobal"].map(key=>Number(values[key]));
  if(shippingNumbers.some(value=>!Number.isFinite(value)||value<0||value>100_000_000))return Response.json({error:"Kargo ücretleri ve ücretsiz teslimat sınırları 0–100.000.000 aralığında olmalıdır."},{status:400});
  const countries=[...new Set(values.shippingGlobalCountries.split(",").map(country=>country.trim()).filter(Boolean))];if(countries.length>50||countries.some(country=>country.length>100))return Response.json({error:"En fazla 50 desteklenen ülke, virgülle ayrılmış olarak girilebilir."},{status:400});values.shippingGlobalCountries=countries.join(", ");
  if(values.shippingGlobalEnabled==="true"&&!values.shippingGlobalCountries.split(",").some(country=>country.trim()))return Response.json({error:"Global teslimat açılmadan önce en az bir desteklenen ülke girilmelidir."},{status:409});
  values.legalEmail=normalizeEmail(values.legalEmail);
  const isDraftLegalText=(value:string)=>value.trimStart().toLocaleUpperCase("tr-TR").startsWith("TASLAK");
  if(values.legalStatus==="complete"){const required=[["Ticari unvan",values.legalName],["Şirket türü",values.legalBusinessType],["Merkez adresi",values.legalAddress],["Vergi dairesi",values.legalTaxOffice],["Vergi numarası",values.legalTaxNumber],["Hukuki e-posta",values.legalEmail],["Telefon",values.legalPhone],["İade adresi",values.returnAddress],["Ön bilgilendirme",values.preliminaryInformationTr],["Mesafeli satış sözleşmesi",values.distanceSalesTermsTr]];const missing=required.filter(([,value])=>!value.trim()).map(([label])=>label);if(missing.length)return Response.json({error:`Yayına hazır durumu için eksik alanlar: ${missing.join(", ")}.`},{status:409});if(values.legalBusinessType.trim()==="Şirket türü belirlenecek")return Response.json({error:"Yayına hazır durumu için gerçek şirket türünü seçin."},{status:409});if(!/^\d{10,11}$/.test(values.legalTaxNumber.trim()))return Response.json({error:"Vergi numarası 10 veya 11 rakam olmalıdır."},{status:409});if(values.legalMersisNumber.trim()&&!/^\d{16}$/.test(values.legalMersisNumber.trim()))return Response.json({error:"MERSİS numarası 16 rakam olmalıdır."},{status:409});if(!isValidEmail(values.legalEmail)||!isValidPhone(values.legalPhone))return Response.json({error:"Hukuki iletişim e-postası veya telefonu geçersiz."},{status:409});if(isDraftLegalText(values.preliminaryInformationTr)||isDraftLegalText(values.distanceSalesTermsTr))return Response.json({error:"Taslak hukuki metinlerle şirket bilgileri yayına hazır olarak işaretlenemez."},{status:409});}
  if(values.salesMode==="live"){const blockers:string[]=["ödeme sağlayıcısı teknik entegrasyonu"];if(values.legalStatus!=="complete")blockers.push("şirket ve hukuki bilgiler");if(values.paymentProviderStatus!=="active"||!values.paymentProviderName.trim())blockers.push("aktif ödeme sağlayıcısı");if(values.etbisStatus!=="complete")blockers.push("ETBİS kaydı");if(!values.returnCarrier.trim())blockers.push("anlaşmalı iade kargosu");if(values.taxDisplayMode!=="tax_included")blockers.push("vergiler dâhil tüketici fiyatı onayı");if(isDraftLegalText(values.preliminaryInformationTr)||isDraftLegalText(values.distanceSalesTermsTr))blockers.push("onaylı sözleşme metinleri");const activeProducts=await db.select({id:products.id}).from(products).where(eq(products.active,true)).limit(1);if(!activeProducts.length)blockers.push("yayındaki ürün");if(blockers.length)return Response.json({error:`Canlı satış modu için tamamlanmalı: ${blockers.join(", ")}.`},{status:409});}
  const changedKeys=allowed.filter(key=>(current[key]??defaults[key])!==values[key]);
  await db.batch(allowed.map(key => db.insert(storeSettings).values({ key, value: values[key], updatedAt: new Date().toISOString() }).onConflictDoUpdate({ target: storeSettings.key, set: { value: values[key], updatedAt: new Date().toISOString() } })));
  if(changedKeys.length)await recordAudit({user,action:"settings.update",entityType:"settings",summary:`${changedKeys.length} mağaza ayarı güncellendi.`,before:Object.fromEntries(changedKeys.map(key=>[key,current[key]??defaults[key]])),after:Object.fromEntries(changedKeys.map(key=>[key,values[key]]))});
  return Response.json({ settings: values });
}
