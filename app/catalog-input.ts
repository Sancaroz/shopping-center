export const MAX_CATALOG_PRICE=100_000_000;
export const MAX_CATALOG_STOCK=1_000_000;

export function parseCatalogMoney(value:unknown,{allowNegative=false}:{allowNegative?:boolean}={}) {
  const parsed=Number(value??0);const minimum=allowNegative?-MAX_CATALOG_PRICE:0;
  if(!Number.isFinite(parsed)||parsed<minimum||parsed>MAX_CATALOG_PRICE)return null;
  return Math.round((parsed+Number.EPSILON)*100)/100;
}

export function parseCatalogStock(value:unknown) {
  const parsed=Number(value??0);
  return Number.isInteger(parsed)&&parsed>=0&&parsed<=MAX_CATALOG_STOCK?parsed:null;
}

export function isCatalogImageUrl(value:string) {
  return !value||((value.startsWith("/")&&!value.startsWith("//"))||/^https:\/\//i.test(value))&&value.length<=2000;
}
