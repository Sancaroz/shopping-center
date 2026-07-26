import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { recordAudit } from "../../audit-log";
import { findMediaUsage, listMediaUsage, mediaUrl } from "../../media-usage";

type ObjectRow={key:string;size:number;uploaded:Date};
type Bucket={list(options?:{prefix?:string;limit?:number}):Promise<{objects:ObjectRow[]}>;delete(key:string):Promise<void>};
const bucket=()=>((env as unknown as{MEDIA?:Bucket}).MEDIA);

export async function GET(){
  if(!(await getChatGPTUser()))return Response.json({error:"Yetkisiz erişim"},{status:401});
  const media=bucket();if(!media)return Response.json({error:"Medya alanı hazır değil."},{status:503});
  const[result,usage]=await Promise.all([media.list({prefix:"products/",limit:1000}),listMediaUsage()]);
  return Response.json({items:result.objects.sort((a,b)=>new Date(b.uploaded).getTime()-new Date(a.uploaded).getTime()).map(item=>({key:item.key,url:mediaUrl(item.key),size:item.size,uploaded:item.uploaded,usedBy:usage.get(mediaUrl(item.key))??[]}))});
}

export async function DELETE(request:Request){
  const user=await getChatGPTUser();if(!user)return Response.json({error:"Yetkisiz erişim"},{status:401});
  const body=await request.json().catch(()=>null)as{key?:unknown}|null;const key=typeof body?.key==="string"?body.key:"";
  if(!/^products\/[a-zA-Z0-9._-]+$/.test(key)||key.includes(".."))return Response.json({error:"Geçersiz medya kaydı."},{status:400});
  const imageUrl=mediaUrl(key);const usedBy=await findMediaUsage(imageUrl);
  if(usedBy.length)return Response.json({error:`Bu görsel ${usedBy.join(", ")} içinde kullanılıyor. Önce ilgili kayıttan kaldırın.`,usedBy},{status:409});
  const media=bucket();if(!media)return Response.json({error:"Medya alanı hazır değil."},{status:503});
  await media.delete(key);
  await recordAudit({user,action:"media.delete",entityType:"media",entityId:key,summary:"Kullanılmayan görsel medya alanından kalıcı olarak silindi.",before:{key,imageUrl},after:{deleted:true}});
  return Response.json({ok:true});
}
