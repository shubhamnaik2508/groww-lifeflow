import {NextResponse} from 'next/server';
import {freshness} from '../../../lib/market-pulse/market';
import {readLatest,readStatus,storeConfig} from '../../../lib/market-pulse/store';
import type {PulseResponse,Snapshot} from '../../../lib/market-pulse/types';

export const dynamic='force-dynamic';

/** Public, read-only: serves the last validated brief. Never calls a data provider or the AI. */
export async function GET(){
 const send=(body:PulseResponse,maxAge:number)=>NextResponse.json(body,{headers:{'Cache-Control':`public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=3600`}});
 if(!storeConfig())return send({status:'not_configured',message:'The daily AI brief is not set up on this server yet (it needs storage and a scheduled refresh), so no brief is shown.'},60);
 let snap:Snapshot|null=null;
 try{snap=await readLatest<Snapshot>()}catch{return send({status:'error',message:'The stored market brief could not be read. Please try again shortly.'},30)}
 if(!snap)return send({status:'empty',message:'The first daily refresh has not run yet. The brief appears after the next scheduled update (about 6:30 PM IST on trading days).'},60);
 const run=await readStatus().catch(()=>null);
 return send({status:'ok',snapshot:snap,freshness:freshness(snap.sessionDate),checkedAt:run?.lastSuccessAt??null,lastRunFailed:run?.lastStatus==='failed'},300);
}
