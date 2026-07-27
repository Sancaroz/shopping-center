type SettingsData={settings:Record<string,string>;revision:string;error?:string};

let revision="";

export async function fetchSettings(){
  const response=await fetch("/api/settings",{cache:"no-store"});
  const data=await response.json() as SettingsData;
  if(response.ok&&typeof data.revision==="string")revision=data.revision;
  return{response,data};
}

export async function updateSettings(changes:Record<string,unknown>){
  const response=await fetch("/api/settings",{method:"PUT",headers:{"Content-Type":"application/json"},body:JSON.stringify({...changes,_settingsRevision:revision})});
  const data=await response.json() as SettingsData;
  if(response.ok&&typeof data.revision==="string")revision=data.revision;
  return{response,data};
}
