/**
 * Market data model and deterministic verification for Market Pulse.
 * Provider-agnostic: providers return raw end-of-day observations; this module checks them
 * before anything is shown or passed to the language model. Nothing here invents a value.
 */

export type IndexId='nifty50'|'sensex';
export const INDEX_NAMES:Record<IndexId,string>={nifty50:'NIFTY 50',sensex:'BSE SENSEX'};
export type Source={name:string;url:string;attribution:string};
export type DailyClose={date:string;close:number};
export type IndexSeries={id:IndexId;closes:DailyClose[];source:Source;retrievedAt:string};
export type VerifiedSession={
 id:IndexId;name:string;sessionDate:string;close:number;previousClose:number;previousDate:string;
 change:number;changePct:number;direction:'up'|'down'|'flat';source:Source;retrievedAt:string;
};

const DATE=/^\d{4}-\d{2}-\d{2}$/;
const round=(n:number,dp:number)=>{const f=10**dp;return Math.round(n*f)/f};
export const pointChange=(close:number,prev:number)=>round(close-prev,2);
export const pctChange=(close:number,prev:number)=>round((close-prev)/prev*100,2);

/** Day of week for a YYYY-MM-DD date (0 = Sunday), independent of the server's time zone. */
export const weekday=(d:string)=>new Date(`${d}T00:00:00Z`).getUTCDay();
export const isWeekend=(d:string)=>{const w=weekday(d);return w===0||w===6};
export const validDate=(d:string)=>DATE.test(d)&&new Date(`${d}T00:00:00Z`).toISOString().slice(0,10)===d;

/** The current date and minutes past midnight in India (IST, UTC+05:30, no daylight saving). */
export function istNow(now:Date=new Date()){const t=new Date(now.getTime()+330*60000);return {date:t.toISOString().slice(0,10),minutes:t.getUTCHours()*60+t.getUTCMinutes()}}
const addDays=(d:string,n:number)=>new Date(Date.parse(`${d}T00:00:00Z`)+n*86400000).toISOString().slice(0,10);
/** NSE and BSE equity sessions close at 15:30 IST. */
export const MARKET_CLOSE_MINUTES=15*60+30;

/**
 * The most recent weekday whose session has closed. Exchange holidays are not known here, so this is
 * an upper bound: the provider's own latest date is what gets displayed.
 */
export function latestPossibleSession(now:Date=new Date()):string{
 const {date,minutes}=istNow(now);let d=minutes>=MARKET_CLOSE_MINUTES?date:addDays(date,-1);
 while(isWeekend(d))d=addDays(d,-1);return d;
}
/** Weekdays strictly after `from` up to and including `to`. */
export function weekdaysBetween(from:string,to:string):number{let n=0;for(let d=addDays(from,1);d<=to;d=addDays(d,1))if(!isWeekend(d))n++;return n}

export type Freshness={status:'current'|'possibly-stale'|'stale';weekdaysBehind:number;latestPossible:string};
/**
 * One weekday behind can be an exchange holiday, so it is shown as "possibly stale" with the actual date;
 * two or more weekdays behind is stale.
 */
export function freshness(sessionDate:string,now:Date=new Date()):Freshness{
 const latestPossible=latestPossibleSession(now);const behind=sessionDate>=latestPossible?0:weekdaysBetween(sessionDate,latestPossible);
 return {status:behind===0?'current':behind===1?'possibly-stale':'stale',weekdaysBehind:behind,latestPossible};
}

/** Checks a provider's series and derives the latest session. Returns errors instead of guessing. */
export function verifySeries(s:IndexSeries,now:Date=new Date(),reported?:{change?:number;changePct?:number}):{ok:true;session:VerifiedSession;closes:DailyClose[]}|{ok:false;errors:string[]}{
 const errors:string[]=[];
 const closes=[...s.closes].sort((a,b)=>a.date.localeCompare(b.date));
 const seen=new Set<string>();
 for(const c of closes){
  if(!validDate(c.date))errors.push(`Invalid date ${String(c.date).slice(0,20)}`);
  else if(isWeekend(c.date))errors.push(`${c.date} is a weekend, not a trading session`);
  if(!Number.isFinite(c.close)||c.close<=0)errors.push(`Invalid close on ${c.date}`);
  if(seen.has(c.date))errors.push(`Duplicate session ${c.date}`);seen.add(c.date);
 }
 if(closes.length<2)errors.push('At least two sessions are needed to compute a daily change');
 const today=istNow(now).date;
 const last=closes.at(-1);
 if(last&&last.date>today)errors.push(`Session ${last.date} is in the future`);
 if(last&&last.date===today&&istNow(now).minutes<MARKET_CLOSE_MINUTES)errors.push('Today’s session has not closed yet');
 // Implausible jumps usually mean a unit or parsing error; no Indian benchmark has moved 20% in a session since 1992.
 for(let i=1;i<closes.length;i++){const p=Math.abs(closes[i].close/closes[i-1].close-1);if(p>0.2)errors.push(`Implausible move of ${(p*100).toFixed(1)}% on ${closes[i].date}`)}
 if(errors.length)return {ok:false,errors};
 const prev=closes.at(-2)!,cur=closes.at(-1)!;
 const change=pointChange(cur.close,prev.close),changePct=pctChange(cur.close,prev.close);
 // When a provider also reports its own change, it must agree with ours (allowing documented rounding of 0.01).
 if(reported?.change!==undefined&&Math.abs(reported.change-change)>0.011)return {ok:false,errors:[`Reported change ${reported.change} does not equal close − previous close (${change})`]};
 if(reported?.changePct!==undefined&&Math.abs(reported.changePct-changePct)>0.011)return {ok:false,errors:[`Reported change ${reported.changePct}% does not match ${changePct}%`]};
 return {ok:true,closes,session:{id:s.id,name:INDEX_NAMES[s.id],sessionDate:cur.date,close:cur.close,previousClose:prev.close,previousDate:prev.date,change,changePct,direction:change>0?'up':change<0?'down':'flat',source:s.source,retrievedAt:s.retrievedAt}};
}

export const PERIODS=[{id:'1M',months:1},{id:'3M',months:3},{id:'6M',months:6},{id:'1Y',months:12}] as const;
export type PeriodId=(typeof PERIODS)[number]['id'];
const monthsBack=(d:string,m:number)=>{const x=new Date(`${d}T00:00:00Z`);x.setUTCMonth(x.getUTCMonth()-m);return x.toISOString().slice(0,10)};

/** Closes within a period ending at the latest session, or null when the series does not reach back that far. */
export function periodSlice(closes:DailyClose[],months:number):DailyClose[]|null{
 if(!closes.length)return null;const start=monthsBack(closes.at(-1)!.date,months);
 if(closes[0].date>start)return null;
 // Include the last session on or before the start date so the period change has a true baseline.
 const firstIn=closes.findIndex(c=>c.date>=start);const from=closes[firstIn]?.date===start?firstIn:Math.max(0,firstIn-1);
 return closes.slice(from);
}
export type PeriodStats={period:PeriodId;from:string;to:string;startClose:number;endClose:number;change:number;changePct:number;high:DailyClose;low:DailyClose;sessions:number;daysAbove1Pct:number;largestFall:{date:string;pct:number}|null};
export function periodStats(closes:DailyClose[],period:PeriodId):PeriodStats|null{
 const p=PERIODS.find(x=>x.id===period)!;const s=periodSlice(closes,p.months);if(!s||s.length<2)return null;
 let high=s[0],low=s[0],big=0,fall:{date:string;pct:number}|null=null;
 for(let i=1;i<s.length;i++){if(s[i].close>high.close)high=s[i];if(s[i].close<low.close)low=s[i];const d=(s[i].close/s[i-1].close-1)*100;if(Math.abs(d)>=1)big++;if(d<0&&(!fall||d<fall.pct))fall={date:s[i].date,pct:round(d,2)}}
 const a=s[0],b=s.at(-1)!;
 return {period,from:a.date,to:b.date,startClose:a.close,endClose:b.close,change:pointChange(b.close,a.close),changePct:pctChange(b.close,a.close),high,low,sessions:s.length-1,daysAbove1Pct:big,largestFall:fall};
}
