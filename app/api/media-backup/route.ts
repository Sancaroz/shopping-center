import {env} from "cloudflare:workers";
import {zipSync} from "fflate";
import {recordAudit} from "../../audit-log";
import {getChatGPTOwner} from "../../chatgpt-auth";
import {isSafeMediaKey,mediaBackupSnapshot,partitionMediaBackup,type MediaBackupObject} from "../../media-backup";

type ListedObject={key:string;size:number;uploaded:Date|string;etag?:string};
type StoredObject={body:ReadableStream;size:number;etag:string;httpEtag?:string;httpMetadata?:{contentType?:string};arrayBuffer():Promise<ArrayBuffer>};
type MediaBucket={list(options:{prefix:string;limit:number;cursor?:string}):Promise<{objects:ListedObject[];truncated:boolean;cursor?:string}>;get(key:string):Promise<StoredObject|null>};

export const dynamic="force-dynamic";
const noStore={"Cache-Control":"private, no-store, max-age=0"};
const MAX_MEDIA_OBJECTS=5_000;
const safeContentTypes=new Set(["image/jpeg","image/png","image/webp"]);
const bucket=()=>((env as unknown as{MEDIA?:MediaBucket}).MEDIA);

async function listAllMedia(media:MediaBucket){
  const objects:MediaBackupObject[]=[];let cursor:string|undefined;
  do{const page=await media.list({prefix:"products/",limit:1_000,...(cursor?{cursor}:{})});for(const item of page.objects){if(!isSafeMediaKey(item.key))continue;objects.push({key:item.key,size:item.size,uploaded:new Date(item.uploaded).toISOString(),etag:String(item.etag??"")});if(objects.length>MAX_MEDIA_OBJECTS)throw new Error("too_many_media_objects");}cursor=page.truncated?page.cursor:undefined;if(page.truncated&&!cursor)throw new Error("invalid_media_cursor");}while(cursor);
  return objects;
}

async function sha256(bytes:Uint8Array){const digest=await crypto.subtle.digest("SHA-256",bytes as BufferSource);return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");}

export async function GET(request:Request){
  const user=await getChatGPTOwner();if(!user)return Response.json({error:"Medya yedekleri yalnızca mağaza sahibine açıktır."},{status:403,headers:noStore});
  const media=bucket();if(!media)return Response.json({error:"Medya alanı hazır değil."},{status:503,headers:noStore});
  const url=new URL(request.url);const requestedKey=url.searchParams.get("key")??"";
  if(requestedKey){
    if(!isSafeMediaKey(requestedKey))return Response.json({error:"Geçersiz medya anahtarı."},{status:400,headers:noStore});
    const object=await media.get(requestedKey);if(!object)return Response.json({error:"Medya dosyası bulunamadı."},{status:404,headers:noStore});const contentType=object.httpMetadata?.contentType??"";if(!safeContentTypes.has(contentType))return Response.json({error:"Medya dosyası desteklenen bir görsel biçiminde değil."},{status:415,headers:noStore});
    await recordAudit({user,action:"media.backup.download",entityType:"media",entityId:requestedKey,summary:"Tekil medya dosyası yedek kopyası indirildi.",after:{key:requestedKey,size:object.size,etag:object.etag}});
    const filename=requestedKey.split("/").pop()??"mysa-gorsel";return new Response(object.body,{headers:{...noStore,"Content-Type":contentType,"Content-Length":String(object.size),"Content-Disposition":`attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,"X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox","Cross-Origin-Resource-Policy":"same-origin"}});
  }
  let objects:MediaBackupObject[];try{objects=await listAllMedia(media);}catch(error){return Response.json({error:error instanceof Error&&error.message==="too_many_media_objects"?"Medya envanteri 5.000 dosya sınırını aşıyor; yedekleme planı bölünmelidir.":"Medya envanteri güvenli biçimde okunamadı."},{status:error instanceof Error&&error.message==="too_many_media_objects"?413:503,headers:noStore});}
  const snapshot=await mediaBackupSnapshot(objects);const{parts,individual}=partitionMediaBackup(objects);const partNumber=Number(url.searchParams.get("part")??0);
  if(!partNumber)return Response.json({generatedAt:new Date().toISOString(),snapshot,count:objects.length,totalBytes:objects.reduce((sum,item)=>sum+item.size,0),parts:parts.map(part=>({number:part.number,count:part.objects.length,size:part.size})),individual},{headers:noStore});
  if(!Number.isInteger(partNumber)||partNumber<1)return Response.json({error:"Geçersiz medya yedek parçası."},{status:400,headers:noStore});
  const requestedSnapshot=url.searchParams.get("snapshot")??"";if(!/^[a-f0-9]{64}$/.test(requestedSnapshot)||requestedSnapshot!==snapshot)return Response.json({error:"Medya kütüphanesi yedek listesi oluşturulduktan sonra değişti. Listeyi yenileyip parçaları yeniden indirin."},{status:409,headers:noStore});
  const part=parts.find(item=>item.number===partNumber);if(!part)return Response.json({error:"Medya yedek parçası bulunamadı."},{status:404,headers:noStore});
  const files=await Promise.all(part.objects.map(async listed=>{const object=await media.get(listed.key);if(!object||object.size!==listed.size||object.etag!==listed.etag)throw new Error("media_changed");const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.byteLength!==listed.size)throw new Error("media_changed");return{listed,bytes,checksum:await sha256(bytes)};})).catch(()=>null);
  if(!files)return Response.json({error:"Arşiv hazırlanırken bir medya dosyası değişti. Listeyi yenileyip tekrar deneyin."},{status:409,headers:noStore});
  const archiveFiles:Record<string,Uint8Array>={};for(const file of files)archiveFiles[file.listed.key]=file.bytes;const manifest={format:"mysa-media-backup",version:1,createdAt:new Date().toISOString(),snapshot,part:part.number,totalParts:parts.length,objects:files.map(file=>({...file.listed,sha256:file.checksum}))};archiveFiles["mysa-media-manifest.json"]=new TextEncoder().encode(JSON.stringify(manifest,null,2));const archive=zipSync(archiveFiles,{level:0});
  await recordAudit({user,action:"media.backup.download",entityType:"media",entityId:`${snapshot}:${part.number}`,summary:`Medya yedeğinin ${part.number}/${parts.length} parçası indirildi.`,after:{snapshot,part:part.number,totalParts:parts.length,fileCount:files.length,sourceBytes:part.size,archiveBytes:archive.byteLength}});
  const date=new Date().toISOString().slice(0,10);return new Response(archive as BodyInit,{headers:{...noStore,"Content-Type":"application/zip","Content-Length":String(archive.byteLength),"Content-Disposition":`attachment; filename="mysa-medya-yedegi-${date}-parca-${part.number}-${parts.length}.zip"`,"X-Content-Type-Options":"nosniff","Content-Security-Policy":"default-src 'none'; sandbox","Cross-Origin-Resource-Policy":"same-origin"}});
}
