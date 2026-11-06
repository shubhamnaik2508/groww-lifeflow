import {verifySeries,type DailyClose,type IndexId,type IndexSeries,type Source,type VerifiedSession} from './market';
import {buildEvidence,type NewsItem} from './evidence';
import {analyse} from './analyst';
import type {Generate} from '../ai/pipeline';
import type {Snapshot} from './types';

/** A provider returns end-of-day closes for one index from a permitted source. */
export type IndexProvider={name:string;fetchSeries:(id:IndexId)=>Promise<IndexSeries>};
export type NewsProvider={name:string;fetchNews:(sessionDate:string)=>Promise<NewsItem[]>};
export type RefreshDeps={indices:IndexProvider;news:NewsProvider|null;generate:Generate|null;model:string|null;now?:Date;previous?:Snapshot|null;force?:boolean};
export type RefreshResult={status:'updated';snapshot:Snapshot}|{status:'unchanged';sessionDate:string}|{status:'failed';reason:string};

/**
 * Daily pipeline: fetch → verify numbers and dates → fetch news → build evidence → Groq → gate → snapshot.
 * Any failure before a verified snapshot exists returns `failed`, and the caller keeps the previous brief.
 */
export async function refresh(d:RefreshDeps):Promise<RefreshResult>{
 const now=d.now??new Date();
 const verified:{session:VerifiedSession;closes:DailyClose[]}[]=[];const sources:Source[]=[];
 for(const id of ['nifty50','sensex'] as IndexId[]){
  let s:IndexSeries;
  try{s=await d.indices.fetchSeries(id)}catch(e){return {status:'failed',reason:`${id}: ${(e as Error).message?.slice(0,160)??'fetch failed'}`}}
  const v=verifySeries(s,now);
  if(!v.ok)return {status:'failed',reason:`${id} failed verification: ${v.errors.slice(0,3).join('; ')}`};
  verified.push({session:v.session,closes:v.closes});
  if(!sources.some(x=>x.url===s.source.url))sources.push(s.source);
 }
 const sessionDate=verified.map(v=>v.session.sessionDate).sort().at(-1)!;
 // Weekends, holidays and repeat runs: keep the stored brief rather than regenerating it.
 if(!d.force&&d.previous&&d.previous.sessionDate===sessionDate&&d.previous.indices.every((p,i)=>p.session.close===verified[i]?.session.close))return {status:'unchanged',sessionDate};
 let news:NewsItem[]=[];
 if(d.news){try{news=(await d.news.fetchNews(sessionDate)).slice(0,8)}catch{news=[]}}
 const evidence=buildEvidence(verified,news);
 const brief=await analyse(evidence,d.generate,d.model,now);
 const notes:string[]=[];
 if(new Set(verified.map(v=>v.session.sessionDate)).size>1)notes.push('NIFTY 50 and SENSEX report different latest session dates; each index shows its own date.');
 return {status:'updated',snapshot:{version:1,sessionDate,updatedAt:now.toISOString(),indices:verified,news,brief,sources,notes}};
}
