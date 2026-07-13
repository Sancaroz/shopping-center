import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { cartItems, carts, orderItems, orders, products, productVariants, storeSettings } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

const COOKIE = "store_cart";
const tokenFrom = (request:Request) => request.headers.get("cookie")?.split(";").map(value => value.trim()).find(value => value.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1) ?? null;

export async function GET(request:Request) {
  if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" }, { status:401 });
  const db = getDb();
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (id) {
    const [order] = await db.select().from(orders).where(eq(orders.id,id)).limit(1);
    if (!order) return Response.json({ error:"Sipariş bulunamadı" }, { status:404 });
    const items = await db.select().from(orderItems).where(eq(orderItems.orderId,id));
    return Response.json({ order, items });
  }
  const rows = await db.select().from(orders).orderBy(desc(orders.id));
  return Response.json({ orders:rows });
}

export async function POST(request:Request) {
  const token = tokenFrom(request);
  if (!token) return Response.json({ error:"Çantanız bulunamadı." }, { status:400 });
  const body = await request.json() as Record<string, unknown>;
  const customerName = String(body.customerName ?? "").trim();
  const email = String(body.email ?? "").trim();
  const phone = String(body.phone ?? "").trim();
  const address = String(body.address ?? "").trim();
  const city = String(body.city ?? "").trim();
  if (!customerName || !email.includes("@") || !phone || !address || !city) return Response.json({ error:"Lütfen zorunlu teslimat bilgilerini eksiksiz girin." }, { status:400 });

  const db = getDb();
  const [cart] = await db.select().from(carts).where(eq(carts.token, token)).limit(1);
  if (!cart) return Response.json({ error:"Çantanız bulunamadı." }, { status:400 });
  const lines = await db.select({
    cartItemId:cartItems.id, productId:products.id, variantId:productVariants.id, quantity:cartItems.quantity,
    productName:products.nameTr, priceTr:products.priceTr, priceGlobal:products.priceGlobal, stock:products.stock,
    optionName:productVariants.optionName, optionValue:productVariants.optionValue,
    variantStock:productVariants.stock, priceAdjustment:productVariants.priceAdjustment,
  }).from(cartItems).innerJoin(products, eq(cartItems.productId, products.id)).leftJoin(productVariants, eq(cartItems.variantId, productVariants.id)).where(eq(cartItems.cartId, cart.id));
  if (!lines.length) return Response.json({ error:"Çantanız boş." }, { status:400 });
  const unavailable = lines.find(line => line.quantity > (line.variantId ? Number(line.variantStock ?? 0) : line.stock));
  if (unavailable) return Response.json({ error:`${unavailable.productName} için yeterli stok bulunmuyor.` }, { status:409 });

  const priced = lines.map(line => ({ ...line, unitPrice:(cart.market === "GLOBAL" ? line.priceGlobal : line.priceTr) + Number(line.priceAdjustment ?? 0) }));
  const subtotal = priced.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const settingRows=await db.select().from(storeSettings);const settings=Object.fromEntries(settingRows.map(row=>[row.key,row.value]));const shippingFee=Number(cart.market==="GLOBAL"?(settings.shippingGlobal??15):(settings.shippingTr??99));const freeLimit=Number(cart.market==="GLOBAL"?(settings.freeShippingGlobal??150):(settings.freeShippingTr??1500));const shippingAmount=subtotal>=freeLimit?0:shippingFee;const total=subtotal+shippingAmount;
  const orderNumber = `MS-${new Date().toISOString().slice(0,10).replaceAll("-","")}-${crypto.randomUUID().slice(0,6).toUpperCase()}`;
  const [order] = await db.insert(orders).values({
    orderNumber, market:cart.market, customerName, email, phone, address, city,
    postalCode:String(body.postalCode ?? "").trim(), country:String(body.country ?? "Türkiye").trim() || "Türkiye",
    note:String(body.note ?? "").trim(), subtotal, shippingAmount, total,
  }).returning();
  await db.insert(orderItems).values(priced.map(line => ({
    orderId:order.id, productId:line.productId, variantId:line.variantId, productName:line.productName,
    variantLabel:line.optionValue ? `${line.optionName}: ${line.optionValue}` : "", quantity:line.quantity, unitPrice:line.unitPrice,
  })));
  await db.delete(cartItems).where(eq(cartItems.cartId, cart.id));
  return Response.json({ orderNumber, subtotal, shippingAmount, total, market:cart.market }, { status:201 });
}

export async function PATCH(request:Request) {
  if (!(await getChatGPTUser())) return Response.json({ error:"Yetkisiz erişim" }, { status:401 });
  const body = await request.json() as { id?:number; status?:string };
  const allowed = ["new", "confirmed", "preparing", "completed", "cancelled"];
  if (!body.id || !allowed.includes(String(body.status))) return Response.json({ error:"Geçersiz sipariş durumu" }, { status:400 });
  const [order] = await getDb().update(orders).set({ status:String(body.status), updatedAt:new Date().toISOString() }).where(eq(orders.id, Number(body.id))).returning();
  return Response.json({ order });
}
