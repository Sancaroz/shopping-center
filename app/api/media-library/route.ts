import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { recordAudit } from "../../audit-log";
import { findMediaUsage, listMediaUsage, mediaUrl } from "../../media-usage";
import { readBoundedJson } from "../../public-form-security";

type ObjectRow={key:string;size:number;uploaded:Date};
type Bucket={list(options?:{prefix?:string;limit?:number}):Promise<{objects:ObjectRow[]}>;delete(key:string):Promise<void>};
const bucket=()=>((env as unknown as{MEDIA?:Bucket}).MEDIA);
const noStore={"Cache-Control":"private, no-store, max-age=0"};

export async function GET(){
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401,headers:noStore});
  const media=bucket();if(!media)return Response.json({error:"Medya alanı hazır değil."},{status:503,headers:noStore});
  const[result,usage]=await Promise.all([media.list({prefix:"products/",limit:1000}),listMediaUsage()]);
  return Response.json({items:result.objects.sort((a,b)=>new Date(b.uploaded).getTime()-new Date(a.uploaded).getTime()).map(item=>({key:item.key,url:mediaUrl(item.key),size:item.size,uploaded:item.uploaded,usedBy:usage.get(mediaUrl(item.key))??[]}))},{headers:noStore});
}

export async function DELETE(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401,headers:noStore});
  const parsed=await readBoundedJson(request,2_000);if(parsed.error)return parsed.error;const key=typeof parsed.body?.key==="string"?parsed.body.key:"";
  if(!/^products\/[a-zA-Z0-9._-]+$/.test(key)||key.includes(".."))return Response.json({error:"Geçersiz medya kaydı."},{status:400});
  const imageUrl=mediaUrl(key);const usedBy=await findMediaUsage(imageUrl);
  if(usedBy.length)return Response.json({error:`Bu görsel ${usedBy.join(", ")} içinde kullanılıyor. Önce ilgili kayıttan kaldırın.`,usedBy},{status:409});
  const media=bucket();if(!media)return Response.json({error:"Medya alanı hazır değil."},{status:503});
  await media.delete(key);
  await recordAudit({user,action:"media.delete",entityType:"media",entityId:key,summary:"Kullanılmayan görsel medya alanından kalıcı olarak silindi.",before:{key,imageUrl},after:{deleted:true}});
  return Response.json({ok:true},{headers:noStore});
}
