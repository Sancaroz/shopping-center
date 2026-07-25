import {eq} from "drizzle-orm";
import {getDb} from "../../../../db";
import {cartItems,carts,products,productVariants} from "../../../../db/schema";
import {enforceRateLimit} from "../../../rate-limit";
import {evaluatePromotion} from "../../../promotions";

const COOKIE="store_cart";const tokenFrom=(request:Request)=>request.headers.get("cookie")?.split(";").map(value=>value.trim()).find(value=>value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length+1)??null;

export async function POST(request:Request){
  const token=tokenFrom(request);if(!token)return Response.json({error:"Çantanız bulunamadı."},{status:400});
  const body=await request.json().catch(()=>null) as {code?:string}|null;const code=String(body?.code??"").trim().toUpperCase().slice(0,40);if(!/^[A-Z0-9_-]{3,40}$/.test(code))return Response.json({error:"İndirim kodu geçersiz veya kullanıma kapalı."},{status:400});
  const limited=await enforceRateLimit(request,{scope:"promotion_validate",identifier:`${token}:${code}`,limit:30,windowMinutes:15});if(limited)return limited;
  const db=getDb();const[cart]=await db.select().from(carts).where(eq(carts.token,token)).limit(1);if(!cart)return Response.json({error:"Çantanız bulunamadı."},{status:400});
  const lines=await db.select({quantity:cartItems.quantity,priceTr:products.priceTr,priceGlobal:products.priceGlobal,priceAdjustment:productVariants.priceAdjustment}).from(cartItems).innerJoin(products,eq(cartItems.productId,products.id)).leftJoin(productVariants,eq(cartItems.variantId,productVariants.id)).where(eq(cartItems.cartId,cart.id));
  const subtotal=lines.reduce((sum,line)=>sum+((cart.market==="GLOBAL"?line.priceGlobal:line.priceTr)+Number(line.priceAdjustment??0))*line.quantity,0);const result=await evaluatePromotion(db,{code,market:cart.market==="GLOBAL"?"GLOBAL":"TR",subtotal});if(!result.ok)return Response.json({error:result.error},{status:409});
  return Response.json({code:result.promotion?.code??"",discountAmount:result.discountAmount,subtotalAfterDiscount:Math.max(0,subtotal-result.discountAmount)},{headers:{"Cache-Control":"no-store"}});
}
