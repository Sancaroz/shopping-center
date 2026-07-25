"use client";

import {FormEvent,useCallback,useEffect,useState} from "react";
import "./shipment-manager.css";

type ShipmentEvent={id:number;status:string;titleTr:string;detail:string;location:string;occurredAt:string;visibleToCustomer:boolean};
const statusOptions=[
  ["label_created","Kargo kaydı oluşturuldu"],["picked_up","Kargo teslim alındı"],["in_transit","Transfer merkezinde"],["out_for_delivery","Dağıtıma çıktı"],["delivered","Teslim edildi"],["exception","Teslimat sorunu"],["returned","Gönderi geri dönüyor"],
];

export default function ShipmentManager({orderId,onChanged}:{orderId:number;onChanged:()=>Promise<void>}){
  const[events,setEvents]=useState<ShipmentEvent[]>([]);const[message,setMessage]=useState("");const[busy,setBusy]=useState(false);
  const load=useCallback(async()=>{const response=await fetch(`/api/shipment-events?orderId=${orderId}`);const data=await response.json();if(response.ok)setEvents(data.events);},[orderId]);
  useEffect(()=>{void load()},[load]);
  async function submit(event:FormEvent<HTMLFormElement>){event.preventDefault();setBusy(true);const form=event.currentTarget;const values=Object.fromEntries(new FormData(form));const occurredAt=new Date(String(values.occurredAt)).toISOString();const response=await fetch("/api/shipment-events",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({orderId,...values,occurredAt,visibleToCustomer:values.visibleToCustomer==="on"})});const data=await response.json();setMessage(response.ok?"Kargo hareketi kaydedildi.":data.error??"Hareket kaydedilemedi.");if(response.ok){form.reset();await Promise.all([load(),onChanged()]);}setBusy(false);}
  return <section className="order-paper shipment-manager"><h2>Kargo hareketleri</h2><form onSubmit={submit}><label>Hareket<select name="status" required defaultValue=""><option value="" disabled>Durum seçin</option>{statusOptions.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select></label><label>Tarih ve saat<input name="occurredAt" type="datetime-local" required/></label><label>Konum<input name="location" placeholder="İstanbul Transfer Merkezi"/></label><label>Açıklama<textarea name="detail" rows={3} placeholder="Müşterinin görebileceği kısa açıklama"/></label><label className="shipment-visible"><input name="visibleToCustomer" type="checkbox" defaultChecked/> Müşteri takip ekranında göster</label><button disabled={busy}>{busy?"Kaydediliyor…":"Hareket ekle"}</button></form>{message&&<p className="shipment-message" role="status">{message}</p>}<ol>{[...events].reverse().map(item=><li key={item.id}><i>{item.visibleToCustomer?"●":"○"}</i><div><b>{item.titleTr}</b>{item.detail&&<span>{item.detail}</span>}<small>{item.location&&`${item.location} · `}{new Date(item.occurredAt).toLocaleString("tr-TR")}</small></div></li>)}</ol>{events.length===0&&<p>Henüz kargo hareketi eklenmedi.</p>}</section>;
}
