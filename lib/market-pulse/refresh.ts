import {latestPossibleSession,verifySeries,type DailyClose,type IndexId,type IndexSeries,type Source,type VerifiedSession} from './market';
import {buildEvidence,type NewsItem} from './evidence';
import {analyse} from './analyst';
import type {Generate} from '../ai/pipeline';
import type {Snapshot} from './types';
import {verifyMonthly,type MonthlyProvider,type MonthlySeries} from './oecd';

/** A provider returns end-of-day closes for one index from a permitted source. */
export type IndexProvider={name:string;fetchSeries:(id:IndexId)=>Promise<IndexSeries>};
export type NewsProvider={name:string;fetchNews:(sessionDate:string)=>Promise<NewsItem[]>};
export type RefreshDeps={indices:IndexProvider|null;monthly?:MonthlyProvider|null;news:NewsProvider|null;generate:Generate|null;model:string|null;now?:Date;previous?:Snapshot|null;force?:boolean;newsTimeoutMs?:number};
export type RefreshResult=
 |{status:'updated';snapshot:Snapshot;reason:'new-session'|'ai-upgrade'|'forced'}
 |{status:'unchanged';sessionDate:string;reason:string}
 |{status:'failed';reason:string};

/** News is optional evidence: it gets a hard time budget so the whole run stays inside the function limit. */
export const NEWS_BUDGET_MS=15000;
const withTimeout=<T,>(p:Promise<T>,ms:number,fallback:T)=>Promise.race([p.catch(()=>fallback),new Promise<T>(r=>setTimeout(()=>r(fallback),ms))]);

/**
 * Daily pipeline: fetch → verify numbers and dates → fetch news → build evidence → Groq → gate → snapshot.
 *
 * Rules that protect the stored brief:
 * - Any fetch or verification failure returns `failed`; the caller keeps the previous brief.
 * - A source that returns an older session than the stored one never overwrites it.
 * - The same session is not regenerated (weekends, holidays, repeat runs), except to retry AI when the stored
 *   brief fell back to verified facts; a retry that fails again keeps the stored brief.
 * - A new session is always stored once its numbers are verified, even if AI fails (the deterministic brief
 *   states the new verified figures; the next run retries AI).
 */
export async function refresh(d:RefreshDeps):Promise<RefreshResult>{
 const now=d.now??new Date();
 if(!d.indices)return refreshOpen(d,now);
 const ids:IndexId[]=['nifty50','sensex'];
 // Both indices in parallel keeps the run well inside the 60-second function limit.
 const fetched=await Promise.allSettled(ids.map(id=>d.indices!.fetchSeries(id)));
 const verified:{session:VerifiedSession;closes:DailyClose[]}[]=[];const sources:Source[]=[];
 for(let i=0;i<ids.length;i++){
  const f=fetched[i];
  if(f.status==='rejected')return {status:'failed',reason:`${ids[i]}: ${(f.reason as Error)?.message?.slice(0,160)??'fetch failed'}`};
  const v=verifySeries(f.value,now);
  if(!v.ok)return {status:'failed',reason:`${ids[i]} failed verification: ${v.errors.slice(0,3).join('; ')}`};
  verified.push({session:v.session,closes:v.closes});
  if(!sources.some(x=>x.url===f.value.source.url))sources.push(f.value.source);
 }
 const sessionDate=verified.map(v=>v.session.sessionDate).sort().at(-1)!;
 const prev=d.previous??null;
 if(prev&&sessionDate<prev.sessionDate)return {status:'unchanged',sessionDate:prev.sessionDate,reason:`The source returned an older session (${sessionDate}); the stored ${prev.sessionDate} brief is kept.`};
 const same=!!prev&&prev.sessionDate===sessionDate&&prev.indices.length===verified.length&&prev.indices.every((p,i)=>p.session.id===verified[i].session.id&&p.session.close===verified[i].session.close&&p.session.previousClose===verified[i].session.previousClose);
 const retryAi=same&&prev!.brief.kind==='deterministic'&&!!d.generate;
 if(same&&!d.force&&!retryAi)return {status:'unchanged',sessionDate,reason:'No new trading session since the stored brief (weekend, holiday or repeat run).'};
 const news=d.news?(await withTimeout(d.news.fetchNews(sessionDate),d.newsTimeoutMs??NEWS_BUDGET_MS,[] as NewsItem[])).slice(0,8):[];
 const evidence=buildEvidence(verified,news);
 const brief=await analyse(evidence,d.generate,d.model,now);
 // For the same session, a facts-only brief never replaces an AI brief, and an unforced AI retry that fails keeps
 // what is stored. (A forced run may refresh a facts-only brief, e.g. to pick up newer news.)
 if(same&&brief.kind!=='ai'&&(prev!.brief.kind==='ai'||!d.force))return {status:'unchanged',sessionDate,reason:`AI regeneration did not pass (${brief.fallbackReason??'unknown'}); the stored brief is kept.`};
 const notes:string[]=[];
 if(new Set(verified.map(v=>v.session.sessionDate)).size>1)notes.push('NIFTY 50 and SENSEX report different latest session dates; each index shows its own date.');
 return {status:'updated',reason:!same?'new-session':retryAi&&!d.force?'ai-upgrade':'forced',snapshot:{version:1,sessionDate,updatedAt:now.toISOString(),indices:verified,news,brief,sources,notes,mode:'licensed'}};
}

/**
 * Open-data mode (no licensed index source): OECD monthly India share price index + permitted news → AI → gate.
 * The brief date is the latest weekday session (exchange holidays are not verified in this mode).
 * Same protections as the licensed path: failures keep the stored brief; the same date is not regenerated except to
 * retry AI; a facts-only brief never replaces an AI brief.
 */
async function refreshOpen(d:RefreshDeps,now:Date):Promise<RefreshResult>{
 const sessionDate=latestPossibleSession(now);
 const prev=d.previous??null;
 if(prev&&sessionDate<prev.sessionDate)return {status:'unchanged',sessionDate:prev.sessionDate,reason:'A newer brief is already stored.'};
 const same=!!prev&&prev.mode==='open'&&prev.sessionDate===sessionDate;
 const retryAi=same&&prev!.brief.kind==='deterministic'&&!!d.generate;
 if(same&&!d.force&&!retryAi)return {status:'unchanged',sessionDate,reason:'The brief for this session date is already stored (weekend, holiday or repeat run).'};
 let monthly:MonthlySeries|null=null;let monthlyError='';
 if(d.monthly){try{const m=verifyMonthly(await d.monthly.fetchSeries(),now);if(m.ok)monthly=m.series;else monthlyError=m.errors.slice(0,2).join('; ')}catch(e){monthlyError=(e as Error)?.message?.slice(0,120)??'fetch failed'}}
 const news=d.news?(await withTimeout(d.news.fetchNews(sessionDate),d.newsTimeoutMs??NEWS_BUDGET_MS,[] as NewsItem[])).slice(0,8):[];
 if(!monthly&&!news.length)return {status:'failed',reason:`No verified open data or news was available${monthlyError?` (OECD: ${monthlyError})`:''}.`};
 const evidence=buildEvidence([],news,{monthly,briefDate:sessionDate});
 const brief=await analyse(evidence,d.generate,d.model,now);
 if(same&&brief.kind!=='ai'&&(prev!.brief.kind==='ai'||!d.force))return {status:'unchanged',sessionDate,reason:`AI regeneration did not pass (${brief.fallbackReason??'unknown'}); the stored brief is kept.`};
 const notes=monthlyError?[`The OECD monthly series could not be verified (${monthlyError}).`]:[];
 return {status:'updated',reason:!same?'new-session':retryAi&&!d.force?'ai-upgrade':'forced',snapshot:{version:1,mode:'open',sessionDate,updatedAt:now.toISOString(),indices:[],
  monthly:monthly?{name:monthly.name,points:monthly.points,source:monthly.source}:null,news,brief,sources:monthly?[monthly.source]:[],notes}};
}
