"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { categories as sampleCategories, products as sampleProducts, type Market } from "./content";

type StoreProduct = (typeof sampleProducts)[number] & { id?: number; active?: boolean; slug?:string; nameGlobal?:string; descriptionGlobal?:string };
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
  active: boolean;
};
type StoreSettings = { brandName:string; brandSuffix:string; announcementTr:string; announcementGlobal:string; heroEyebrow:string; heroTitle:string; heroTitleAccent:string; heroCopy:string; heroButton:string; heroImageUrl:string; introTitle:string; introCopy:string };
type StoreCategory = { id?:number; name:string; image:string; alt:string; parentId?:number|null };
const defaultSettings:StoreSettings = { brandName:"MYSA", brandSuffix:"OBJETS", announcementTr:"1.500 TL üzeri ücretsiz gönderim", announcementGlobal:"Complimentary shipping over €150", heroEyebrow:"Yavaş yaşam için seçilmiş parçalar", heroTitle:"Gündelik olanı", heroTitleAccent:"olağanüstü kılın.", heroCopy:"Eviniz, gardırobunuz ve en yakın dostlarınız için; dokusu, işçiliği ve hikâyesi olan zamansız objeler.", heroButton:"Yeni seçkiyi keşfet", heroImageUrl:"https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=2000&q=90", introTitle:"Daha az, ama daha iyi.", introCopy:"Dokunmak isteyeceğiniz tekstillerden bilinçli üretilmiş aksesuarlara ve dostlarımız için özenle seçilmiş ürünlere uzanan modern bir yaşam koleksiyonu." };

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
            active: product.active,
          }));
        setCatalogProducts(liveProducts);
        setCatalogSource("live");
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, []);

  useEffect(() => { fetch("/api/settings").then(response => response.json()).then(data => data.settings && setSettings(data.settings)).catch(() => undefined); }, []);
  useEffect(() => { fetch("/api/categories").then(response => response.json()).then(data => { const rows = (data.categories ?? []).filter((category:{parentId:number|null;active:boolean}) => !category.parentId && category.active !== false); if (rows.length) setStoreCategories(rows.slice(0,3).map((category:{id:number;nameTr:string;imageUrl:string;parentId:number|null},index:number) => ({ id:category.id, name:category.nameTr, image:category.imageUrl || sampleCategories[index % sampleCategories.length].image, alt:`${category.nameTr} kategorisi`, parentId:category.parentId }))); }).catch(() => undefined); }, []);
  useEffect(() => { fetch("/api/cart").then(response => response.json()).then(data => setCartCount((data.items ?? []).reduce((sum:number,item:{quantity:number}) => sum + item.quantity, 0))).catch(() => undefined); }, []);

  const visibleProducts = useMemo(
    () => catalogProducts.filter((product) => product.markets.includes(market)),
    [catalogProducts, market],
  );

  const changeMarket = (next: Market) => {
    setMarket(next);
    setNotice(next === "TR" ? "Türkiye mağazasına geçildi" : "Global mağazaya geçildi");
    window.setTimeout(() => setNotice(""), 2200);
  };

  const addToCart = async (product: StoreProduct) => {
    if (product.id) {
      const response = await fetch("/api/cart", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ productId:product.id, quantity:1, market }) });
      if (!response.ok) { setNotice("Ürün eklenemedi"); return; }
    }
    setCartCount((count) => count + 1);
    setNotice(market === "TR" ? `${product.name} çantanıza eklendi` : `${product.nameGlobal || product.name} added to your bag`);
    window.setTimeout(() => setNotice(""), 2200);
  };

  const subscribe=async(event:FormEvent<HTMLFormElement>)=>{event.preventDefault();setNewsletterMessage("");const response=await fetch("/api/newsletter",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email:newsletterEmail,market})});const data=await response.json();if(response.ok){setNewsletterEmail("");setNewsletterMessage(market==="TR"?"Kaydınız alındı.":"You are subscribed.");}else setNewsletterMessage(data.error??"Kayıt tamamlanamadı.");};

  return (
    <main>
      <div className="announcement">
        <p>{market === "TR" ? settings.announcementTr : settings.announcementGlobal}</p>
        <button onClick={() => changeMarket(market === "TR" ? "GLOBAL" : "TR")}>
          {market === "TR" ? "TR / TRY" : "GLOBAL / EUR"} <span>⌄</span>
        </button>
      </div>

      <header className="header">
        <button className="menu-button" aria-label="Menüyü aç" onClick={() => setMenuOpen(!menuOpen)}>
          <i></i><i></i>
        </button>
        <a className="wordmark" href="#top" aria-label={`${settings.brandName} ana sayfa`}>{settings.brandName}<span>{settings.brandSuffix}</span></a>
        <nav className={menuOpen ? "nav open" : "nav"} aria-label="Ana menü">
          <a href="/magaza" onClick={() => setMenuOpen(false)}>Mağaza</a>
          <a href="/magaza" onClick={() => setMenuOpen(false)}>Koleksiyonlar</a>
          <a href="#story" onClick={() => setMenuOpen(false)}>Hikâyemiz</a>
          <a href="#journal" onClick={() => setMenuOpen(false)}>Journal</a>
        </nav>
        <div className="header-actions">
          <a href="/magaza" aria-label="Ürün ara">⌕</a>
          <a className="cart-link" href="/sepet" aria-label={`Çanta, ${cartCount} ürün`}>Çanta <b>{cartCount}</b></a>
        </div>
      </header>

      <section className="hero" id="top" style={{backgroundImage:`linear-gradient(90deg,rgba(22,29,23,.78) 0%,rgba(22,29,23,.22) 56%,rgba(22,29,23,.06)), url("${settings.heroImageUrl.replaceAll('"','%22')}")`}}>
        <div className="hero-content">
          <p className="eyebrow">{settings.heroEyebrow}</p>
          <h1>{settings.heroTitle}<br/><em>{settings.heroTitleAccent}</em></h1>
          <p className="hero-copy">{settings.heroCopy}</p>
          <a className="text-link light" href="/magaza">{settings.heroButton} <Arrow /></a>
        </div>
        <div className="hero-index">SEÇKİ · 01</div>
      </section>

      <section className="intro" id="story">
        <p className="section-label">Bizim dünyamız</p>
        <div>
          <h2>{settings.introTitle}</h2>
          <p>{settings.introCopy}</p>
        </div>
      </section>

      <section className="category-grid" id="categories">
        {storeCategories.map((category, index) => (
          <article className={`category-card category-${index + 1}`} key={category.id ?? category.name}>
            <img src={category.image} alt={category.alt} />
            <div className="category-info">
              <span>0{index + 1}</span>
              <h3>{category.name}</h3>
              <a href="/magaza" aria-label={`${category.name} koleksiyonunu aç`}><Arrow /></a>
            </div>
          </article>
        ))}
      </section>

      <section className="products" id="shop">
        <div className="section-heading">
          <div>
            <p className="section-label">Yeni gelenler · {market === "TR" ? "Türkiye" : "Global"}{catalogSource === "live" ? " · Güncel katalog" : ""}</p>
            <h2>Şimdi keşfedin</h2>
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
                {product.badge && <span>{product.badge}</span>}
                <button onClick={() => addToCart(product)} aria-label={`${market === "TR" ? product.name : product.nameGlobal || product.name} ürününü çantaya ekle`}>+</button>
              </div>
              <div className="product-meta">
                <div><h3>{product.slug?<a href={`/urun/${encodeURIComponent(product.slug)}`}>{market === "TR" ? product.name : product.nameGlobal || product.name}</a>:market === "TR" ? product.name : product.nameGlobal || product.name}</h3><p>{market === "TR" ? product.description : product.descriptionGlobal || product.description}</p></div>
                <strong>{market === "TR" ? `${product.priceTR.toLocaleString("tr-TR")} TL` : `€${product.priceGlobal}`}</strong>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="manifesto">
        <p className="eyebrow">{settings.brandName} STANDARDI</p>
        <blockquote>“İyi tasarım yalnızca nasıl göründüğü değil,<br/>hayatınıza <em>nasıl hissettirdiğidir.</em>”</blockquote>
        <div className="principles">
          <span>Doğal malzemeler</span><span>Sorumlu üretim</span><span>Uzun ömürlü tasarım</span>
        </div>
      </section>

      <section className="journal" id="journal">
        <article className="journal-image"><span>JOURNAL · 04</span></article>
        <article className="journal-copy">
          <p className="section-label">Yaşam notları</p>
          <h2>Evinizde küçük<br/>ritüeller yaratmak</h2>
          <p>Sabahın ilk ışığından günün son fincanına; sıradan anları duyulara hitap eden sakin ritüellere dönüştürmenin yolları.</p>
          <a className="text-link" href="#top">Yazıyı oku <Arrow /></a>
        </article>
      </section>

      <footer>
        <div className="footer-top">
          <div><a className="wordmark footer-logo" href="#top">{settings.brandName}<span>{settings.brandSuffix}</span></a><p>Beautiful things for considered living.</p></div>
          <div><h4>Keşfet</h4><a href="/magaza">Yeni gelenler</a><a href="/magaza">Koleksiyonlar</a><a href="#journal">Journal</a></div>
          <div><h4>Yardım</h4><a href="/siparis-takip">Sipariş takibi</a><a href="/politikalar">Teslimat & İade</a><a href="/iletisim">Bize ulaşın</a></div>
          <div className="newsletter"><h4>Mektuplarımıza katılın</h4><p>Yeni seçkiler ve ilham veren hikâyeler.</p><form onSubmit={subscribe}><label className="newsletter-email"><span className="sr-only">E-posta adresi</span><input type="email" value={newsletterEmail} onChange={event=>setNewsletterEmail(event.target.value)} placeholder="E-posta adresiniz" required/><button aria-label="Kaydol">→</button></label><label className="newsletter-consent"><input type="checkbox" required/><span><a href="/politikalar#gizlilik">Gizlilik açıklamasını</a> okudum; seçki ve duyuruları almak istiyorum.</span></label>{newsletterMessage&&<small className="newsletter-message" role="status">{newsletterMessage}</small>}</form></div>
        </div>
        <div className="footer-bottom"><span>© 2026 {settings.brandName} {settings.brandSuffix}</span><span>İstanbul · Dünya</span><span>Instagram &nbsp; Pinterest</span></div>
      </footer>

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
