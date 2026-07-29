export type JsonRequestResult<T>={response:Response|null;data:T|null;error:string|null};

export async function requestJson<T>(input:RequestInfo|URL,init:RequestInit={},timeoutMs=20_000):Promise<JsonRequestResult<T>>{
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(input,{...init,signal:init.signal??controller.signal});
    const text=await response.text();
    let data:T|null=null;
    if(text){try{data=JSON.parse(text) as T;}catch{return{response,data:null,error:"Sunucudan geçersiz bir yanıt alındı. Lütfen tekrar deneyin."};}}
    return{response,data,error:null};
  }catch(error){
    return{response:null,data:null,error:error instanceof DOMException&&error.name==="AbortError"?"İşlem zaman aşımına uğradı. Lütfen bağlantınızı kontrol edip tekrar deneyin.":"Bağlantı kurulamadı. Lütfen internet bağlantınızı kontrol edip tekrar deneyin."};
  }finally{clearTimeout(timeout);}
}
