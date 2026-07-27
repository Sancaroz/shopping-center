import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";
import { recordAudit } from "../../audit-log";
import { validateUploadedMedia } from "../../media-validation";
import { enforceRateLimit } from "../../rate-limit";

type MediaBucket = { put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown> };

export async function POST(request: Request) {
  const user=await getChatGPTUser();
  if (!user) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const contentType=request.headers.get("content-type")??"";
  if(!contentType.toLowerCase().startsWith("multipart/form-data"))return Response.json({error:"Görsel yükleme biçimi geçersiz."},{status:415});
  const declaredLength=Number(request.headers.get("content-length")??0);
  if(Number.isFinite(declaredLength)&&declaredLength>9_000_000)return Response.json({error:"Yükleme isteği izin verilen boyutu aşıyor."},{status:413});
  const limited=await enforceRateLimit(request,{scope:"media_upload",identifier:user.email,limit:30,windowMinutes:60});if(limited)return limited;
  const form = await request.formData().catch(()=>null);
  if(!form)return Response.json({error:"Görsel yükleme isteği okunamadı."},{status:400});
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Görsel seçilmedi." }, { status: 400 });
  let media;
  try { media=await validateUploadedMedia(file); }
  catch(error) { return Response.json({error:error instanceof Error?error.message:"Görsel doğrulanamadı."},{status:400}); }
  const bucket = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
  if (!bucket) return Response.json({ error: "Medya alanı hazır değil." }, { status: 503 });
  const key = `products/${Date.now()}-${crypto.randomUUID()}.${media.extension}`;
  await bucket.put(key, media.bytes, { httpMetadata: { contentType: media.contentType } });
  await recordAudit({user,action:"media.upload",entityType:"media",entityId:key,summary:`${media.contentType} biçiminde görsel yüklendi.`,after:{key,contentType:media.contentType,size:file.size}});
  return Response.json({ key, imageUrl: `/api/media/${encodeURIComponent(key)}` }, { status: 201 });
}
