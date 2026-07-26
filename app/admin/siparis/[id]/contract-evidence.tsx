type ContractOrder={termsConsentAt:string|null;privacyConsentAt:string|null;termsVersion:string;termsSnapshotJson:string;termsSnapshotHash:string};
type Snapshot={market?:string;salesMode?:string;pricingTaxStatus?:string;seller?:Record<string,string>;policies?:Record<string,string>};

const policyLabels:Record<string,string>={preliminaryInformationTr:"Ön bilgilendirme",distanceSalesTermsTr:"Mesafeli satış şartları",privacyPolicy:"Gizlilik açıklaması",shippingPolicy:"Teslimat politikası",returnsPolicy:"İade politikası"};

export default function ContractEvidence({order}:{order:ContractOrder}){
  let snapshot:Snapshot|null=null;try{const parsed=JSON.parse(order.termsSnapshotJson||"{}");if(parsed&&Object.keys(parsed).length)snapshot=parsed;}catch{snapshot=null;}
  return <section className="contract-evidence">
    <div><p>SÖZLEŞME KANITI</p><h2>{snapshot?"Kabul anındaki metinler saklandı":"Eski sipariş kaydı"}</h2><span>{order.termsConsentAt?new Date(order.termsConsentAt).toLocaleString("tr-TR"):"Onay zamanı bulunmuyor"} · {order.termsVersion}</span></div>
    {snapshot?<><dl><div><dt>Pazar</dt><dd>{snapshot.market??"—"}</dd></div><div><dt>Satış modu</dt><dd>{snapshot.salesMode??"—"}</dd></div><div><dt>Fiyat/vergi durumu</dt><dd>{snapshot.pricingTaxStatus??"—"}</dd></div></dl><details><summary>Kabul edilen metinleri görüntüle</summary>{Object.entries(snapshot.policies??{}).map(([key,value])=><article key={key}><h3>{policyLabels[key]??key}</h3><p>{value||"Bu alan kabul anında boştu."}</p></article>)}</details><code>SHA-256 · {order.termsSnapshotHash}</code></>:<p>Bu sipariş sözleşme anlık görüntüsü özelliğinden önce oluşturuldu. Mevcut onay zamanı ve sürüm bilgisi korunmaya devam eder.</p>}
  </section>;
}
