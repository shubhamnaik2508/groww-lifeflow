import {INDEX_NAMES,periodStats,type DailyClose,type IndexId,type PeriodId,type VerifiedSession} from './market';

/** A news item from a permitted feed. Text is the publisher's own; nothing is generated. */
export type NewsItem={id:string;title:string;publisher:string;publishedAt:string;url:string;summary:string;topic?:string};
export type Fact={id:string;label:string;value:number|string;display:string};
export type Evidence={sessionDate:string;facts:Fact[];news:NewsItem[];indices:{id:IndexId;session:VerifiedSession}[]};

const fmt=(n:number,dp=2)=>new Intl.NumberFormat('en-IN',{minimumFractionDigits:dp,maximumFractionDigits:dp}).format(n);
const signed=(n:number,dp=2)=>`${n>0?'+':n<0?'−':''}${fmt(Math.abs(n),dp)}`;
export const humanDate=(d:string)=>new Date(`${d}T00:00:00Z`).toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'});

/** Builds the only facts the model may use: verified closes, changes and deterministic history statistics. */
export function buildEvidence(indices:{session:VerifiedSession;closes:DailyClose[]}[],news:NewsItem[]):Evidence{
 const facts:Fact[]=[];
 const sessionDate=indices[0]?.session.sessionDate??'';
 for(const {session:s,closes} of indices){
  const P=s.id==='nifty50'?'NIFTY':'SENSEX';const n=INDEX_NAMES[s.id];
  facts.push(
   {id:`F_${P}_DATE`,label:`${n} session date`,value:s.sessionDate,display:humanDate(s.sessionDate)},
   {id:`F_${P}_CLOSE`,label:`${n} close`,value:s.close,display:fmt(s.close)},
   {id:`F_${P}_PREV`,label:`${n} previous close (${humanDate(s.previousDate)})`,value:s.previousClose,display:fmt(s.previousClose)},
   {id:`F_${P}_CHG`,label:`${n} point change`,value:s.change,display:`${signed(s.change)} points`},
   {id:`F_${P}_PCT`,label:`${n} percentage change`,value:s.changePct,display:`${signed(s.changePct)}%`},
  );
  for(const p of ['1M','3M','6M','1Y'] as PeriodId[]){const st=periodStats(closes,p);if(!st)continue;
   facts.push({id:`F_${P}_${p}_PCT`,label:`${n} change over ${p} (${humanDate(st.from)} to ${humanDate(st.to)})`,value:st.changePct,display:`${signed(st.changePct)}%`});
   if(p==='1Y'){facts.push(
    {id:`F_${P}_1Y_HIGH`,label:`${n} highest close in 1Y`,value:st.high.close,display:`${fmt(st.high.close)} on ${humanDate(st.high.date)}`},
    {id:`F_${P}_1Y_LOW`,label:`${n} lowest close in 1Y`,value:st.low.close,display:`${fmt(st.low.close)} on ${humanDate(st.low.date)}`},
    {id:`F_${P}_1Y_BIGDAYS`,label:`${n} sessions in 1Y with a move of 1% or more`,value:st.daysAbove1Pct,display:`${st.daysAbove1Pct} of ${st.sessions} sessions`},
    ...(st.largestFall?[{id:`F_${P}_1Y_FALL`,label:`${n} largest one-session fall in 1Y`,value:st.largestFall.pct,display:`${signed(st.largestFall.pct)}% on ${humanDate(st.largestFall.date)}`}]:[]),
   )}
  }
 }
 return {sessionDate,facts,news,indices:indices.map(i=>({id:i.session.id,session:i.session}))};
}

/** Deterministic brief used whenever AI is unavailable or its output fails the gate. States movement, never causes. */
export function deterministicBrief(e:Evidence){
 const parts=e.indices.map(({session:s})=>`${s.name} closed at ${fmt(s.close)}, ${s.direction==='flat'?'unchanged':`${s.direction==='up'?'up':'down'} ${fmt(Math.abs(s.change))} points (${signed(s.changePct)}%)`} from ${fmt(s.previousClose)}`);
 const dirs=new Set(e.indices.map(i=>i.session.direction));
 const headline=dirs.size===1?(dirs.has('up')?'Indian benchmark indices closed higher':dirs.has('down')?'Indian benchmark indices closed lower':'Indian benchmark indices closed unchanged'):'Indian benchmark indices closed in different directions';
 return {headline:`${headline} on ${humanDate(e.sessionDate)}`,summary:`${parts.join('; ')}.`,
  note:'This summary states the recorded movement only. It does not explain why the market moved; the linked news shows reported developments around the session.'};
}
