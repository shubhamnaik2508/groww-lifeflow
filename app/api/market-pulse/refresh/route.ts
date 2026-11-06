import {NextResponse} from 'next/server';
import {timingSafeEqual} from 'node:crypto';
import {groqConfig,groqGenerate} from '../../../../lib/ai/groq';
import {refresh} from '../../../../lib/market-pulse/refresh';
import {configuredProviders} from '../../../../lib/market-pulse/providers';
import {logRun,readLatest,storeConfig,writeLatest} from '../../../../lib/market-pulse/store';
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

/**
 * Daily refresh, called by Vercel Cron (vercel.json) after the Indian market closes.
 * On failure the previous verified brief is kept unchanged.
 */
export async function GET(req:Request){
 if(!authorised(req))return json({error:'unauthorised'},401);
 if(!storeConfig())return json({error:'store_not_configured'},503);
 const providers=configuredProviders();
 if(!providers.ok)return json({error:'provider_not_configured',detail:providers.reason},503);
 const force=new URL(req.url).searchParams.get('force')==='1';
 const previous=await readLatest<Snapshot>().catch(()=>null);
 const c=groqConfig();
 const result=await refresh({indices:providers.indices,news:providers.news,generate:c.configured?groqGenerate(c):null,model:c.configured?c.model:null,previous,force});
 const at=new Date().toISOString();
 if(result.status==='updated'){
  // Attribute the news feeds actually used (GDELT requires a citation and link).
  if(result.snapshot.news.length)for(const s of providers.newsSources)if(!result.snapshot.sources.some(x=>x.url===s.url))result.snapshot.sources.push(s);
  await writeLatest(result.snapshot);await logRun({at,status:'updated',detail:`${result.snapshot.sessionDate} · ${result.snapshot.brief.kind}`}).catch(()=>{});
  return json({status:'updated',sessionDate:result.snapshot.sessionDate,brief:result.snapshot.brief.kind,checks:result.snapshot.brief.checks.map(c=>`${c.passed?'pass':'fail'} ${c.id}`)})}
 await logRun({at,status:result.status,detail:result.status==='failed'?result.reason:result.sessionDate}).catch(()=>{});
 return json(result,result.status==='failed'?502:200);
}
