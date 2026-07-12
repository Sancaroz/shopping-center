import { env } from "cloudflare:workers";

type MediaObject = { body: ReadableStream; httpMetadata?: { contentType?: string } };
type MediaBucket = { get(key: string): Promise<MediaObject | null> };

export async function GET(_request: Request, context: { params: Promise<{ key: string[] }> }) {
  const { key } = await context.params;
  const bucket = (env as unknown as { MEDIA?: MediaBucket }).MEDIA;
  if (!bucket) return new Response("Not found", { status: 404 });
  const object = await bucket.get(key.join("/"));
  if (!object) return new Response("Not found", { status: 404 });
  return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Cache-Control": "public, max-age=31536000, immutable" } });
}
