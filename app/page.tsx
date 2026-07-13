"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { categories as sampleCategories, products as sampleProducts, type Market } from "./content";
import {getPreferredMarket,setPreferredMarket} from "./market-preference";

type StoreProduct = (typeof sampleProducts)[number] & { id?: number; active?: boolean; featured?:boolean; slug?:string; nameGlobal?:string; descriptionGlobal?:string };
type DatabaseProduct = {
  id: number;
  slug: string;
  nameTr: string;
  nameEn: string;
  descriptionTr: string;
  descriptionEn: string;
  imageUrl: string;
  priceTr: number;
  priceGlobal: number;
  marketTr: boolean;
  marketGlobal: boolean;
  featured: boolean;
  active: boolean;
};
type GlobalContent = { nav1LabelGlobal:string; nav2LabelGlobal:string; nav3LabelGlobal:string; nav4LabelGlobal:string; heroEyebrowGlobal:string; heroTitleGlobal:string; heroTitleAccentGlobal:string; heroCopyGlobal:string; heroButtonGlobal:string; introTitleGlobal:string; introCopyGlobal:string; productsEyebrowGlobal:string; productsTitleGlobal:string; manifestoEyebrowGlobal:string; manifestoQuoteGlobal:string; manifestoPrinciple1Global:string; manifestoPrinciple2Global:string; manifestoPrinciple3Global:string; journalEyebrowGlobal:string; journalTitleGlobal:string; journalCopyGlobal:string; journalButtonGlobal:string; footerTaglineGlobal:string; newsletterTitleGlobal:string; newsletterCopyGlobal:string; footerLocationGlobal:string };
type StoreSettings = { brandName:string; brandSuffix:string; brandLogoUrl?:string; faviconUrl?:string; announcementTr:string; announcementGlobal:string; nav1Label?:string; nav1Url?:string; nav2Label?:string; nav2Url?:string; nav3Label?:string; nav3Url?:string; nav4Label?:string; nav4Url?:string; heroEyebrow:string; heroTitle:string; heroTitleAccent:string; heroCopy:string; heroButton:string; heroImageUrl:string; introTitle:string; introCopy:string; showCategories:string; showProducts:string; showJournal:string; showManifesto?:string; manifestoEyebrow?:string; manifestoQuote?:string; manifestoPrinciple1?:string; manifestoPrinciple2?:string; manifestoPrinciple3?:string; journalEyebrow?:string; journalTitle?:string; journalCopy?:string; journalButton?:string; journalImageUrl?:string; footerTagline?:string; footerLocation?:string; newsletterTitle?:string; newsletterCopy?:string; instagramUrl?:string; pinterestUrl?:string } & Partial<GlobalContent>;
type StoreCategory = { id?:number; name:string; nameGlobal?:string; image:string; alt:string; parentId?:number|null };
const defaultSettings:StoreSettings = { brandName:"MYSA", brandSuffix:"OBJETS", announcementTr:"1.500 TL üzeri ücretsiz gönderim", announcementGlobal:"Complimentary shipping over €150", heroEyebrow:"Yavaş yaşam için seçilmiş parçalar", heroTitle:"Gündelik olanı", heroTitleAccent:"olağanüstü kılın.", heroCopy:"Eviniz, gardırobunuz ve en yakın dostlarınız için; dokusu, işçiliği ve hikâyesi olan zamansız objeler.", heroButton:"Yeni seçkiyi keşfet", heroImageUrl:"https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=2000&q=90", introTitle:"Daha az, ama daha iyi.", introCopy:"Dokunmak isteyeceğiniz tekstillerden bilinçli üretilmiş aksesuarlara ve dostlarımız için özenle seçilmiş ürünlere uzanan modern bir yaşam koleksiyonu.", showCategories:"true", showProducts:"true", showJournal:"true" };

const Arrow = () => <span aria-hidden="true">&#8599;</span>;

export default function Home() {
  const [market, setMarket] = useState<Market>("TR");
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [catalogProducts, setCatalogProducts] = useState<StoreProduct[]>(sampleProducts);
  const [catalogSource, setCatalogSource] = useState<"sample" | "live">("sample");
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);
  const [storeCategories, setStoreCategories] = useState<StoreCategory[]>(sampleCategories);
  const [newsletterEmail,setNewsletterEmail]=useState("");
  const [newsletterMessage,setNewsletterMessage]=useState("");

  useEffect(()=>{setMarket(getPreferredMarket());},[]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/products")
      .then(async (response) => response.ok ? response.json() : Promise.reject())
      .then((data: { products?: DatabaseProduct[] }) => {
        if (cancelled || !data.products?.length) return;
        const liveProducts: StoreProduct[] = data.products
          .filter((product) => product.active)
          .map((product) => ({
            id: product.id,
            slug: product.slug,
            name: product.nameTr,
            nameGlobal: product.nameEn || product.nameTr,
            description: product.descriptionTr,
            descriptionGlobal: product.descriptionEn || product.descriptionTr,
            priceTR: product.priceTr,
            priceGlobal: product.priceGlobal,
            markets: [product.marketTr ? "TR" : null, product.marketGlobal ? "GLOBAL" : null].filter(Boolean) as Market[],
            image: product.imageUrl || "https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=900&q=88",
            alt: product.nameTr,
            badge: "YENİ",
            featured: product.featured,
            active: product.active,
          }));
        setCatalogProducts(liveProducts);
        setCatalogSource("live");
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { fetch("/api/settings").then(response => response.json()).then(data => data.settings && setSettings(data.settings)).catch(() => undefined); }, []);
  useEffect(() => { fetch("/api/categories").then(response => response.json()).then(data => { const rows = (data.categories ?? []).filter((category:{parentId:number|null;active:boolean}) => !category.parentId && category.active !== false); if (rows.length) setStoreCategories(rows.slice(0,3).map((category:{id:number;nameTr:string;nameEn:string;imageUrl:string;parentId:number|null},index:number) => ({ id:category.id, name:category.nameTr, nameGlobal:category.nameEn||category.nameTr, image:category.imageUrl || sampleCategories[index % sampleCategories.length].image, alt:`${category.nameTr} kategorisi`, parentId:category.parentId }))); }).catch(() => undefined); }, []);
  useEffect(() => { fetch("/api/cart").then(response => response.json()).then(data => setCartCount((data.items ?? []).reduce((sum:number,item:{quantity:number}) => sum + item.quantity, 0))).catch(() => undefined); }, []);
  useEffect(()=>{setPreferredMarket(market);},[market]);

  const visibleProducts = useMemo(() => {
    const marketProducts=catalogProducts.filter((product) => product.markets.includes(market));
    const featuredProducts=marketProducts.filter(product=>product.featured);
    return (featuredProducts.length?featuredProducts:marketProducts).slice(0,8);
  }, [catalogProducts, market]);

  const changeMarket = (next: Market) => {
    setMarket(next);
    setPreferredMarket(next);
    setNotice(next === "TR" ? "Türkiye mağazasına geçildi" : "Global mağazaya geçildi");
    window.setTimeout(() => setNotice(""), 2200);
  };

  const addToCart = async (product: StoreProduct) => {
    if (product.id) {
      const response = await fetch("/api/cart", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ productId:product.id, quantity:1, market }) });
      if (!response.ok) { const data=await response.json();setNotice(data.error??(market==="GLOBAL"?"Product could not be added":"Ürün eklenemedi")); return; }
    }
    setCartCount((count) => count + 1);
    setNotice(market === "TR" ? `${product.name} çantanıza eklendi` : `${product.nameGlobal || product.name} added to your bag`);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const subscribe=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setNewsletterMessage("");const response=await fetch("/api/newsletter",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:newsletterEmail,market})});const data=await response.json();if(response.ok){setNewsletterEmail("");setNewsletterMessage(market==="TR"?"Kaydınız alındı.":"You are subscribed.");}else setNewsletterMessage(data.error??"Kayıt tamamlanamadı.");};
  const isGlobal=market==="GLOBAL";
  const globalText=(key:keyof GlobalContent,fallback:string)=>isGlobal?(settings[key]||fallback):fallback;
  const badgeText=(badge:string)=>!isGlobal?badge:({"YENİ":"NEW","ÇOK SEVİLEN":"BESTSELLER"}[badge]||badge);

  return (
    <main>
      <div className="announcement">
        <p>{market === "TR" ? settings.announcementTr : settings.announcementGlobal}</p>
        <button onClick={() => changeMarket(market === "TR" ? "GLOBAL" : "TR")}>
          {market === "TR" ? "TR / TRY" : "GLOBAL / EUR"} <span>⌄</span>
        </button>
      </div>

      <header className="header">
        <button className="menu-button" aria-label={isGlobal?"Open menu":"Menüyü aç"} onClick={() => setMenuOpen(!menuOpen)}>
          <i></i><i></i>
        </button>
        <a className={`wordmark${settings.brandLogoUrl?" image-wordmark":""}`} href="#top" aria-label={`${settings.brandName} ana sayfa`}>{settings.brandLogoUrl?<img src={settings.brandLogoUrl} alt={`${settings.brandName} ${settings.brandSuffix}`}/>:<>{settings.brandName}<span>{settings.brandSuffix}</span></>}</a>
        <nav className={menuOpen ? "nav open" : "nav"} aria-label="Ana menü">
          <a href={settings.nav1Url || "/magaza"} onClick={() => setMenuOpen(false)}>{isGlobal?settings.nav1LabelGlobal||"Shop":settings.nav1Label||"Mağaza"}</a>
          <a href={settings.nav2Url || "/magaza"} onClick={() => setMenuOpen(false)}>{isGlobal?settings.nav2LabelGlobal||"Collections":settings.nav2Label||"Koleksiyonlar"}</a>
          <a href={settings.nav3Url || "#story"} onClick={() => setMenuOpen(false)}>{isGlobal?settings.nav3LabelGlobal||"Our Story":settings.nav3Label||"Hikâyemiz"}</a>
          <a href={settings.nav4Url || "#journal"} onClick={() => setMenuOpen(false)}>{isGlobal?settings.nav4LabelGlobal||"Journal":settings.nav4Label||"Journal"}</a>
        </nav>
        <div className="header-actions">
          <a href="/magaza" aria-label={isGlobal?"Search products":"Ürün ara"}>⌕</a>
          <a className="cart-link" href="/sepet" aria-label={isGlobal?`Bag, ${cartCount} items`:`Çanta, ${cartCount} ürün`}>{isGlobal?"Bag":"Çanta"} <b>{cartCount}</b></a>
        </div>
      </header>

      <section className="hero" id="top" style={{backgroundImage:`linear-gradient(90deg,rgba(22,29,23,.78) 0%,rgba(22,29,23,.22) 56%,rgba(22,29,23,.06)), url("${settings.heroImageUrl.replaceAll('"','%22')}")`}}>
        <div className="hero-content">
          <p className="eyebrow">{globalText("heroEyebrowGlobal",settings.heroEyebrow)}</p>
          <h1>{globalText("heroTitleGlobal",settings.heroTitle)}<br/><em>{globalText("heroTitleAccentGlobal",settings.heroTitleAccent)}</em></h1>
          <p className="hero-copy">{globalText("heroCopyGlobal",settings.heroCopy)}</p>
          <a className="text-link light" href="/magaza">{globalText("heroButtonGlobal",settings.heroButton)} <Arrow /></a>
        </div>
        <div className="hero-index">{isGlobal?"SELECTION":"SEÇKİ"} · 01</div>
      </section>

      <section className="intro" id="story">
        <p className="section-label">{isGlobal?"Our world":"Bizim dünyamız"}</p>
        <div>
          <h2>{globalText("introTitleGlobal",settings.introTitle)}</h2>
          <p>{globalText("introCopyGlobal",settings.introCopy)}</p>
        </div>
      </section>

      {settings.showCategories==="true"&&<section className="category-grid" id="categories">
        {storeCategories.map((category, index) => (
          <article className={`category-card category-${index + 1}`} key={category.id ?? category.name}>
            <img src={category.image} alt={category.alt} />
            <div className="category-info">
              <span>0{index + 1}</span>
              <h3>{isGlobal?category.nameGlobal||category.name:category.name}</h3>
              <a href="/magaza" aria-label={isGlobal?`Open ${category.nameGlobal||category.name} collection`:`${category.name} koleksiyonunu aç`}><Arrow /></a>
            </div>
          </article>
        ))}
      </section>}

      {settings.showProducts==="true"&&<section className="products" id="shop">
        <div className="section-heading">
          <div>
            <p className="section-label">{isGlobal?settings.productsEyebrowGlobal||"New arrivals · Global":`Yeni gelenler · Türkiye${catalogSource === "live" ? " · Güncel katalog" : ""}`}</p>
            <h2>{isGlobal?settings.productsTitleGlobal||"Discover now":"Şimdi keşfedin"}</h2>
          </div>
          <div className="market-switch" aria-label="Mağaza bölgesi">
            <button className={market === "TR" ? "active" : ""} onClick={() => changeMarket("TR")}>Türkiye</button>
            <button className={market === "GLOBAL" ? "active" : ""} onClick={() => changeMarket("GLOBAL")}>Global</button>
          </div>
        </div>
        <div className="product-grid">
          {visibleProducts.map((product) => (
            <article className="product-card" key={product.id ?? product.name}>
              <div className="product-image">
                {product.slug && <a className="product-detail-link" href={`/urun/${encodeURIComponent(product.slug)}`} aria-label={`${market === "TR" ? product.name : product.nameGlobal || product.name} detaylarını aç`}></a>}
                <img src={product.image} alt={market === "TR" ? product.alt : product.nameGlobal || product.alt} />
                {product.badge && <span>{badgeText(product.badge)}</span>}
                <button onClick={() => addToCart(product)} aria-label={`${market === "TR" ? product.name : product.nameGlobal || product.name} ürününü çantaya ekle`}>+</button>
              </div>
              <div className="product-meta">
                <div><h3>{product.slug?<a href={`/urun/${encodeURIComponent(product.slug)}`}>{market === "TR" ? product.name : product.nameGlobal || product.name}</a>:market === "TR" ? product.name : product.nameGlobal || product.name}</h3><p>{market === "TR" ? product.description : product.descriptionGlobal || product.description}</p></div>
                <strong>{market === "TR" ? `${product.priceTR.toLocaleString("tr-TR")} TL` : `€${product.priceGlobal}`}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>}

      {(settings.showManifesto??"true")==="true"&&<section className="manifesto">
        <p className="eyebrow">{isGlobal?settings.manifestoEyebrowGlobal||"Brand standard":settings.manifestoEyebrow||`${settings.brandName} STANDARDI`}</p>
        <blockquote>“{isGlobal?settings.manifestoQuoteGlobal||"Good design is not only how it looks, but how it makes your life feel.":settings.manifestoQuote||"İyi tasarım yalnızca nasıl göründüğü değil, hayatınıza nasıl hissettirdiğidir."}”</blockquote>
        <div className="principles">
          <span>{isGlobal?settings.manifestoPrinciple1Global||"Natural materials":settings.manifestoPrinciple1||"Doğal malzemeler"}</span><span>{isGlobal?settings.manifestoPrinciple2Global||"Responsible production":settings.manifestoPrinciple2||"Sorumlu üretim"}</span><span>{isGlobal?settings.manifestoPrinciple3Global||"Enduring design":settings.manifestoPrinciple3||"Uzun ömürlü tasarım"}</span>
        </div>
      </section>}

      {settings.showJournal==="true"&&<section className="journal" id="journal">
        <article className="journal-image" style={{backgroundImage:`url("${(settings.journalImageUrl||"https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=1300&q=90").replaceAll('"','%22')}")`}}><span>JOURNAL · 04</span></article>
        <article className="journal-copy">
          <p className="section-label">{isGlobal?settings.journalEyebrowGlobal||"Living notes":settings.journalEyebrow||"Yaşam notları"}</p>
          <h2>{isGlobal?settings.journalTitleGlobal||"Creating small rituals at home":settings.journalTitle||"Evinizde küçük ritüeller yaratmak"}</h2>
          <p>{isGlobal?settings.journalCopyGlobal||"Ways to turn ordinary moments into calm rituals that engage the senses.":settings.journalCopy||"Sıradan anları duyulara hitap eden sakin ritüellere dönüştürmenin yolları."}</p>
          <a className="text-link" href="#top">{isGlobal?settings.journalButtonGlobal||"Read the story":settings.journalButton||"Yazıyı oku"} <Arrow /></a>
        </article>
      </section>}

      <footer>
        <div className="footer-top">
          <div><a className={`wordmark footer-logo${settings.brandLogoUrl?" image-wordmark":""}`} href="#top">{settings.brandLogoUrl?<img src={settings.brandLogoUrl} alt={`${settings.brandName} ${settings.brandSuffix}`}/>:<>{settings.brandName}<span>{settings.brandSuffix}</span></>}</a><p>{isGlobal?settings.footerTaglineGlobal||"Beautiful things for considered living.":settings.footerTagline||"Beautiful things for considered living."}</p></div>
          <div><h4>{isGlobal?"Explore":"Keşfet"}</h4><a href="/magaza">{isGlobal?"New arrivals":"Yeni gelenler"}</a><a href="/magaza">{isGlobal?"Collections":"Koleksiyonlar"}</a><a href="#journal">Journal</a></div>
          <div><h4>{isGlobal?"Help":"Yardım"}</h4><a href="/siparis-takip">{isGlobal?"Track order":"Sipariş takibi"}</a><a href="/politikalar">{isGlobal?"Shipping & Returns":"Teslimat & İade"}</a><a href="/iletisim">{isGlobal?"Contact us":"Bize ulaşın"}</a></div>
          <div className="newsletter"><h4>{isGlobal?settings.newsletterTitleGlobal||"Join our letters":settings.newsletterTitle||"Mektuplarımıza katılın"}</h4><p>{isGlobal?settings.newsletterCopyGlobal||"New edits and inspiring stories, delivered occasionally.":settings.newsletterCopy||"Yeni seçkiler ve ilham veren hikâyeler."}</p><form onSubmit={subscribe}><label className="newsletter-email"><span className="sr-only">{isGlobal?"Email address":"E-posta adresi"}</span><input type="email" value={newsletterEmail} onChange={event=>setNewsletterEmail(event.target.value)} placeholder={isGlobal?"Your email address":"E-posta adresiniz"} required/><button aria-label={isGlobal?"Subscribe":"Kaydol"}>→</button></label><label className="newsletter-consent"><input type="checkbox" required/><span>{isGlobal?<><a href="/politikalar#gizlilik">I have read the privacy notice</a> and wish to receive edits and news.</>:<><a href="/politikalar#gizlilik">Gizlilik açıklamasını</a> okudum; seçki ve duyuruları almak istiyorum.</>}</span></label>{newsletterMessage&&<small className="newsletter-message" role="status">{newsletterMessage}</small>}</form></div>
        </div>
        <div className="footer-bottom"><span>© 2026 {settings.brandName} {settings.brandSuffix}</span><span>{isGlobal?settings.footerLocationGlobal||"Istanbul · Worldwide":settings.footerLocation||"İstanbul · Dünya"}</span><span>{settings.instagramUrl?<a href={settings.instagramUrl} target="_blank" rel="noreferrer">Instagram</a>:"Instagram"} &nbsp; {settings.pinterestUrl?<a href={settings.pinterestUrl} target="_blank" rel="noreferrer">Pinterest</a>:"Pinterest"}</span></div>
      </footer>

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
