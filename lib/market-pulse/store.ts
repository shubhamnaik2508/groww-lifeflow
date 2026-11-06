import 'server-only';

/**
 * Persistent store for the validated daily brief: Upstash Redis over its REST API (no new dependency).
 * Accepts Upstash's own variable names or the names set by Vercel's Upstash integration.
 * Without a store, nothing is persisted and the API says so; it never serves invented data.
 */
const KEY='lifeflow:market-pulse:latest:v1';
const HISTORY_KEY='lifeflow:market-pulse:runs:v1';

export function storeConfig(env:Record<string,string|undefined>=process.env):{url:string;token:string}|null{
 const url=env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL,token=env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN;
 if(!url||!token)return null;
 try{const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.upstash.io'))return null;return {url:u.toString().replace(/\/$/,''),token}}catch{return null}
}

async function command(args:(string|number)[]):Promise<unknown>{
 const c=storeConfig();if(!c)throw new Error('store_not_configured');
 const r=await fetch(c.url,{method:'POST',headers:{Authorization:`Bearer ${c.token}`,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(5000),cache:'no-store'});
 if(!r.ok)throw new Error(`store_http_${r.status}`);
 const body=await r.json() as {result?:unknown;error?:string};if(body.error)throw new Error('store_error');return body.result;
}

export async function readLatest<T>():Promise<T|null>{const v=await command(['GET',KEY]);return typeof v==='string'?JSON.parse(v) as T:null}
export async function writeLatest(value:unknown):Promise<void>{await command(['SET',KEY,JSON.stringify(value)])}
/** A short run log (status only, no AI text) for operational visibility. */
export async function logRun(entry:{at:string;status:string;detail?:string}):Promise<void>{await command(['LPUSH',HISTORY_KEY,JSON.stringify(entry)]);await command(['LTRIM',HISTORY_KEY,0,29])}
export async function readRuns():Promise<{at:string;status:string;detail?:string}[]>{const v=await command(['LRANGE',HISTORY_KEY,0,9]);return Array.isArray(v)?v.map(x=>JSON.parse(String(x))):[]}
