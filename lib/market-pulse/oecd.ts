import type {Source} from './market';

/**
 * OECD Main Economic Indicators: India share prices (monthly index, 2015 = 100), from the OECD SDMX REST API.
 * Free, no key, CC BY 4.0 with attribution (OECD open-by-default policy, 1 July 2024).
 * This is NOT the NIFTY 50 or SENSEX level and NOT a daily close. It is labelled that way everywhere.
 */
export type MonthlyPoint={period:string;value:number}; // period: YYYY-MM
export type MonthlySeries={name:string;points:MonthlyPoint[];source:Source;retrievedAt:string};
export const OECD_SERIES_NAME='India share price index (OECD, monthly, 2015 = 100)';
export const oecdSource=(year:number):Source=>({name:'OECD Data Explorer',url:'https://data-explorer.oecd.org/',
 attribution:`OECD (${year}), Main Economic Indicators: share prices, India, monthly index 2015 = 100. CC BY 4.0.`});

const PERIOD=/^\d{4}-(0[1-9]|1[0-2])$/;
/** Parses OECD SDMX-CSV: keeps India, monthly, share-price rows; returns points sorted oldest first, de-duplicated. */
export function parseOecdCsv(csv:string):MonthlyPoint[]{
 const lines=csv.replace(/^﻿/,'').split(/\r?\n/).filter(Boolean);if(lines.length<2)return [];
 const head=lines[0].split(',');const col=(n:string)=>head.indexOf(n);
 const [area,freq,measure,period,value]=['REF_AREA','FREQ','MEASURE','TIME_PERIOD','OBS_VALUE'].map(col);
 if([period,value].some(i=>i<0))throw new Error('Unexpected OECD CSV header');
 const byPeriod=new Map<string,number>();
 for(const line of lines.slice(1)){const c=line.split(',');
  if(area>=0&&c[area]!=='IND')continue;if(freq>=0&&c[freq]!=='M')continue;if(measure>=0&&c[measure]!=='SHARE')continue;
  const p=c[period],v=Number(c[value]);if(PERIOD.test(p)&&Number.isFinite(v))byPeriod.set(p,v)}
 return [...byPeriod].map(([p,v])=>({period:p,value:v})).sort((a,b)=>a.period.localeCompare(b.period));
}

const monthIndex=(p:string)=>{const [y,m]=p.split('-').map(Number);return y*12+m-1};
/** Checks the series before it is shown or passed to the model. Returns errors instead of guessing. */
export function verifyMonthly(s:MonthlySeries,now:Date=new Date()):{ok:true;series:MonthlySeries}|{ok:false;errors:string[]}{
 const errors:string[]=[];const pts=s.points;
 if(pts.length<13)errors.push('Fewer than 13 monthly observations');
 const nowMonth=now.getUTCFullYear()*12+now.getUTCMonth();
 for(let i=0;i<pts.length;i++){const p=pts[i];
  if(!PERIOD.test(p.period))errors.push(`Invalid period ${String(p.period).slice(0,10)}`);
  if(!(p.value>0))errors.push(`Invalid value for ${p.period}`);
  if(monthIndex(p.period)>nowMonth)errors.push(`${p.period} is in the future`);
  if(i&&Math.abs(p.value/pts[i-1].value-1)>0.4)errors.push(`Implausible monthly move at ${p.period}`);
 }
 const last=pts.at(-1);if(last&&nowMonth-monthIndex(last.period)>4)errors.push(`Latest observation ${last.period} is more than four months old`);
 return errors.length?{ok:false,errors}:{ok:true,series:s};
}

const round=(n:number,dp=2)=>{const f=10**dp;return Math.round(n*f)/f};
export const monthName=(p:string)=>new Date(`${p}-01T00:00:00Z`).toLocaleDateString('en-IN',{month:'long',year:'numeric',timeZone:'UTC'});
export type MonthlyStats={latest:MonthlyPoint;previous:MonthlyPoint;changePct:number;direction:'up'|'down'|'flat';
 change3m:number|null;change12m:number|null;high12m:MonthlyPoint|null;low12m:MonthlyPoint|null};
export function monthlyStats(points:MonthlyPoint[]):MonthlyStats|null{
 if(points.length<2)return null;const latest=points.at(-1)!,previous=points.at(-2)!;
 const back=(n:number)=>points.find(p=>monthIndex(p.period)===monthIndex(latest.period)-n)??null;
 const pct=(a:MonthlyPoint|null)=>a?round((latest.value/a.value-1)*100):null;
 const year=points.filter(p=>monthIndex(latest.period)-monthIndex(p.period)<12);
 const changePct=round((latest.value/previous.value-1)*100);
 return {latest,previous,changePct,direction:changePct>0?'up':changePct<0?'down':'flat',change3m:pct(back(3)),change12m:pct(back(12)),
  high12m:year.length>=12?year.reduce((a,b)=>b.value>a.value?b:a):null,low12m:year.length>=12?year.reduce((a,b)=>b.value<a.value?b:a):null};
}

export type MonthlyProvider={name:string;fetchSeries:()=>Promise<MonthlySeries>};
type Getter=(url:string,init?:RequestInit)=>Promise<Response>;
/** OECD SDMX REST, India share prices. Requests six years so the 12-month statistics and the chart have context. */
export function oecdProvider(fetchImpl:Getter=(u,i)=>fetch(u,i)):MonthlyProvider{
 return {name:'OECD',fetchSeries:async()=>{
  const start=new Date();start.setUTCFullYear(start.getUTCFullYear()-6);
  const url=`https://sdmx.oecd.org/public/rest/data/OECD.SDD.STES,DSD_STES@DF_FINMARK,/IND.M.SHARE......?startPeriod=${start.toISOString().slice(0,7)}&dimensionAtObservation=AllDimensions`;
  const r=await fetchImpl(url,{headers:{Accept:'application/vnd.sdmx.data+csv; charset=utf-8','User-Agent':'GrowwLifeFlow-MarketPulse/1.0 (educational prototype)'},signal:AbortSignal.timeout(12000),cache:'no-store'});
  if(!r.ok)throw new Error(`OECD HTTP ${r.status}`);
  const now=new Date();
  return {name:OECD_SERIES_NAME,points:parseOecdCsv(await r.text()),source:oecdSource(now.getUTCFullYear()),retrievedAt:now.toISOString()};
 }};
}
