import {describe,expect,it} from 'vitest';
import {monthlyStats,oecdProvider,parseOecdCsv,verifyMonthly,type MonthlySeries} from './oecd';

// Synthetic rows in OECD's SDMX-CSV layout; values are made up for testing.
const HEAD='DATAFLOW,REF_AREA,FREQ,MEASURE,UNIT_MEASURE,ACTIVITY,ADJUSTMENT,TRANSFORMATION,TIME_HORIZ,METHODOLOGY,TIME_PERIOD,OBS_VALUE,OBS_STATUS,UNIT_MULT,DECIMALS,BASE_PER';
const row=(p:string,v:number,area='IND',freq='M',measure='SHARE')=>`X(4.0),${area},${freq},${measure},IX,_Z,_Z,_Z,_Z,N,${p},${v},A,0,2,2015`;
const months=(n:number,from=Date.UTC(2024,10,1))=>Array.from({length:n},(_,i)=>{const d=new Date(from);d.setUTCMonth(d.getUTCMonth()+i);return d.toISOString().slice(0,7)});
const series=(points:{period:string;value:number}[]):MonthlySeries=>({name:'t',points,source:{name:'OECD',url:'https://example.test',attribution:'t'},retrievedAt:'2026-11-07T00:00:00Z'});
const now=new Date('2026-11-07T00:00:00Z');

describe('OECD India share prices',()=>{
 it('parses unsorted rows, keeps only India monthly share prices, sorts and de-duplicates',()=>{
  const csv=[HEAD,row('2026-03',278.07),row('2026-01',304.69),row('2025-12',310.95),row('2026-01',304.69),row('2026-02',1,'USA'),row('2026-02',2,'IND','Q'),row('2026-02',3,'IND','M','IR'),'',row('bad',1)].join('\r\n');
  expect(parseOecdCsv(csv)).toEqual([{period:'2025-12',value:310.95},{period:'2026-01',value:304.69},{period:'2026-03',value:278.07}]);
  expect(()=>parseOecdCsv('a,b\n1,2')).toThrow(/header/);
 });
 it('verifies length, future months, staleness and implausible jumps',()=>{
  const ok=months(24).map((p,i)=>({period:p,value:250+i}));
  expect(verifyMonthly(series(ok),now).ok).toBe(true);
  expect(verifyMonthly(series(ok.slice(0,10)),now).ok).toBe(false);
  expect(verifyMonthly(series([...ok,{period:'2027-01',value:300}]),now).ok).toBe(false);
  expect(verifyMonthly(series(months(24,Date.UTC(2023,0,1)).map(p=>({period:p,value:100}))),now).ok).toBe(false);
  const jump=[...ok];jump[20]={...jump[20],value:900};expect(verifyMonthly(series(jump),now).ok).toBe(false);
 });
 it('computes month-on-month, 3- and 12-month changes and the 12-month range',()=>{
  const pts=months(13).map((p,i)=>({period:p,value:i===12?110:100+(i%3)}));
  const s=monthlyStats(pts)!;
  expect(s).toMatchObject({latest:{period:'2025-11',value:110},previous:{value:102},changePct:7.84,direction:'up',change3m:10,change12m:10,high12m:{value:110},low12m:{value:100}});
 });
 it('requests the documented SDMX endpoint as CSV',async()=>{
  let url='',accept='';
  const p=oecdProvider((async(u:string,i?:RequestInit)=>{url=u;accept=new Headers(i?.headers).get('accept')??'';return new Response([HEAD,row('2026-10',267.44)].join('\n'))}) as never);
  const s=await p.fetchSeries();
  expect(url).toMatch(/^https:\/\/sdmx\.oecd\.org\/public\/rest\/data\/OECD\.SDD\.STES,DSD_STES@DF_FINMARK,\/IND\.M\.SHARE\.{6}\?startPeriod=\d{4}-\d{2}&dimensionAtObservation=AllDimensions$/);
  expect(accept).toContain('sdmx.data+csv');expect(s.points).toEqual([{period:'2026-10',value:267.44}]);expect(s.source.attribution).toContain('CC BY 4.0');
 });
});
