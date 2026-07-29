import {requestJson} from "../client-request";

type SettingsData={settings:Record<string,string>;revision:string;error?:string};

let revision="";

export async function fetchSettings(){
  const result=await requestJson<SettingsData>("/api/settings",{cache:"no-store"});
  const response=result.response??new Response(null,{status:503});
  const data=result.data??{settings:{},revision:"",error:result.error??"Ayarlar alınamadı."};
  if(response.ok&&typeof data.revision==="string")revision=data.revision;
  return{response,data};
}

export async function updateSettings(changes:Record<string,unknown>){
  const result=await requestJson<SettingsData>("/api/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...changes,_settingsRevision:revision})});
  const response=result.response??new Response(null,{status:503});
  const data=result.data??{settings:{},revision:"",error:result.error??"Ayarlar kaydedilemedi."};
  if(response.ok&&typeof data.revision==="string")revision=data.revision;
  return{response,data};
}
