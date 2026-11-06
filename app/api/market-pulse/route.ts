import {NextResponse} from 'next/server';
import {freshness} from '../../../lib/market-pulse/market';
import {readLatest,readStatus,storeConfig} from '../../../lib/market-pulse/store';
import {configuredProviders} from '../../../lib/market-pulse/providers';
import type {PulseResponse,Snapshot} from '../../../lib/market-pulse/types';

export const dynamic='force-dynamic';

/** Public, read-only: serves the last validated brief. Never calls a data provider or the AI. */
export async function GET(){
 const send=(body:PulseResponse,maxAge:number)=>NextResponse.json(body,{headers:{'Cache-Control':`public, s-maxage=${maxAge}, stale-while-revalidate=3600`}});
 const licensed=configuredProviders().ok;
 const blocker='Index data for NIFTY 50 and SENSEX needs a source licensed for public display. Until that permission is in place, Market Pulse shows no index figures rather than unlicensed or estimated ones.';
 if(!storeConfig())return send({status:'not_configured',message:licensed?'Market Pulse storage is not configured on this server, so there is no verified daily brief to show.':blocker},60);
 let snap:Snapshot|null=null;
 try{snap=await readLatest<Snapshot>()}catch{return send({status:'error',message:'The stored market brief could not be read. Please try again shortly.'},30)}
 if(!snap&&!licensed)return send({status:'not_configured',message:blocker},60);
 if(!snap)return send({status:'empty',message:'The first daily refresh has not run yet. The brief appears after the next scheduled update (about 6:30 PM IST on trading days).'},60);
 const run=await readStatus().catch(()=>null);
 return send({status:'ok',snapshot:snap,freshness:freshness(snap.sessionDate),checkedAt:run?.lastSuccessAt??null,lastRunFailed:run?.lastStatus==='failed'},300);
}
