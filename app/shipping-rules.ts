export type ShippingRuleSettings={shippingTr?:string|number;freeShippingTr?:string|number;shippingGlobal?:string|number;freeShippingGlobal?:string|number;shippingGlobalEnabled?:string|boolean;shippingGlobalCountries?:string};

const numberValue=(value:unknown,fallback:number)=>{const parsed=Number(value);return Number.isFinite(parsed)&&parsed>=0?parsed:fallback;};
const normalize=(value:string)=>value.trim().toLocaleLowerCase("tr-TR").normalize("NFD").replace(/[\u0300-\u036f]/g,"");
const turkeyAliases=new Set(["turkiye","turkey","türkiye"].map(normalize));

export function globalCountries(settings:ShippingRuleSettings){return String(settings.shippingGlobalCountries??"").split(",").map(value=>value.trim()).filter(Boolean).slice(0,80);}

export function shippingQuote(input:{market:"TR"|"GLOBAL";country:string;subtotal:number;settings:ShippingRuleSettings}){
  const{subtotal,settings}=input;const country=input.country.trim();
  if(!Number.isFinite(subtotal)||subtotal<0)return{ok:false as const,error:"Geçersiz sipariş toplamı."};
  if(input.market==="TR"){
    if(!turkeyAliases.has(normalize(country)))return{ok:false as const,error:"Türkiye mağazası yalnızca Türkiye teslimat adreslerini kabul eder."};
    const fee=numberValue(settings.shippingTr,99);const freeLimit=numberValue(settings.freeShippingTr,1500);const shippingAmount=freeLimit>0&&subtotal>=freeLimit?0:fee;
    return{ok:true as const,shippingAmount,total:subtotal+shippingAmount,country:"Türkiye",freeLimit};
  }
  const enabled=settings.shippingGlobalEnabled===true||settings.shippingGlobalEnabled==="true";
  if(!enabled)return{ok:false as const,error:"Global teslimat henüz siparişe açık değil."};
  const countries=globalCountries(settings);const supported=countries.find(item=>normalize(item)===normalize(country));
  if(!supported)return{ok:false as const,error:"Seçilen ülkeye teslimat şu anda desteklenmiyor."};
  const fee=numberValue(settings.shippingGlobal,15);const freeLimit=numberValue(settings.freeShippingGlobal,150);const shippingAmount=freeLimit>0&&subtotal>=freeLimit?0:fee;
  return{ok:true as const,shippingAmount,total:subtotal+shippingAmount,country:supported,freeLimit};
}
