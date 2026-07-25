import { getIntegrationStatus, getPaymentWebhookSecret } from "../../../integrations/runtime";
import { verifyWebhookSignature } from "../../../integrations/webhook-signature";

export const dynamic="force-dynamic";
const noStore={"Cache-Control":"no-store"};

export async function POST(request:Request){
  const status=getIntegrationStatus();
  const secret=getPaymentWebhookSecret();
  if(!status.payment.credentialsConfigured||!secret)return Response.json({error:"Ödeme webhook bağlantısı etkin değil."},{status:503,headers:noStore});
  const rawBody=await request.text();
  if(new TextEncoder().encode(rawBody).byteLength>100_000)return Response.json({error:"Webhook içeriği çok büyük."},{status:413,headers:noStore});
  const verification=await verifyWebhookSignature({
    rawBody,
    signature:request.headers.get("x-mysa-signature")??"",
    timestamp:request.headers.get("x-mysa-timestamp")??"",
    secret,
  });
  if(!verification.valid)return Response.json({error:"Webhook imzası doğrulanamadı."},{status:401,headers:noStore});
  return Response.json({
    accepted:true,
    processed:false,
    message:"İmza doğrulandı; sağlayıcı adaptörü etkinleşene kadar sipariş durumu değiştirilmedi.",
  },{status:202,headers:noStore});
}
