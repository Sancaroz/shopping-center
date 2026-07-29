type StockProduct = { id:number; nameTr:string; stock:number; active:boolean; reorderPoint:number };
type StockVariant = { id:number; productId:number; optionName:string; optionValue:string; stock:number; active:boolean };

export type StockAlertItem = {
  key:string;
  productId:number;
  variantId:number|null;
  name:string;
  detail:string;
  stock:number;
  threshold:number;
};

export function stockAlertItems(products:StockProduct[],variants:StockVariant[]) {
  const activeProducts=products.filter(product=>product.active);
  return activeProducts.flatMap(product=>{
    const threshold=Number.isFinite(product.reorderPoint)?Math.max(0,product.reorderPoint):5;
    const own=variants.filter(variant=>variant.productId===product.id&&variant.active);
    if(own.length)return own.filter(variant=>variant.stock<=threshold).map(variant=>({key:`variant-${variant.id}`,productId:product.id,variantId:variant.id,name:product.nameTr,detail:`${variant.optionName}: ${variant.optionValue}`,stock:variant.stock,threshold}));
    return product.stock<=threshold?[{key:`product-${product.id}`,productId:product.id,variantId:null,name:product.nameTr,detail:"Ana stok",stock:product.stock,threshold}]:[];
  }).sort((a,b)=>a.stock-b.stock||a.name.localeCompare(b.name,"tr"));
}
