const MAX_AGE_SECONDS=300;

function hex(bytes:ArrayBuffer){return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,"0")).join("");}
function constantTimeEqual(left:string,right:string){
  if(left.length!==right.length)return false;
  let difference=0;
  for(let index=0;index<left.length;index++)difference|=left.charCodeAt(index)^right.charCodeAt(index);
  return difference===0;
}

export async function verifyWebhookSignature(input:{rawBody:string;signature:string;timestamp:string;secret:string;now?:number}){
  const timestamp=Number(input.timestamp);
  const now=Math.floor((input.now??Date.now())/1000);
  if(!Number.isFinite(timestamp)||Math.abs(now-timestamp)>MAX_AGE_SECONDS)return {valid:false,reason:"timestamp"};
  if(!/^[a-f0-9]{64}$/i.test(input.signature)||!input.secret)return {valid:false,reason:"signature"};
  const key=await crypto.subtle.importKey("raw",new TextEncoder().encode(input.secret),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const expected=hex(await crypto.subtle.sign("HMAC",key,new TextEncoder().encode(`${input.timestamp}.${input.rawBody}`)));
  return {valid:constantTimeEqual(expected,input.signature.toLocaleLowerCase("en-US")),reason:"signature"};
}
