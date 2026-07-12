import { env } from "cloudflare:workers";
import { getChatGPTUser } from "../../chatgpt-auth";

type MediaBucket = { put(key: string, value: ArrayBuffer, options?: { httpMetadata?: { contentType?: string } }): Promise<unknown> };

export async function POST(request: Request) {
  if (!(await getChatGPTUser())) return Response.json({ error: "Yetkisiz erişim" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return Response.json({ error: "Görsel seçilmedi." }, { status: 400 });
  if (!file.type.startsWith("image/")) return Response.json({ error: "Yalnızca görsel yükleyebilirsiniz." }, { status: 400 });
  if (file.size > 8_000_000) return Response.json({ error: "Görsel en fazla 8 MB olabilir." }, { status: 400 });
  const bucket = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
  if (!bucket) return Response.json({ error: "Medya alanı hazır değil." }, { status: 503 });
  const safeName = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, "-");
  const key = `products/${Date.now()}-${safeName}`;
  await bucket.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
  return Response.json({ key, imageUrl: `/api/media/${encodeURIComponent(key)}` }, { status: 201 });
}
