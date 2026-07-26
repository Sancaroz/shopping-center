import {asc,desc,eq} from "drizzle-orm";
import {getDb} from "../../../db";
import {orders,paymentTransactions} from "../../../db/schema";
import {recordAudit} from "../../audit-log";
import {getChatGPTUser} from "../../chatgpt-auth";

export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};
const roundMoney=(value:number)=>Math.round((value+Number.EPSILON)*100)/100;

export async function GET(){
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401,headers:noStore});
  const db=getDb();
  const [transactionRows,orderRows]=await Promise.all([
    db.select({id:paymentTransactions.id,orderId:paymentTransactions.orderId,transactionKey:paymentTransactions.transactionKey,kind:paymentTransactions.kind,status:paymentTransactions.status,provider:paymentTransactions.provider,providerReference:paymentTransactions.providerReference,amount:paymentTransactions.amount,currency:paymentTransactions.currency,source:paymentTransactions.source,reconciliationStatus:paymentTransactions.reconciliationStatus,expectedAmount:paymentTransactions.expectedAmount,note:paymentTransactions.note,occurredAt:paymentTransactions.occurredAt,actorEmail:paymentTransactions.actorEmail,createdAt:paymentTransactions.createdAt,orderNumber:orders.orderNumber,customerName:orders.customerName,orderTotal:orders.total,market:orders.market}).from(paymentTransactions).innerJoin(orders,eq(paymentTransactions.orderId,orders.id)).orderBy(desc(paymentTransactions.id)).limit(500),
    db.select({id:orders.id,orderNumber:orders.orderNumber,customerName:orders.customerName,total:orders.total,market:orders.market,paymentStatus:orders.paymentStatus,createdAt:orders.createdAt}).from(orders).orderBy(desc(orders.id)).limit(500),
  ]);
  return Response.json({transactions:transactionRows,orders:orderRows,summary:{matched:transactionRows.filter(row=>row.reconciliationStatus==="matched").length,mismatched:transactionRows.filter(row=>["amount_mismatch","order_closed"].includes(row.reconciliationStatus)).length,pending:transactionRows.filter(row=>row.status==="pending").length,failed:transactionRows.filter(row=>row.status==="failed").length}},{headers:noStore});
}

export async function POST(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401,headers:noStore});
  const body=await request.json().catch(()=>null) as Record<string,unknown>|null;if(!body)return Response.json({error:"Geçersiz ödeme kaydı."},{status:400,headers:noStore});
  const orderId=Number(body.orderId);const kind=String(body.kind??"");const status=String(body.status??"");const provider=String(body.provider??"").trim().slice(0,80);const providerReference=String(body.providerReference??"").trim().slice(0,160);const amount=roundMoney(Number(body.amount));const note=String(body.note??"").trim().slice(0,1000);const occurredInput=String(body.occurredAt??"").trim();const occurredDate=occurredInput?new Date(occurredInput):new Date();
  if(!orderId||!["payment","refund"].includes(kind)||!["pending","succeeded","failed"].includes(status)||!provider||!providerReference||!Number.isFinite(amount)||amount<=0||amount>1_000_000_000||Number.isNaN(occurredDate.getTime()))return Response.json({error:"Sipariş, işlem türü, durum, sağlayıcı, referans ve geçerli tutar zorunludur."},{status:400,headers:noStore});const occurredAt=occurredDate.toISOString();
  const db=getDb();const[order]=await db.select().from(orders).where(eq(orders.id,orderId)).limit(1);if(!order)return Response.json({error:"Sipariş bulunamadı."},{status:404,headers:noStore});
  const previous=await db.select().from(paymentTransactions).where(eq(paymentTransactions.orderId,orderId)).orderBy(asc(paymentTransactions.id));const successful=previous.filter(row=>row.status==="succeeded"&&row.reconciliationStatus==="matched");const paidTotal=roundMoney(successful.filter(row=>row.kind==="payment").reduce((sum,row)=>sum+row.amount,0));const refundedTotal=roundMoney(successful.filter(row=>row.kind==="refund").reduce((sum,row)=>sum+row.amount,0));const legacyPaidBase=paidTotal===0&&order.paymentStatus==="paid"?order.total:paidTotal;const refundable=roundMoney(Math.max(0,legacyPaidBase-refundedTotal));const paymentExpected=roundMoney(Math.max(0,order.total-paidTotal-(order.paymentStatus==="paid"?order.total:0)));const expectedAmount=kind==="payment"?paymentExpected:refundable;const reconciliationStatus=status!=="succeeded"?"not_applicable":kind==="payment"&&order.status==="cancelled"?"order_closed":kind==="payment"&&paymentExpected>0&&Math.abs(amount-paymentExpected)<0.005?"matched":kind==="refund"&&refundable>0&&amount<=refundable?"matched":"amount_mismatch";
  const transactionKey=`${provider.toLocaleLowerCase("en-US")}:${providerReference.toLocaleLowerCase("en-US")}:${kind}`;const[transaction]=await db.insert(paymentTransactions).values({orderId,transactionKey,kind,status,provider,providerReference,amount,currency:order.market==="TR"?"TRY":"EUR",source:"manual",reconciliationStatus,expectedAmount,note,occurredAt,actorEmail:user.email}).onConflictDoNothing({target:paymentTransactions.transactionKey}).returning();if(!transaction)return Response.json({error:"Bu sağlayıcı referansı ve işlem türü daha önce kaydedildi."},{status:409,headers:noStore});
  if(status==="succeeded"&&reconciliationStatus==="matched"){
    if(kind==="payment")await db.update(orders).set({paymentStatus:"paid",paymentProvider:provider,paymentReference:providerReference,updatedAt:new Date().toISOString()}).where(eq(orders.id,orderId));
    else {const nextRefunded=roundMoney(refundedTotal+amount);await db.update(orders).set({paymentStatus:nextRefunded>=legacyPaidBase?"refunded":"partially_refunded",paymentProvider:provider,paymentReference:providerReference,updatedAt:new Date().toISOString()}).where(eq(orders.id,orderId));}
  }
  await recordAudit({user,action:"payment_transaction.create",entityType:"payment_transaction",entityId:transaction.id,summary:`${order.orderNumber} için ${kind==="payment"?"ödeme":"iade"} işlemi kaydedildi.`,after:{orderId,kind,status,provider,providerReference,amount,currency:transaction.currency,reconciliationStatus}});
  return Response.json({transaction},{status:201,headers:noStore});
}
