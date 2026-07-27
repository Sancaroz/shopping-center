import {desc} from "drizzle-orm";
import {getDb} from "../../../db";
import {orders} from "../../../db/schema";
import {getChatGPTOwner} from "../../chatgpt-auth";

export const dynamic="force-dynamic";

type CustomerSummary={
  email:string;name:string;maskedPhone:string;city:string;country:string;
  orderCount:number;activeOrderCount:number;cancelledOrderCount:number;paidOrderCount:number;
  unverifiedActiveCount:number;totalTr:number;totalGlobal:number;
  firstOrderAt:string;lastOrderAt:string;lastOrderId:number;lastOrderNumber:string;lastOrderStatus:string;
};

function maskPhone(phone:string){const digits=phone.replace(/\D/g,"");if(digits.length<4)return"—";return`••• ••• ${digits.slice(-4)}`;}

export async function GET(){
  if(!(await getChatGPTOwner()))return Response.json({error:"Müşteri özeti yalnızca mağaza sahibine açıktır."},{status:403});
  const rows=await getDb().select({id:orders.id,orderNumber:orders.orderNumber,customerName:orders.customerName,email:orders.email,phone:orders.phone,city:orders.city,country:orders.country,market:orders.market,status:orders.status,paymentStatus:orders.paymentStatus,total:orders.total,emailVerifiedAt:orders.emailVerifiedAt,createdAt:orders.createdAt}).from(orders).orderBy(desc(orders.id)).limit(5000);
  const byEmail=new Map<string,CustomerSummary>();
  for(const order of rows){
    const email=order.email.trim().toLocaleLowerCase("en-US");if(!email)continue;
    let customer=byEmail.get(email);
    if(!customer){customer={email,name:order.customerName,maskedPhone:maskPhone(order.phone),city:order.city,country:order.country,orderCount:0,activeOrderCount:0,cancelledOrderCount:0,paidOrderCount:0,unverifiedActiveCount:0,totalTr:0,totalGlobal:0,firstOrderAt:order.createdAt,lastOrderAt:order.createdAt,lastOrderId:order.id,lastOrderNumber:order.orderNumber,lastOrderStatus:order.status};byEmail.set(email,customer);}
    customer.orderCount+=1;customer.firstOrderAt=order.createdAt;
    if(order.status==="cancelled")customer.cancelledOrderCount+=1;else{customer.activeOrderCount+=1;if(!order.emailVerifiedAt)customer.unverifiedActiveCount+=1;if(order.market==="TR")customer.totalTr+=order.total;else customer.totalGlobal+=order.total;}
    if(order.paymentStatus==="paid")customer.paidOrderCount+=1;
  }
  const customers=[...byEmail.values()];
  return Response.json({generatedAt:new Date().toISOString(),summary:{customerCount:customers.length,repeatCustomerCount:customers.filter(item=>item.orderCount>1).length,verifiedCustomerCount:customers.filter(item=>item.unverifiedActiveCount===0&&item.activeOrderCount>0).length,attentionCount:customers.filter(item=>item.unverifiedActiveCount>0).length},customers},{headers:{"Cache-Control":"no-store"}});
}
