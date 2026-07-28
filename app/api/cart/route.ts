import {and,eq,isNull,lte,sql} from "drizzle-orm";
import {getDb} from "../../../db";
import {cartItems,carts,products,productVariants} from "../../../db/schema";
import {readBoundedJson} from "../../public-form-security";

const COOKIE="store_cart";
function cookieToken(request:Request){return request.headers.get("cookie")?.split(";").map(value=>value.trim()).find(value=>value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1)??null;}
async function lookupCart(request:Request){const db=getDb();const token=cookieToken(request);const[cart]=token?await db.select().from(carts).where(eq(carts.token,token)).limit(1):[];return{db,cart:cart??null,token};}
function response(data:unknown,token:string|null,created=false,status=200,request?:Request){const headers=new Headers({"Content-Type":"application/json","Cache-Control":"no-store"});if(created&&token){const secure=request&&new URL(request.url).protocol==="https:"?"; Secure":"";headers.set("Set-Cookie",`${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${secure}`);}return new Response(JSON.stringify(data),{status,headers});}

export async function GET(request:Request){
  try{
    const{db,cart,token}=await lookupCart(request);
    if(!cart)return response({items:[],market:"TR",revision:null},token,false,200,request);
    const items=await db.select({id:cartItems.id,quantity:cartItems.quantity,productId:products.id,name:products.nameTr,nameEn:products.nameEn,slug:products.slug,imageUrl:products.imageUrl,priceTr:products.priceTr,priceGlobal:products.priceGlobal,stock:products.stock,active:products.active,marketTr:products.marketTr,marketGlobal:products.marketGlobal,variantId:productVariants.id,variantStock:productVariants.stock,variantActive:productVariants.active,optionName:productVariants.optionName,optionValue:productVariants.optionValue,optionNameEn:productVariants.optionNameEn,optionValueEn:productVariants.optionValueEn,priceAdjustment:productVariants.priceAdjustment}).from(cartItems).innerJoin(products,eq(cartItems.productId,products.id)).leftJoin(productVariants,eq(cartItems.variantId,productVariants.id)).where(eq(cartItems.cartId,cart.id));
    return response({items,market:cart.market,revision:cart.revision},token,false,200,request);
  }catch{return Response.json({items:[],market:"TR",revision:null},{headers:{"Cache-Control":"no-store"}});}
}

export async function POST(request:Request){
  const session=await lookupCart(request);const{db}=session;const parsed=await readBoundedJson(request,2_000);if(parsed.error)return parsed.error;const body=parsed.body as{productId?:number;variantId?:number|null;quantity?:number;market?:string};
  if(!body)return response({error:"Geçersiz sepet isteği."},session.token,false,400,request);
  const productId=Number(body.productId);const variantId=body.variantId?Number(body.variantId):null;const quantity=Number(body.quantity??1);const market=body.market==="GLOBAL"?"GLOBAL":"TR";
  if(!productId||!Number.isInteger(quantity)||quantity<1||quantity>100)return response({error:"Geçersiz ürün veya adet."},session.token,false,400,request);
  const[product]=await db.select().from(products).where(eq(products.id,productId)).limit(1);if(!product||!product.active)return response({error:"Ürün satışta değil."},session.token,false,409,request);if((market==="TR"&&!product.marketTr)||(market==="GLOBAL"&&!product.marketGlobal))return response({error:"Ürün seçilen mağazada satışta değil."},session.token,false,409,request);
  const basePrice=market==="GLOBAL"?product.priceGlobal:product.priceTr;if(!Number.isFinite(basePrice)||basePrice<=0)return response({error:market==="GLOBAL"?"This product is not on sale yet.":"Bu ürün henüz satışa açılmadı."},session.token,false,409,request);
  let maximum=product.stock;if(variantId){const[variant]=await db.select().from(productVariants).where(and(eq(productVariants.id,variantId),eq(productVariants.productId,productId),eq(productVariants.active,true))).limit(1);if(!variant)return response({error:"Ürün seçeneği artık satışta değil."},session.token,false,409,request);maximum=variant.stock;}
  if(quantity>maximum)return response({error:`En fazla ${maximum} adet ekleyebilirsiniz.`,maximum},session.token,false,409,request);
  if(session.cart&&session.cart.market!==market){const[currentLine]=await db.select({id:cartItems.id}).from(cartItems).where(eq(cartItems.cartId,session.cart.id)).limit(1);if(currentLine)return response({error:market==="GLOBAL"?"Your bag contains Türkiye store products. Empty your bag before switching stores.":"Çantanızda Global mağaza ürünleri var. Mağaza değiştirmeden önce çantanızı boşaltın.",code:"market_mismatch"},session.token,false,409,request);}
  let cart=session.cart;let token=session.token;let created=false;
  if(!cart){token=crypto.randomUUID();[cart]=await db.insert(carts).values({token,market,revision:crypto.randomUUID()}).returning();created=true;}
  const condition=and(eq(cartItems.cartId,cart.id),eq(cartItems.productId,productId),variantId?eq(cartItems.variantId,variantId):isNull(cartItems.variantId));
  const increment=()=>db.update(cartItems).set({quantity:sql`${cartItems.quantity} + ${quantity}`}).where(and(condition,lte(cartItems.quantity,maximum-quantity))).returning({quantity:cartItems.quantity});
  let[changed]=await increment();
  if(!changed){
    const[existing]=await db.select({quantity:cartItems.quantity}).from(cartItems).where(condition).limit(1);
    if(existing)return response({error:`En fazla ${maximum} adet ekleyebilirsiniz.`,maximum},token,created,409,request);
    const[inserted]=await db.insert(cartItems).values({cartId:cart.id,productId,variantId,quantity}).onConflictDoNothing().returning({quantity:cartItems.quantity});
    changed=inserted;
    if(!changed)[changed]=await increment();
    if(!changed)return response({error:`En fazla ${maximum} adet ekleyebilirsiniz.`,maximum},token,created,409,request);
  }
  await db.update(carts).set({market,revision:crypto.randomUUID(),updatedAt:new Date().toISOString()}).where(eq(carts.id,cart.id));return response({ok:true,quantity:changed.quantity},token,created,201,request);
}

export async function PATCH(request:Request){
  const{db,cart,token}=await lookupCart(request);if(!cart)return response({error:"Sepet bulunamadı."},token,false,404,request);
  const parsed=await readBoundedJson(request,2_000);if(parsed.error)return parsed.error;const body=parsed.body as{id?:number;quantity?:number;expectedQuantity?:number};const id=Number(body?.id);const quantity=Number(body?.quantity);const expectedQuantity=Number(body?.expectedQuantity);if(!id||!Number.isInteger(quantity)||quantity<0||quantity>100||!Number.isInteger(expectedQuantity)||expectedQuantity<1||expectedQuantity>100)return response({error:"Geçersiz sepet adedi."},token,false,400,request);
  const[item]=await db.select().from(cartItems).where(and(eq(cartItems.id,id),eq(cartItems.cartId,cart.id))).limit(1);if(!item)return response({error:"Sepet ürünü bulunamadı"},token,false,404,request);if(item.quantity!==expectedQuantity)return response({error:"Çantanız başka bir işlemle güncellendi. Yenileyip tekrar deneyin.",code:"cart_changed"},token,false,409,request);if(quantity===0){const[deleted]=await db.delete(cartItems).where(and(eq(cartItems.id,id),eq(cartItems.cartId,cart.id),eq(cartItems.quantity,expectedQuantity))).returning({id:cartItems.id});if(!deleted)return response({error:"Çantanız başka bir işlemle güncellendi. Yenileyip tekrar deneyin.",code:"cart_changed"},token,false,409,request);await db.update(carts).set({revision:crypto.randomUUID(),updatedAt:new Date().toISOString()}).where(eq(carts.id,cart.id));return response({ok:true},token,false,200,request);}
  const[product]=await db.select().from(products).where(eq(products.id,item.productId)).limit(1);if(!product||!product.active)return response({error:"Ürün artık satışta değil."},token,false,409,request);if((cart.market==="TR"&&!product.marketTr)||(cart.market==="GLOBAL"&&!product.marketGlobal))return response({error:cart.market==="GLOBAL"?"Product is no longer available in the global store.":"Ürün artık Türkiye mağazasında satışta değil."},token,false,409,request);let maximum=product.stock;if(item.variantId){const[variant]=await db.select().from(productVariants).where(and(eq(productVariants.id,item.variantId),eq(productVariants.active,true))).limit(1);if(!variant)return response({error:"Ürün seçeneği artık satışta değil."},token,false,409,request);maximum=variant.stock;}if(quantity>maximum)return response({error:`En fazla ${maximum} adet seçebilirsiniz.`,maximum},token,false,409,request);const[changed]=await db.update(cartItems).set({quantity}).where(and(eq(cartItems.id,id),eq(cartItems.cartId,cart.id),eq(cartItems.quantity,expectedQuantity))).returning({quantity:cartItems.quantity});if(!changed)return response({error:"Çantanız başka bir işlemle güncellendi. Yenileyip tekrar deneyin.",code:"cart_changed"},token,false,409,request);await db.update(carts).set({revision:crypto.randomUUID(),updatedAt:new Date().toISOString()}).where(eq(carts.id,cart.id));return response({ok:true,quantity:changed.quantity},token,false,200,request);
}

export async function DELETE(request:Request){const{db,cart,token}=await lookupCart(request);if(!cart)return response({ok:true},token,false,200,request);const url=new URL(request.url);const id=Number(url.searchParams.get("id"));const expectedQuantity=Number(url.searchParams.get("expectedQuantity"));if(!id||!Number.isInteger(expectedQuantity)||expectedQuantity<1||expectedQuantity>100)return response({error:"Geçersiz sepet isteği."},token,false,400,request);const[deleted]=await db.delete(cartItems).where(and(eq(cartItems.id,id),eq(cartItems.cartId,cart.id),eq(cartItems.quantity,expectedQuantity))).returning({id:cartItems.id});if(!deleted)return response({error:"Çantanız başka bir işlemle güncellendi. Yenileyip tekrar deneyin.",code:"cart_changed"},token,false,409,request);await db.update(carts).set({revision:crypto.randomUUID(),updatedAt:new Date().toISOString()}).where(eq(carts.id,cart.id));return response({ok:true},token,false,200,request);}
