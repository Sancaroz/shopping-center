import { getChatGPTUser } from "../../../chatgpt-auth";
import { getIntegrationStatus } from "../../../integrations/runtime";

export const dynamic="force-dynamic";

export async function GET(){
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  return Response.json({integrations:getIntegrationStatus()},{headers:{"Cache-Control":"no-store"}});
}
