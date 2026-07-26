import { env } from "cloudflare:workers";

type MediaObject = { body: ReadableStream; httpMetadata?: { contentType?: string } };
type MediaBucket = { get(key: string): Promise<MediaObject | null> };
const safeContentTypes=new Set(["image/jpeg","image/png","image/webp"]);

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const objectKey=key.join("/");
  if(!/^products\/[a-zA-Z0-9._-]+$/.test(objectKey)||objectKey.includes(".."))return new Response("Not found",{status:404});
  const bucket = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
  if (!bucket) return new Response("Not found", { status: 404 });
  const object = await bucket.get(objectKey);
  if (!object) return new Response("Not found", { status: 404 });
  const contentType=object.httpMetadata?.contentType??"";
  if(!safeContentTypes.has(contentType))return new Response("Unsupported media type",{status:415,headers:{"X-Content-Type-Options":"nosniff"}});
  return new Response(object.body, { headers: { "Content-Type": contentType, "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options":"nosniff", "Content-Security-Policy":"default-src 'none'; sandbox", "Cross-Origin-Resource-Policy":"same-origin" } });
}
