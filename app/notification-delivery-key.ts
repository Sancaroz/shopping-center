export type NotificationSource="order"|"newsletter";

export async function notificationProviderIdempotencyKey(source:NotificationSource,eventKey:string){const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${source}:${eventKey}`));return`mysa_${[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("")}`;}
