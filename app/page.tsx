"use client";

import { useEffect, useMemo, useState } from "react";
import { categories, products as sampleProducts, type Market } from "./content";

type StoreProduct = (typeof sampleProducts)[number] & { id?: number; active?: boolean };
type DatabaseProduct = {
  id: number;
  nameTr: string;
  descriptionTr: string;
  imageUrl: string;
  priceTr: number;
  priceGlobal: number;
  marketTr: boolean;
  marketGlobal: boolean;
  active: boolean;
};
type StoreSettings = { brandName:string; brandSuffix:string; announcementTr:string; announcementGlobal:string; heroEyebrow:string };
const defaultSettings:StoreSettings = { brandName:"MYSA", brandSuffix:"OBJETS", announcementTr:"1.500 TL üzeri ücretsiz gönderim", announcementGlobal:"Complimentary shipping over €150", heroEyebrow:"Yavaş yaşam için seçilmiş parçalar" };

const Arrow = () => <span aria-hidden="true">&#8599;</span>;

export default function Home() {
  const [market, setMarket] = useState<Market>("TR");
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const [notice, setNotice] = useState("");
  const [catalogProducts, setCatalogProducts] = useState<StoreProduct[]>(sampleProducts);
  const [catalogSource, setCatalogSource] = useState<"sample" | "live">("sample");
  const [settings, setSettings] = useState<StoreSettings>(defaultSettings);

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
            name: product.nameTr,
            description: product.descriptionTr,
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

  const visibleProducts = useMemo(
    () => catalogProducts.filter((product) => product.markets.includes(market)),
    [catalogProducts, market],
  );

  const changeMarket = (next: Market) => {
    setMarket(next);
    setNotice(next === "TR" ? "Türkiye mağazasına geçildi" : "Global mağazaya geçildi");
    window.setTimeout(() => setNotice(""), 2200);
  };

  const addToCart = (name: string) => {
    setCartCount((count) => count + 1);
    setNotice(`${name} çantanıza eklendi`);
    window.setTimeout(() => setNotice(""), 2200);
  };

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
          <a href="#shop" onClick={() => setMenuOpen(false)}>Mağaza</a>
          <a href="#categories" onClick={() => setMenuOpen(false)}>Koleksiyonlar</a>
          <a href="#story" onClick={() => setMenuOpen(false)}>Hikâyemiz</a>
          <a href="#journal" onClick={() => setMenuOpen(false)}>Journal</a>
        </nav>
        <div className="header-actions">
          <button aria-label="Ara">⌕</button>
          <button aria-label={`Çanta, ${cartCount} ürün`}>Çanta <b>{cartCount}</b></button>
        </div>
      </header>

      <section className="hero" id="top">
        <div className="hero-content">
          <p className="eyebrow">{settings.heroEyebrow}</p>
          <h1>Gündelik olanı<br/><em>olağanüstü</em> kılın.</h1>
          <p className="hero-copy">Eviniz, gardırobunuz ve en yakın dostlarınız için; dokusu, işçiliği ve hikâyesi olan zamansız objeler.</p>
          <a className="text-link light" href="#shop">Yeni seçkiyi keşfet <Arrow /></a>
        </div>
        <div className="hero-index">SEÇKİ · 01</div>
      </section>

      <section className="intro" id="story">
        <p className="section-label">Bizim dünyamız</p>
        <div>
          <h2>Daha az, ama daha iyi.</h2>
          <p>Dokunmak isteyeceğiniz tekstillerden bilinçli üretilmiş aksesuarlara ve dostlarımız için özenle seçilmiş ürünlere uzanan modern bir yaşam koleksiyonu.</p>
        </div>
      </section>

      <section className="category-grid" id="categories">
        {categories.map((category, index) => (
          <article className={`category-card category-${index + 1}`} key={category.name}>
            <img src={category.image} alt={category.alt} />
            <div className="category-info">
              <span>0{index + 1}</span>
              <h3>{category.name}</h3>
              <a href="#shop" aria-label={`${category.name} koleksiyonunu aç`}><Arrow /></a>
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
                <img src={product.image} alt={product.alt} />
                {product.badge && <span>{product.badge}</span>}
                <button onClick={() => addToCart(product.name)} aria-label={`${product.name} ürününü çantaya ekle`}>+</button>
              </div>
              <div className="product-meta">
                <div><h3>{product.name}</h3><p>{product.description}</p></div>
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
          <div><h4>Keşfet</h4><a href="#shop">Yeni gelenler</a><a href="#categories">Koleksiyonlar</a><a href="#journal">Journal</a></div>
          <div><h4>Yardım</h4><a href="#top">Teslimat & İade</a><a href="#top">Bize ulaşın</a><a href="#top">Sıkça sorulanlar</a></div>
          <div className="newsletter"><h4>Mektuplarımıza katılın</h4><p>Yeni seçkiler ve ilham veren hikâyeler.</p><label><span className="sr-only">E-posta adresi</span><input type="email" placeholder="E-posta adresiniz"/><button aria-label="Kaydol">→</button></label></div>
        </div>
        <div className="footer-bottom"><span>© 2026 {settings.brandName} {settings.brandSuffix}</span><span>İstanbul · Dünya</span><span>Instagram &nbsp; Pinterest</span></div>
      </footer>

      {notice && <div className="toast" role="status">{notice}</div>}
    </main>
  );
}
