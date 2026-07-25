import {desc} from "drizzle-orm";
import {getDb} from "../../../db";
import {orderItems,orders,products} from "../../../db/schema";
import {getChatGPTUser} from "../../chatgpt-auth";

export const dynamic="force-dynamic";

export async function GET(){
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const db=getDb();const[orderRows,itemRows,productRows]=await Promise.all([db.select().from(orders).orderBy(desc(orders.id)).limit(1000),db.select().from(orderItems),db.select().from(products)]);
  const itemsByOrder=new Map<number,typeof itemRows>();for(const item of itemRows){const rows=itemsByOrder.get(item.orderId)??[];rows.push(item);itemsByOrder.set(item.orderId,rows);}
  const active=orderRows.filter(order=>order.status!=="cancelled");const realized=active.filter(order=>order.paymentStatus==="paid");
  function summarize(rows:typeof orderRows,market:"TR"|"GLOBAL"){
    const selected=rows.filter(order=>order.market===market);const cogsAvailable=market==="TR"&&selected.every(order=>(itemsByOrder.get(order.id)??[]).every(item=>item.unitCostSnapshot>0));const productRevenue=selected.reduce((sum,order)=>sum+order.subtotal-order.discountAmount,0);const shippingRevenue=selected.reduce((sum,order)=>sum+order.shippingAmount,0);const cogs=cogsAvailable?selected.reduce((sum,order)=>sum+(itemsByOrder.get(order.id)??[]).reduce((lineSum,item)=>lineSum+item.unitCostSnapshot*item.quantity,0),0):null;const grossProfit=cogs===null?null:productRevenue-cogs;
    return{orderCount:selected.length,revenue:selected.reduce((sum,order)=>sum+order.total,0),productRevenue,shippingRevenue,cogs,grossProfit,marginRate:grossProfit===null||productRevenue<=0?null:grossProfit/productRevenue*100,cogsAvailable};
  }
  const recent=active.slice(0,100).map(order=>{const lines=itemsByOrder.get(order.id)??[];const cogsAvailable=order.market==="TR"&&lines.every(item=>item.unitCostSnapshot>0);const cogs=cogsAvailable?lines.reduce((sum,item)=>sum+item.unitCostSnapshot*item.quantity,0):null;const productRevenue=order.subtotal-order.discountAmount;return{id:order.id,orderNumber:order.orderNumber,market:order.market,status:order.status,paymentStatus:order.paymentStatus,total:order.total,productRevenue,cogs,grossProfit:cogs===null?null:productRevenue-cogs,createdAt:order.createdAt};});
  const marginAlerts=productRows.filter(product=>product.active&&product.marketTr&&product.unitCost>0&&product.priceTr<=product.unitCost).map(product=>({id:product.id,name:product.nameTr,price:product.priceTr,cost:product.unitCost}));
  const missingCosts=productRows.filter(product=>product.active&&product.marketTr&&product.unitCost<=0).map(product=>({id:product.id,name:product.nameTr}));
  return Response.json({generatedAt:new Date().toISOString(),pipeline:{TR:summarize(active,"TR"),GLOBAL:summarize(active,"GLOBAL")},realized:{TR:summarize(realized,"TR"),GLOBAL:summarize(realized,"GLOBAL")},counts:{pendingPayment:active.filter(order=>order.paymentStatus==="pending").length,refunded:orderRows.filter(order=>order.paymentStatus==="refunded").length,paid:realized.length},marginAlerts,missingCosts,recent},{headers:{"Cache-Control":"no-store"}});
}
