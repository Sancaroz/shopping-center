export type MediaBackupObject={key:string;size:number;uploaded:string;etag:string};
export type MediaBackupPart={number:number;size:number;objects:MediaBackupObject[]};

export const MEDIA_ARCHIVE_MAX_BYTES=24*1024*1024;
export const MEDIA_ARCHIVE_MAX_FILES=40;

export function isSafeMediaKey(key:string){return /^products\/[a-zA-Z0-9._-]+$/.test(key)&&!key.includes("..");}

export function partitionMediaBackup(objects:MediaBackupObject[]){
  const parts:MediaBackupPart[]=[];const individual:MediaBackupObject[]=[];
  for(const object of [...objects].sort((a,b)=>a.key.localeCompare(b.key))){
    if(!isSafeMediaKey(object.key)||!Number.isSafeInteger(object.size)||object.size<0)continue;
    if(object.size>MEDIA_ARCHIVE_MAX_BYTES){individual.push(object);continue;}
    let part=parts.at(-1);if(!part||part.objects.length>=MEDIA_ARCHIVE_MAX_FILES||part.size+object.size>MEDIA_ARCHIVE_MAX_BYTES){part={number:parts.length+1,size:0,objects:[]};parts.push(part);}
    part.objects.push(object);part.size+=object.size;
  }
  return{parts,individual};
}

export async function mediaBackupSnapshot(objects:MediaBackupObject[]){
  const stable=[...objects].sort((a,b)=>a.key.localeCompare(b.key)).map(({key,size,etag})=>({key,size,etag}));
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(JSON.stringify(stable)));
  return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("");
}
