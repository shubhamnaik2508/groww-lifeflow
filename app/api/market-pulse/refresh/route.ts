import {NextResponse} from 'next/server';
import {randomUUID,timingSafeEqual} from 'node:crypto';
import {groqConfig,groqGenerate} from '../../../../lib/ai/groq';
import {refresh,type RefreshResult} from '../../../../lib/market-pulse/refresh';
import {configuredProviders} from '../../../../lib/market-pulse/providers';
import {acquireLock,logRun,nextStatus,readLatest,readStatus,releaseLock,storeConfig,writeLatest,writeStatus,type RunStatus} from '../../../../lib/market-pulse/store';
import type {Snapshot} from '../../../../lib/market-pulse/types';

export const dynamic='force-dynamic';
export const maxDuration=60;
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});

/** True only for `Authorization: Bearer <CRON_SECRET>`; Vercel Cron sends this header when CRON_SECRET is set. */
function authorised(req:Request):boolean{
 const secret=process.env.CRON_SECRET;if(!secret||secret.length<16)return false;
 const got=Buffer.from(req.headers.get('authorization')??''),want=Buffer.from(`Bearer ${secret}`);
 return got.length===want.length&&timingSafeEqual(got,want);
}

/** One structured line per run in the Vercel function logs. Status only: no inputs, AI text or secrets. */
function log(event:Record<string,unknown>){console.info(JSON.stringify({event:'market_pulse_refresh',...event}))}

/**
 * Daily refresh, called by Vercel Cron (vercel.json) after the Indian market closes.
 * Safeguards: cron-secret auth; a Redis lock so overlapping runs cannot both write; per-request timeouts inside a
 * 60-second budget; the previous verified brief is kept on any failure; run status is recorded for the page.
 */
export async function GET(req:Request){
 if(!authorised(req))return json({error:'unauthorised'},401);
 if(!storeConfig())return json({error:'store_not_configured'},503);
 const started=Date.now(),at=new Date(started).toISOString(),force=new URL(req.url).searchParams.get('force')==='1';
 const providers=configuredProviders();
 const record=async(status:RunStatus['lastStatus'],detail:string)=>{
  try{await writeStatus(nextStatus(await readStatus(),at,status,detail));await logRun({at,status,detail})}catch{/* status is best effort; the brief itself is already safe */}
 };
 const token=randomUUID();
 let lock:string|null=null;
 try{lock=await acquireLock(token)}catch{log({status:'failed',reason:'store_unavailable'});return json({error:'store_unavailable'},503)}
 if(!lock){log({status:'skipped',reason:'another_run_in_progress'});return json({status:'skipped',reason:'Another refresh is already running.'},409)}
 try{
  const previous=await readLatest<Snapshot>().catch(()=>null);
  const c=groqConfig();
  let result:RefreshResult;
  try{result=await refresh({indices:providers.indices,monthly:providers.monthly,news:providers.news,generate:c.configured?groqGenerate(c):null,model:c.configured?c.model:null,previous,force})}
  catch(e){result={status:'failed',reason:`Unexpected error: ${(e as Error)?.message?.slice(0,160)??'unknown'}`}}
  const ms=Date.now()-started;
  if(result.status==='updated'){
   // Attribute the news feeds actually used (GDELT requires a citation and link).
   if(result.snapshot.news.length)for(const s of providers.newsSources)if(!result.snapshot.sources.some(x=>x.url===s.url))result.snapshot.sources.push(s);
   await writeLatest(result.snapshot);
   const detail=`${result.snapshot.sessionDate} · ${result.snapshot.brief.kind} brief · ${result.reason}`;
   await record('updated',detail);
   log({status:'updated',sessionDate:result.snapshot.sessionDate,brief:result.snapshot.brief.kind,reason:result.reason,failedChecks:result.snapshot.brief.checks.filter(x=>!x.passed).map(x=>x.id),news:result.snapshot.news.length,ms});
   return json({status:'updated',sessionDate:result.snapshot.sessionDate,brief:result.snapshot.brief.kind,reason:result.reason,checks:result.snapshot.brief.checks.map(x=>`${x.passed?'pass':'fail'} ${x.id}`)});
  }
  if(result.status==='unchanged'){await record('unchanged',`${result.sessionDate} · ${result.reason}`);log({status:'unchanged',sessionDate:result.sessionDate,reason:result.reason,ms});return json(result)}
  await record('failed',result.reason);log({status:'failed',reason:result.reason,previousKept:previous?.sessionDate??null,ms});
  return json({...result,previousKept:previous?.sessionDate??null},502);
 }finally{await releaseLock(token).catch(()=>{})}
}
