import {createHmac} from 'node:crypto';
const buckets=new Map<string,{count:number;until:number}>();
const script="local n=redis.call('INCR',KEYS[1]); if n==1 then redis.call('PEXPIRE',KEYS[1],ARGV[1]) end; return n";
/** Vercel production uses a shared store and fails closed if it is unavailable. */
export async function rateLimit(ip:string):Promise<'allow'|'limit'|'unavailable'>{
 const url=process.env.UPSTASH_REDIS_REST_URL,token=process.env.UPSTASH_REDIS_REST_TOKEN,salt=process.env.LIFEFLOW_RATE_LIMIT_SALT;
 if(url&&token&&salt&&salt.length>=32){
  try{const endpoint=new URL(url);if(endpoint.protocol!=='https:'||!endpoint.hostname.endsWith('.upstash.io'))return 'unavailable';const key='lifeflow:rate:'+createHmac('sha256',salt).update(ip).digest('hex');const response=await fetch(endpoint.toString(),{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(['EVAL',script,'1',key,'60000']),signal:AbortSignal.timeout(2500)});if(!response.ok)return 'unavailable';const body=await response.json();if(!Number.isInteger(body.result)||body.result<1)return 'unavailable';return body.result<=20?'allow':'limit'}catch{return 'unavailable'}
 }
 if(process.env.VERCEL==='1')return 'unavailable';
 const now=Date.now();for(const [key,value] of buckets)if(value.until<now)buckets.delete(key);const bucket=buckets.get(ip);if(bucket&&bucket.until>now&&bucket.count>=20)return 'limit';if(buckets.size>=10000&&!bucket)return 'limit';buckets.set(ip,bucket&&bucket.until>now?{...bucket,count:bucket.count+1}:{count:1,until:now+60000});return 'allow';
}
