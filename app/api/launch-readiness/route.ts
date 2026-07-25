import { eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { products, storeSettings } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" }, { status:401 });
  const db=getDb();
  const [settingsRows,productRows]=await Promise.all([
    db.select().from(storeSettings),
    db.select().from(products).where(eq(products.active,true)),
  ]);
  const settings=Object.fromEntries(settingsRows.map(row=>[row.key,row.value]));
  const legalFields=["legalName","legalBusinessType","legalAddress","legalTaxOffice","legalTaxNumber","legalEmail","legalPhone"];
  const legalMissing=legalFields.filter(key=>!String(settings[key]??"").trim());
  const catalogIssues=productRows.filter(product=>
    !product.imageUrl.trim() || !product.categoryId || !product.descriptionTr.trim() ||
    (!product.marketTr&&!product.marketGlobal) || (product.marketTr&&product.priceTr<=0) ||
    (product.marketGlobal&&(!product.nameEn.trim()||!product.descriptionEn.trim()||product.priceGlobal<=0))
  );
  const checks=[
    {key:"catalog",label:"Ürün kataloğu",ready:productRows.length>0&&catalogIssues.length===0,detail:productRows.length===0?"Yayında ürün yok.":catalogIssues.length?`${catalogIssues.length} yayındaki üründe eksik var.`:`${productRows.length} ürün yayına hazır.`},
    {key:"legal",label:"Şirket bilgileri",ready:settings.legalStatus==="complete"&&!legalMissing.length,detail:settings.legalStatus!=="complete"?"Taslak modunda.":legalMissing.length?`${legalMissing.length} zorunlu alan eksik.`:"Şirket bilgileri tamamlandı."},
    {key:"contracts",label:"Hukuki metinler",ready:settings.legalStatus==="complete"&&!String(settings.preliminaryInformationTr??"").startsWith("TASLAK")&&!String(settings.distanceSalesTermsTr??"").startsWith("TASLAK"),detail:settings.legalStatus==="complete"?"Metin durumu kontrol edildi.":"Uzman onayı bekleniyor."},
    {key:"payment",label:"Ödeme sağlayıcısı",ready:false,detail:settings.paymentProviderStatus==="active"?`${settings.paymentProviderName||"Sağlayıcı"} seçildi; teknik bağlantı bekleniyor.`:"Şirket kurulduktan sonra bağlanacak."},
    {key:"shipping",label:"Kargo ve iade",ready:Boolean(String(settings.returnAddress??"").trim()&&String(settings.returnCarrier??"").trim()),detail:settings.returnCarrier?`${settings.returnCarrier} tanımlı.`:"İade adresi ve anlaşmalı kargo bekleniyor."},
    {key:"etbis",label:"ETBİS",ready:settings.etbisStatus==="complete",detail:settings.etbisStatus==="complete"?"Kayıt tamamlandı.":"Şirket kurulduktan sonra tamamlanacak."},
  ];
  const readyCount=checks.filter(check=>check.ready).length;
  return Response.json({salesMode:settings.salesMode??"order_request",checks,readyCount,total:checks.length,readyForLive:readyCount===checks.length});
}
