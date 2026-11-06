import {describe,expect,it} from 'vitest';
import {freshness,isWeekend,istNow,latestPossibleSession,pctChange,periodStats,pointChange,verifySeries,weekdaysBetween,type IndexSeries} from './market';

// Test fixtures below are synthetic numbers used only to exercise the arithmetic; they are not market data.
const src={name:'Test source',url:'https://example.test',attribution:'Test'};
const series=(closes:[string,number][]):IndexSeries=>({id:'nifty50',closes:closes.map(([date,close])=>({date,close})),source:src,retrievedAt:'2026-11-06T13:05:00Z'});
const ist=(d:string,hhmm:string)=>new Date(`${d}T${hhmm}:00+05:30`);

describe('change arithmetic',()=>{
 it('point change = close − previous close; percentage = change ÷ previous × 100',()=>{expect(pointChange(24000.5,24100)).toBe(-99.5);expect(pctChange(24000.5,24100)).toBe(-0.41)});
 it('rounds to two decimals',()=>{expect(pointChange(0.3,0.1)).toBe(0.2);expect(pctChange(101,100)).toBe(1)});
});

describe('trading sessions and IST',()=>{
 it('converts to IST',()=>expect(istNow(new Date('2026-11-06T10:00:00Z'))).toEqual({date:'2026-11-06',minutes:15*60+30}));
 it('detects weekends independent of server time zone',()=>{expect(isWeekend('2026-11-07')).toBe(true);expect(isWeekend('2026-11-08')).toBe(true);expect(isWeekend('2026-11-06')).toBe(false)});
 it('uses today only after 15:30 IST',()=>{expect(latestPossibleSession(ist('2026-11-06','15:29'))).toBe('2026-11-05');expect(latestPossibleSession(ist('2026-11-06','15:30'))).toBe('2026-11-06')});
 it('on a weekend, the latest session is Friday',()=>{expect(latestPossibleSession(ist('2026-11-08','12:00'))).toBe('2026-11-06');expect(latestPossibleSession(ist('2026-11-09','09:00'))).toBe('2026-11-06')});
 it('counts weekdays, not calendar days',()=>expect(weekdaysBetween('2026-11-06','2026-11-10')).toBe(2));
 it('freshness: current, possibly stale (could be a holiday), stale',()=>{
  expect(freshness('2026-11-06',ist('2026-11-08','10:00')).status).toBe('current');
  expect(freshness('2026-11-05',ist('2026-11-06','19:00')).status).toBe('possibly-stale');
  expect(freshness('2026-11-03',ist('2026-11-06','19:00'))).toMatchObject({status:'stale',weekdaysBehind:3});
 });
});

describe('series verification',()=>{
 const now=ist('2026-11-08','10:00');
 it('derives the latest session from the last two closes, in date order',()=>{
  const r=verifySeries(series([['2026-11-06',24000],['2026-11-05',24200]]),now);
  expect(r.ok&&r.session).toMatchObject({sessionDate:'2026-11-06',previousDate:'2026-11-05',close:24000,previousClose:24200,change:-200,changePct:-0.83,direction:'down',name:'NIFTY 50'});
 });
 it.each([
  [[['2026-11-07',1],['2026-11-06',1]],'weekend'],
  [[['2026-11-05',1],['2026-11-06',-5]],'Invalid close'],
  [[['2026-11-05',1],['2026-11-05',2]],'Duplicate'],
  [[['2026-11-06',1]],'At least two'],
  [[['2026-11-05',24000],['2026-11-06',31000]],'Implausible'],
  [[['2026-02-30',1],['2026-11-06',1]],'Invalid date'],
 ])('rejects %j (%s)',(c,msg)=>{const r=verifySeries(series(c as [string,number][]),now);expect(r.ok).toBe(false);if(!r.ok)expect(r.errors.join(' ')).toContain(msg)});
 it('rejects a future session and an unclosed session today',()=>{
  expect(verifySeries(series([['2026-11-05',1],['2026-11-06',1]]),ist('2026-11-05','18:00')).ok).toBe(false);
  expect(verifySeries(series([['2026-11-05',1],['2026-11-06',1]]),ist('2026-11-06','14:00')).ok).toBe(false);
 });
 it('rejects a provider-reported change that disagrees with the closes',()=>{
  const s=series([['2026-11-05',24200],['2026-11-06',24000]]);
  expect(verifySeries(s,now,{change:-200,changePct:-0.83}).ok).toBe(true);
  expect(verifySeries(s,now,{change:-210}).ok).toBe(false);
  expect(verifySeries(s,now,{changePct:-0.9}).ok).toBe(false);
 });
});

describe('period statistics',()=>{
 const closes=[['2025-11-06',100],['2026-05-06',110],['2026-08-06',90],['2026-10-06',95],['2026-10-07',93],['2026-11-06',99]].map(([date,close])=>({date:date as string,close:close as number}));
 it('computes change from the session on or before the period start',()=>{
  expect(periodStats(closes,'1M')).toMatchObject({from:'2026-10-06',to:'2026-11-06',change:4,changePct:4.21,sessions:2});
  expect(periodStats(closes,'1Y')).toMatchObject({from:'2025-11-06',startClose:100,endClose:99,changePct:-1,high:{date:'2026-05-06',close:110},low:{date:'2026-08-06',close:90}});
 });
 it('reports the largest one-day fall and days moving 1% or more',()=>expect(periodStats(closes,'1M')).toMatchObject({largestFall:{date:'2026-10-07',pct:-2.11},daysAbove1Pct:2}));
 it('returns null when history does not reach back',()=>expect(periodStats(closes.slice(3),'6M')).toBeNull());
});
