import { getChatGPTOwner } from "../../../chatgpt-auth";
import { getIntegrationStatus } from "../../../integrations/runtime";

export const dynamic="force-dynamic";

export async function GET(){
  if(!(await getChatGPTOwner()))return Response.json({error:"Entegrasyon bilgileri yalnızca mağaza sahibine açıktır."},{status:403});
  return Response.json({integrations:getIntegrationStatus()},{headers:{"Cache-Control":"no-store"}});
}
