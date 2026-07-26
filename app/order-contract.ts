export const ORDER_TERMS_VERSION="order-request-v2";

function setting(settings:Record<string,string>,key:string){return String(settings[key]??"");}

export async function buildOrderContractSnapshot(settings:Record<string,string>,market:"TR"|"GLOBAL"){
  const snapshot={
    version:ORDER_TERMS_VERSION,
    market,
    salesMode:setting(settings,"salesMode")||"order_request",
    pricingTaxStatus:setting(settings,"taxDisplayMode")||"pending",
    seller:{
      legalStatus:setting(settings,"legalStatus"),
      legalName:setting(settings,"legalName"),
      legalBusinessType:setting(settings,"legalBusinessType"),
      legalAddress:setting(settings,"legalAddress"),
      legalTaxOffice:setting(settings,"legalTaxOffice"),
      legalTaxNumber:setting(settings,"legalTaxNumber"),
      legalMersisNumber:setting(settings,"legalMersisNumber"),
      legalEmail:setting(settings,"legalEmail"),
      legalPhone:setting(settings,"legalPhone"),
    },
    policies:{
      preliminaryInformationTr:setting(settings,"preliminaryInformationTr"),
      distanceSalesTermsTr:setting(settings,"distanceSalesTermsTr"),
      privacyPolicy:market==="GLOBAL"?setting(settings,"privacyPolicyGlobal"):setting(settings,"privacyPolicy"),
      shippingPolicy:market==="GLOBAL"?setting(settings,"shippingPolicyGlobal"):setting(settings,"shippingPolicyTr"),
      returnsPolicy:market==="GLOBAL"?setting(settings,"returnsPolicyGlobal"):setting(settings,"returnsPolicyTr"),
    },
  };
  const json=JSON.stringify(snapshot);
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(json));
  const hash=[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
  return{version:ORDER_TERMS_VERSION,json,hash};
}
