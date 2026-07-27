import {desc} from "drizzle-orm";
import {getDb} from "../../../../db";
import {paymentWebhookReceipts} from "../../../../db/schema";
import { getChatGPTOwner } from "../../../chatgpt-auth";
import { getIntegrationStatus } from "../../../integrations/runtime";

export const dynamic="force-dynamic";

export async function GET(){
  if(!(await getChatGPTOwner()))return Response.json({error:"Entegrasyon bilgileri yalnızca mağaza sahibine açıktır."},{status:403});
  const receipts=await getDb().select({status:paymentWebhookReceipts.status,receivedAt:paymentWebhookReceipts.receivedAt}).from(paymentWebhookReceipts).orderBy(desc(paymentWebhookReceipts.id)).limit(100);
  return Response.json({integrations:getIntegrationStatus(),paymentWebhook:{retainedRecent:receipts.length,awaitingAdapter:receipts.filter(receipt=>receipt.status==="awaiting_adapter").length,lastReceivedAt:receipts[0]?.receivedAt??null}},{headers:{"Cache-Control":"no-store"}});
}
