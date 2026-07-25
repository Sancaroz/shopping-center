export function createVerificationToken(){return `${crypto.randomUUID().replaceAll("-","")}${crypto.randomUUID().replaceAll("-","")}`;}
export async function hashVerificationToken(token:string){const bytes=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(token));return Array.from(new Uint8Array(bytes),byte=>byte.toString(16).padStart(2,"0")).join("");}
