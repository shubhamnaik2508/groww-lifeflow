import 'server-only';
import {createHmac,randomUUID} from 'node:crypto';

/**
 * Public-demo protection for every AI request (Gemini and Groq), backed by a shared Redis store (Upstash REST).
 * Fails closed: if the store is missing, misconfigured or unreachable on Vercel, AI requests are refused.
 * Each check is a single atomic Redis command; counters count attempts, so hammering only uses up the caller's own allowance.
 */
export type Provider='gemini'|'groq';
export const LIMITS={
 visitorPerMinute:6,
 visitorPerHour:30,
 visitorPerDay:60,
 /** Requests per provider per day across all visitors (backstop; Gemini spend is capped separately). */
 globalPerDay:{gemini:400,groq:500} as Record<Provider,number>,
 /** AI requests running at the same time across all visitors. */
 globalConcurrent:6,
 /** Seconds a visitor's in-flight lock and a global slot live if a request never releases them. */
 inflightTtlMs:45000,
 /** Estimated Gemini spend per day across all visitors, in micro-USD (from GEMINI_DAILY_BUDGET_INR, default ₹100). */
 geminiDailyBudgetMicros:0,
};
export const KILL_SWITCH_KEY='lifeflow:ai:disabled';

/** Rupee-to-dollar rate and Indian GST used to turn a rupee budget into the dollar cost Gemini reports. Conservative. */
export const INR_PER_USD=88,GST=0.18;
export const DEFAULT_GEMINI_DAILY_BUDGET_INR=100;
/** Daily Gemini spend ceiling in micro-USD. Set GEMINI_DAILY_BUDGET_INR in Vercel (₹1–₹1,000, GST included) to change it. */
export function geminiDailyBudgetMicros(env:Record<string,string|undefined>=process.env){
 const raw=Number(env.GEMINI_DAILY_BUDGET_INR);
 const inr=Number.isFinite(raw)&&raw>=1&&raw<=1000?raw:DEFAULT_GEMINI_DAILY_BUDGET_INR;
 return Math.floor(inr/(1+GST)/INR_PER_USD*1e6);
}
LIMITS.geminiDailyBudgetMicros=geminiDailyBudgetMicros({});

type Cmd=(string|number)[];
export interface RedisLike{pipeline(cmds:Cmd[]):Promise<unknown[]>}

/** Upstash REST client. Throws on any transport, HTTP or per-command error so callers fail closed. */
export class UpstashRest implements RedisLike{
 constructor(private url:string,private token:string){}
 async pipeline(cmds:Cmd[]){
  const res=await fetch(`${this.url.replace(/\/$/,'')}/pipeline`,{method:'POST',headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},body:JSON.stringify(cmds),signal:AbortSignal.timeout(2500),cache:'no-store'});
  if(!res.ok)throw new Error(`store_http_${res.status}`);
  const body=await res.json() as {result?:unknown;error?:string}[];
  if(!Array.isArray(body)||body.length!==cmds.length)throw new Error('store_bad_response');
  return body.map(r=>{if(r.error)throw new Error('store_command_error');return r.result});
 }
}

/** In-process store for local development only (never used on Vercel). Implements just the commands the guard uses. */
export class MemoryStore implements RedisLike{
 private kv=new Map<string,{v:string;until:number}>();private z=new Map<string,Map<string,number>>();
 constructor(private now=()=>Date.now()){}
 private live(k:string){const e=this.kv.get(k);if(e&&e.until&&e.until<=this.now()){this.kv.delete(k);return undefined}return e}
 async pipeline(cmds:Cmd[]){return cmds.map(c=>this.run(c.map(String)))}
 private run([op,k,...a]:string[]):unknown{
  switch(op){
   case 'GET':return this.live(k)?.v??null;
   case 'SET':{const nx=a.includes('NX'),px=a.indexOf('PX');if(nx&&this.live(k))return null;this.kv.set(k,{v:a[0],until:px>=0?this.now()+Number(a[px+1]):0});return 'OK'}
   case 'INCR':case 'INCRBY':case 'DECRBY':{const e=this.live(k);const by=op==='INCR'?1:op==='INCRBY'?Number(a[0]):-Number(a[0]);const n=Number(e?.v??0)+by;this.kv.set(k,{v:String(n),until:e?.until??0});return n}
   case 'DEL':return this.kv.delete(k)?1:0;
   case 'ZADD':{const s=this.z.get(k)??new Map();s.set(a[1],Number(a[0]));this.z.set(k,s);return 1}
   case 'ZREMRANGEBYSCORE':{const s=this.z.get(k);let n=0;if(s)for(const [m,sc] of s)if(sc<=Number(a[1])){s.delete(m);n++}return n}
   case 'ZCARD':return this.z.get(k)?.size??0;
   case 'ZREM':return this.z.get(k)?.delete(a[0])?1:0;
   case 'PEXPIRE':{const e=this.kv.get(k);if(e)e.until=this.now()+Number(a[0]);return e?1:0}
   default:throw new Error('unsupported '+op);
  }
 }
}
const memory=new MemoryStore();

/** Shared store from env (Vercel's Upstash integration sets KV_REST_API_*). null = not configured. */
export function storeFromEnv(env:Record<string,string|undefined>=process.env):{store:RedisLike;secret:string}|null{
 const url=env.UPSTASH_REDIS_REST_URL||env.KV_REST_API_URL,token=env.UPSTASH_REDIS_REST_TOKEN||env.KV_REST_API_TOKEN;
 if(url&&token){
  try{const u=new URL(url);if(u.protocol!=='https:'||!u.hostname.endsWith('.upstash.io'))return null}catch{return null}
  // Visitor addresses are stored only as keyed digests. The key is a dedicated salt, or derived from the store token.
  const salt=env.LIFEFLOW_RATE_LIMIT_SALT&&env.LIFEFLOW_RATE_LIMIT_SALT.length>=32?env.LIFEFLOW_RATE_LIMIT_SALT:createHmac('sha256',token).update('lifeflow-visitor-digest-v1').digest('hex');
  return {store:new UpstashRest(url,token),secret:salt};
 }
 if(env.VERCEL==='1')return null;
 return {store:memory,secret:'local-development-only'};
}
export function protectionMode(env:Record<string,string|undefined>=process.env):'shared'|'local'|'unavailable'{
 const s=storeFromEnv(env);return !s?'unavailable':s.store instanceof MemoryStore?'local':'shared';
}

/** IST calendar day, so the daily allowance resets at midnight in India. */
export const istDay=(now:number)=>new Date(now+5.5*3600e3).toISOString().slice(0,10);

export type Refusal={ok:false;status:number;error:string;message:string};
export type Admission={ok:true;release:()=>Promise<void>;store:RedisLike;day:string};
const refuse=(status:number,error:string,message:string):Refusal=>({ok:false,status,error,message});
export const REFUSALS={
 unavailable:refuse(503,'protection_unavailable','The AI service is temporarily unavailable on this server. Your scenario calculations still work.'),
 disabled:refuse(503,'ai_paused','Live AI answers are paused on this demo right now. Your scenario calculations and the rule-based guide still work.'),
 busy:refuse(429,'busy','Your previous question is still being answered. Please wait for it to finish.'),
 minute:refuse(429,'rate_limited','Too many questions in a minute. Please wait a moment and try again.'),
 hour:refuse(429,'rate_limited_hour','You have reached this demo’s hourly limit for AI questions. Please try again later.'),
 day:refuse(429,'rate_limited_day','You have reached this demo’s daily limit for AI questions. It resets at midnight IST.'),
 globalDay:refuse(429,'demo_allowance_exhausted','The shared daily allowance for this AI provider is used up. It resets at midnight IST. You can try the other provider.'),
 globalBusy:refuse(429,'demo_busy','The demo is answering several questions right now. Please try again in a few seconds.'),
 budget:refuse(429,'demo_budget_exhausted','Today’s spending limit for Google Gemini on this demo is reached. It resets at midnight IST. You can try Groq.'),
};

/** Admits or refuses one AI request. Call `release()` when the request finishes. */
export async function admit(args:{visitor:string;provider:Provider;env?:Record<string,string|undefined>;now?:number;source?:{store:RedisLike;secret:string}|null}):Promise<Admission|Refusal>{
 const env=args.env??process.env;
 if(env.AI_DEMO_ENABLED!=='true')return REFUSALS.disabled;
 const source=args.source!==undefined?args.source:storeFromEnv(env);
 if(!source)return REFUSALS.unavailable;
 const {store,secret}=source;const now=args.now??Date.now();const day=istDay(now);
 const v=createHmac('sha256',secret).update(args.visitor).digest('hex').slice(0,32);
 const token=randomUUID();
 const k={m:`lifeflow:ai:v:${v}:m:${Math.floor(now/60000)}`,h:`lifeflow:ai:v:${v}:h:${Math.floor(now/3600000)}`,d:`lifeflow:ai:v:${v}:d:${day}`,g:`lifeflow:ai:g:${args.provider}:${day}`,busy:`lifeflow:ai:busy:${v}`,inflight:'lifeflow:ai:inflight'};
 const DAY_MS=2*86400e3;
 let r:unknown[];
 try{
  r=await store.pipeline([
   ['GET',KILL_SWITCH_KEY],
   ['SET',k.m,0,'NX','PX',120000],['INCR',k.m],
   ['SET',k.h,0,'NX','PX',2*3600000],['INCR',k.h],
   ['SET',k.d,0,'NX','PX',DAY_MS],['INCR',k.d],
   ['SET',k.g,0,'NX','PX',DAY_MS],['INCR',k.g],
   ['SET',k.busy,token,'NX','PX',LIMITS.inflightTtlMs],
   ['ZREMRANGEBYSCORE',k.inflight,'-inf',now],['ZADD',k.inflight,now+LIMITS.inflightTtlMs,token],['ZCARD',k.inflight],
  ]);
 }catch{return REFUSALS.unavailable}
 const n=(i:number)=>Number(r[i]);
 const gotBusy=r[9]==='OK';
 const cleanup=async()=>{try{await store.pipeline([...(gotBusy?[['DEL',k.busy] as Cmd]:[]),['ZREM',k.inflight,token]])}catch{/* expires on its own */}};
 if([2,4,6,8,12].some(i=>!Number.isFinite(n(i)))){await cleanup();return REFUSALS.unavailable}
 const reason=r[0]?'disabled':n(8)>LIMITS.globalPerDay[args.provider]?'globalDay':!gotBusy?'busy':n(2)>LIMITS.visitorPerMinute?'minute':n(4)>LIMITS.visitorPerHour?'hour':n(6)>LIMITS.visitorPerDay?'day':n(12)>LIMITS.globalConcurrent?'globalBusy':null;
 if(reason){await cleanup();return REFUSALS[reason as keyof typeof REFUSALS]}
 return {ok:true,release:cleanup,store,day};
}

/** Daily Gemini spend ceiling (estimated from token usage): reserve the worst case before a call, settle with the actual cost after. */
export function geminiSpend(store:RedisLike,day:string,reserveMicros:number,costOf:(usage:{input:number;output:number})=>number,cap=LIMITS.geminiDailyBudgetMicros){
 const key=`lifeflow:ai:spend:gemini:${day}`;let held=0;
 return {
  reserve:async()=>{
   let total:number;
   try{const r=await store.pipeline([['SET',key,0,'NX','PX',2*86400e3],['INCRBY',key,reserveMicros]]);total=Number(r[1])}
   catch{throw new SpendRefused('unavailable')}
   if(!Number.isFinite(total))throw new SpendRefused('unavailable');
   if(total>cap){await store.pipeline([['DECRBY',key,reserveMicros]]).catch(()=>{});throw new SpendRefused('budget')}
   held=reserveMicros;
  },
  settle:async(usage:{input:number;output:number}|null)=>{
   if(!held)return;
   // Without usage data, keep the full reservation (conservative).
   const actual=usage?costOf(usage):held;const delta=actual-held;held=0;
   if(delta!==0)await store.pipeline([['INCRBY',key,delta]]);
  },
 };
}
export class SpendRefused extends Error{constructor(readonly reason:'budget'|'unavailable'){super(reason)}}
