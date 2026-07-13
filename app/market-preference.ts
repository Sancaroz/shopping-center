export type StoreMarket="TR"|"GLOBAL";
const KEY="store_market";
export function getPreferredMarket():StoreMarket{if(typeof window==="undefined")return "TR";const query=new URLSearchParams(window.location.search).get("market");if(query==="GLOBAL"||query==="TR")return query;return window.localStorage.getItem(KEY)==="GLOBAL"?"GLOBAL":"TR";}
export function setPreferredMarket(market:StoreMarket){if(typeof window==="undefined")return;window.localStorage.setItem(KEY,market);document.documentElement.lang=market==="GLOBAL"?"en":"tr";}
