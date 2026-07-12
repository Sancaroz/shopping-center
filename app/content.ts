export type Market = "TR" | "GLOBAL";

// Ürünleri ve görselleri bu dosyadan kolayca değiştirebilirsiniz.
export const categories = [
  { name: "Banyo & Ev", image: "https://images.unsplash.com/photo-1600369672770-985fd30004eb?auto=format&fit=crop&w=1200&q=88", alt: "Doğal tonlarda katlanmış yumuşak havlular" },
  { name: "Giyim & Aksesuar", image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&w=1200&q=88", alt: "Minimal tasarımlı açık renk çanta" },
  { name: "Dostlarımız İçin", image: "https://images.unsplash.com/photo-1495360010541-f48722b34f7d?auto=format&fit=crop&w=1200&q=88", alt: "Ev ortamında dinlenen kedi" },
];

export const products = [
  { name: "Alaçatı Peştemal", description: "%100 organik pamuk", priceTR: 1250, priceGlobal: 42, markets: ["TR", "GLOBAL"] as Market[], image: "https://images.unsplash.com/photo-1616627547584-bf28cee262db?auto=format&fit=crop&w=900&q=88", alt: "Doğal renkte dokuma peştemal", badge: "ÇOK SEVİLEN" },
  { name: "Luna Omuz Çantası", description: "Bitkisel tabaklanmış deri", priceTR: 4850, priceGlobal: 165, markets: ["TR", "GLOBAL"] as Market[], image: "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&w=900&q=88", alt: "Kahverengi deri omuz çantası" },
  { name: "İpek Dokunuşlu Çorap", description: "Üçlü set · Kum tonları", priceTR: 690, priceGlobal: 26, markets: ["TR"] as Market[], image: "https://images.unsplash.com/photo-1582966772680-860e372bb558?auto=format&fit=crop&w=900&q=88", alt: "Yumuşak dokulu nötr renkli çoraplar" },
  { name: "Dost Gurme Serisi", description: "Tahılsız yetişkin kedi maması", priceTR: 890, priceGlobal: 34, markets: ["TR"] as Market[], image: "https://images.unsplash.com/photo-1574144611937-0df059b5ef3e?auto=format&fit=crop&w=900&q=88", alt: "Mama kabının yanında duran kedi", badge: "YENİ" },
  { name: "Riviera Keten Set", description: "Saf keten · İki parça", priceTR: 3950, priceGlobal: 128, markets: ["GLOBAL"] as Market[], image: "https://images.unsplash.com/photo-1596755094514-f87e34085b2c?auto=format&fit=crop&w=900&q=88", alt: "Açık renk keten giyim seti", badge: "GLOBAL" },
  { name: "Atelier Mini Tote", description: "El dokuması rafya", priceTR: 3200, priceGlobal: 98, markets: ["GLOBAL"] as Market[], image: "https://images.unsplash.com/photo-1566150905458-1bf1fc113f0d?auto=format&fit=crop&w=900&q=88", alt: "El dokuması rafya çanta" },
];
