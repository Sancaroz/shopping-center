"use client";

import { ChangeEvent, useState } from "react";

type HistoryItem = { id: number; action: string; summary: string; actorName: string; createdAt: string };
type Verification = { valid: boolean; errors: string[]; counts: Record<string, number>; checksum?: string; exportedAt?: string; schemaVersion?: number };

const tableLabels: Record<string, string> = {
  settings: "Mağaza ayarları",
  categories: "Kategoriler",
  products: "Ürünler",
  variants: "Varyantlar",
  productImages: "Ürün görselleri",
  homepageBlocks: "Ana sayfa blokları",
  carts: "Sepetler",
  cartItems: "Sepet kalemleri",
  orders: "Siparişler",
  orderItems: "Sipariş kalemleri",
  paymentTransactions: "Ödeme işlemleri",
  fulfillmentChecklists: "Paketleme kontrolleri",
  shipmentEvents: "Kargo hareketleri",
  inventoryMovements: "Stok hareketleri",
  replenishments: "Tedarik kayıtları",
  promotions: "Kampanyalar",
  promotionRedemptions: "Kampanya kullanımları",
  notificationOutbox: "Bildirimler",
  returnRequests: "İade talepleri",
  auditLogs: "İşlem geçmişi",
  contactMessages: "Müşteri mesajları",
  privacyRequests: "Kişisel veri talepleri",
  newsletterSubscribers: "Bülten aboneleri",
  newsletterOutbox: "Bülten gönderim kuyruğu",
};

export default function DataSafetyCenter({ initialHistory }: { initialHistory: HistoryItem[] }) {
  const [history, setHistory] = useState<HistoryItem[]>(initialHistory);
  const [report, setReport] = useState<Verification | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const loadHistory = async () => {
    const response = await fetch("/api/backups");
    const result = await response.json();
    if (response.ok) setHistory(result.history ?? []);
  };

  const verify = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setMessage("");
    setReport(null);
    if (file.size > 10 * 1024 * 1024) {
      setMessage("Dosya 10 MB sınırını aşıyor.");
      setBusy(false);
      return;
    }
    const response = await fetch("/api/backups", { method: "POST", headers: { "Content-Type": "application/json" }, body: await file.text() });
    const result = await response.json();
    if (response.status === 422) setReport(result);
    else if (!response.ok) setMessage(result.error ?? "Yedek doğrulanamadı.");
    else setReport(result);
    setBusy(false);
    event.target.value = "";
    void loadHistory();
  };

  const cleanup = async () => {
    setBusy(true);
    setMessage("");
    const response = await fetch("/api/backups", { method: "DELETE" });
    const result = await response.json();
    setMessage(response.ok ? result.message : result.error ?? "Temizlik tamamlanamadı.");
    setBusy(false);
    void loadHistory();
  };

  return <main className="admin-shell data-safety-shell">
    <header className="admin-header"><div><p>VERİ GÜVENLİĞİ</p><h1>Yedekleme ve geri yükleme provası</h1></div><div><a href="/admin">Panele dön ↗</a><a href="/admin/islem-gecmisi">İşlem geçmişi ↗</a></div></header>
    <section className="safety-intro">
      <article><span>1</span><div><b>Tam yedeği indir</b><p>Tüm mağaza, sipariş, müşteri iletişimi ve işlem geçmişi kayıtlarını tek dosyada saklayın.</p></div></article>
      <article><span>2</span><div><b>Dosyayı prova et</b><p>Bütünlük özeti, tablo yapısı ve kayıt bağlantıları canlı veriye dokunmadan kontrol edilir.</p></div></article>
      <article><span>3</span><div><b>Güvenli yerde sakla</b><p>Yedek müşteri bilgileri içerir; kişisel ve erişimi sınırlı bir klasörde tutun.</p></div></article>
    </section>
    <section className="safety-grid">
      <article className="admin-card backup-action-card"><p className="section-kicker">YEDEK OLUŞTUR</p><h2>Tam mağaza yedeği</h2><p>Geçici güvenlik sayaçları dışında işletmenin yeniden kurulması için gereken tüm verileri içerir.</p><a className="primary-safety-action" href="/api/export?type=backup">Yedeği cihazıma indir ↓</a><small>Öneri: Haftada en az bir kez ve büyük ürün güncellemelerinden önce indirin.</small></article>
      <article className="admin-card backup-action-card"><p className="section-kicker">GERİ YÜKLEME PROVASI</p><h2>Yedek dosyasını doğrula</h2><p>Bu işlem yalnızca dosyayı okur. Canlı mağazadaki hiçbir kayıt eklenmez, silinmez veya değiştirilmez.</p><label className={`file-safety-action ${busy ? "disabled" : ""}`}>{busy ? "Kontrol ediliyor…" : "JSON yedeğini seç"}<input type="file" accept=".json,application/json" onChange={verify} disabled={busy} /></label><small>En fazla 10 MB · Yalnızca MYSA yedek biçimi</small></article>
    </section>
    {report && <section className={`admin-card verification-report ${report.valid ? "valid" : "invalid"}`}><div><p className="section-kicker">PROVA SONUCU</p><h2>{report.valid ? "Yedek geri yüklenmeye hazır" : "Yedekte sorun bulundu"}</h2><p>{report.valid ? "Dosya özeti, tablo yapıları ve kayıt bağlantıları doğrulandı." : "Bu dosya canlı sisteme geri yüklenmemelidir."}</p></div>{report.errors.length > 0 && <ul>{report.errors.map((error) => <li key={error}>{error}</li>)}</ul>}<div className="backup-counts">{Object.entries(report.counts).map(([name, count]) => <span key={name}><b>{count}</b>{tableLabels[name] ?? name}</span>)}</div>{report.checksum && <code>SHA-256 · {report.checksum}</code>}</section>}
    {message && <p className="admin-message">{message}</p>}
    <section className="safety-grid safety-lower">
      <article className="admin-card retention-card"><p className="section-kicker">VERİ SAKLAMA</p><h2>Geçici güvenlik kayıtları</h2><p>Hız sınırlama için oluşturulan anonim sayaçlar 48 saat sonra işlevini tamamlar. Müşteri veya sipariş kayıtlarına dokunulmaz.</p><button onClick={cleanup} disabled={busy}>Süresi dolanları temizle</button></article>
      <article className="admin-card history-card"><div className="list-title"><div><p className="section-kicker">SON İŞLEMLER</p><h2>Yedek geçmişi</h2></div><span>{history.length} kayıt</span></div>{history.length ? history.map((item) => <div className="history-row" key={item.id}><span><b>{item.summary}</b><small>{item.actorName}</small></span><time>{new Date(item.createdAt).toLocaleString("tr-TR")}</time></div>) : <p className="empty">Henüz yedekleme işlemi yok.</p>}</article>
    </section>
    <section className="admin-card restore-note"><b>Gerçek geri yükleme neden otomatik değil?</b><p>Canlı veriyi topluca değiştiren geri yükleme işlemi, yanlış dosya seçildiğinde geri döndürülemez kayba yol açabilir. Prova başarılı olduktan sonra gerçek geri yükleme kontrollü bakım sırasında yapılmalıdır.</p></section>
  </main>;
}
