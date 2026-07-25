import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { auditLogs, notificationOutbox, orders, products, returnRequests, storeSettings } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";
import { getIntegrationStatus } from "../../integrations/runtime";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" }, { status:401 });
  const db=getDb();
  const [settingsRows,productRows,orderRows,returnRows,notificationRows,auditRows]=await Promise.all([
    db.select().from(storeSettings),
    db.select().from(products).where(eq(products.active,true)),
    db.select().from(orders).orderBy(desc(orders.id)).limit(500),
    db.select().from(returnRequests).orderBy(desc(returnRequests.id)).limit(300),
    db.select().from(notificationOutbox).orderBy(desc(notificationOutbox.id)).limit(500),
    db.select().from(auditLogs).orderBy(desc(auditLogs.id)).limit(300),
  ]);
  const settings=Object.fromEntries(settingsRows.map(row=>[row.key,row.value]));
  const integrations=getIntegrationStatus();
  const legalFields=["legalName","legalBusinessType","legalAddress","legalTaxOffice","legalTaxNumber","legalEmail","legalPhone"];
  const legalMissing=legalFields.filter(key=>!String(settings[key]??"").trim());
  const catalogIssues=productRows.filter(product=>
    !product.imageUrl.trim() || !product.categoryId || !product.descriptionTr.trim() ||
    (!product.marketTr&&!product.marketGlobal) || (product.marketTr&&product.priceTr<=0) ||
    (product.marketGlobal&&(!product.nameEn.trim()||!product.descriptionEn.trim()||product.priceGlobal<=0))
  );
  const globalShippingRequired=productRows.some(product=>product.marketGlobal);
  const globalShippingReady=!globalShippingRequired||(settings.shippingGlobalEnabled==="true"&&String(settings.shippingGlobalCountries??"").split(",").some(country=>country.trim()));
  const checks=[
    {key:"catalog",label:"Ürün kataloğu",ready:productRows.length>0&&catalogIssues.length===0,detail:productRows.length===0?"Yayında ürün yok.":catalogIssues.length?`${catalogIssues.length} yayındaki üründe eksik var.`:`${productRows.length} ürün yayına hazır.`},
    {key:"pricing",label:"Fiyat ve vergi sunumu",ready:settings.taxDisplayMode==="tax_included",detail:settings.taxDisplayMode==="tax_included"?"Tüketici fiyatlarının vergiler dâhil olduğu onaylandı.":"Şirket ve mali müşavir onayı bekleniyor; fiyatlar taslak kabul edilir."},
    {key:"legal",label:"Şirket bilgileri",ready:settings.legalStatus==="complete"&&!legalMissing.length,detail:settings.legalStatus!=="complete"?"Taslak modunda.":legalMissing.length?`${legalMissing.length} zorunlu alan eksik.`:"Şirket bilgileri tamamlandı."},
    {key:"contracts",label:"Hukuki metinler",ready:settings.legalStatus==="complete"&&!String(settings.preliminaryInformationTr??"").startsWith("TASLAK")&&!String(settings.distanceSalesTermsTr??"").startsWith("TASLAK"),detail:settings.legalStatus==="complete"?"Metin durumu kontrol edildi.":"Uzman onayı bekleniyor."},
    {key:"payment",label:"Ödeme sağlayıcısı",ready:false,detail:integrations.payment.credentialsConfigured?`${integrations.payment.provider||settings.paymentProviderName||"Sağlayıcı"} kimlik bilgileri hazır; adaptör ve test işlemi bekleniyor.`:settings.paymentProviderStatus==="active"?`${settings.paymentProviderName||"Sağlayıcı"} seçildi; güvenli ortam anahtarları bekleniyor.`:"Şirket kurulduktan sonra bağlanacak."},
    {key:"shipping",label:"Kargo ve iade",ready:Boolean(String(settings.returnAddress??"").trim()&&String(settings.returnCarrier??"").trim()&&globalShippingReady),detail:!settings.returnCarrier?"İade adresi ve anlaşmalı kargo bekleniyor.":!globalShippingReady?"Global ürünler için desteklenen teslimat ülkeleri bekleniyor.":`${settings.returnCarrier} ve teslimat bölgeleri tanımlı.`},
    {key:"etbis",label:"ETBİS",ready:settings.etbisStatus==="complete",detail:settings.etbisStatus==="complete"?"Kayıt tamamlandı.":"Şirket kurulduktan sonra tamamlanacak."},
  ];
  const readyCount=checks.filter(check=>check.ready).length;
  const now=Date.now();const hoursSince=(value:string)=>(now-new Date(value).getTime())/3_600_000;
  const activeOrders=orderRows.filter(order=>!["completed","cancelled"].includes(order.status));
  const staleOrders=activeOrders.filter(order=>hoursSince(order.updatedAt)>=24);
  const staleReturns=returnRows.filter(item=>["new","reviewing","approved"].includes(item.status)&&hoursSince(item.updatedAt)>=24);
  const latestBackup=auditRows.find(row=>row.action==="backup.create");
  const backupAgeHours=latestBackup?hoursSince(latestBackup.createdAt):null;
  const draftNotifications=notificationRows.filter(item=>item.status==="draft");
  const orderIntakeStatus=settings.orderIntakeStatus==="paused"?"paused":"open";
  const operations={
    generatedAt:new Date().toISOString(),
    orderIntakeStatus,
    metrics:{
      newOrders24h:orderRows.filter(order=>hoursSince(order.createdAt)<=24).length,
      activeOrders:activeOrders.length,
      staleOrders:staleOrders.length,
      staleReturns:staleReturns.length,
      draftNotifications:draftNotifications.length,
    },
    health:[
      {key:"database",level:"healthy",label:"Veri altyapısı",detail:"Mağaza veritabanı okunabiliyor."},
      {key:"intake",level:orderIntakeStatus==="open"?"healthy":"paused",label:"Sipariş alımı",detail:orderIntakeStatus==="open"?"Müşteri taleplerine açık.":"Acil durum anahtarıyla durduruldu."},
      {key:"backup",level:backupAgeHours!==null&&backupAgeHours<=168?"healthy":"warning",label:"Son yedek",detail:backupAgeHours===null?"Henüz kayıtlı tam yedek yok.":backupAgeHours<=24?"Son 24 saat içinde oluşturuldu.":`${Math.floor(backupAgeHours/24)} gün önce oluşturuldu.`},
      {key:"workload",level:staleOrders.length||staleReturns.length?"warning":"healthy",label:"Geciken işlemler",detail:staleOrders.length||staleReturns.length?`${staleOrders.length} sipariş ve ${staleReturns.length} iade 24 saati aştı.`:"24 saati aşan açık işlem yok."},
      {key:"notifications",level:"info",label:"Bildirim kuyruğu",detail:`${draftNotifications.length} gönderim taslağı bekliyor; sağlayıcı bağlanana kadar otomatik gönderim kapalı.`},
    ],
  };
  return Response.json({salesMode:settings.salesMode??"order_request",checks,readyCount,total:checks.length,readyForLive:readyCount===checks.length,operations});
}
