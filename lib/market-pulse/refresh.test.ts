import {describe,expect,it} from 'vitest';
import {refresh,type IndexProvider} from './refresh';
import type {IndexId,IndexSeries} from './market';

// Synthetic test series (not market data) to exercise the pipeline's control flow.
const now=new Date('2026-11-06T13:05:00Z'); // 18:35 IST on a Friday
const src=(id:IndexId)=>({name:`Test ${id}`,url:`https://example.test/${id}`,attribution:'Test data'});
const series=(id:IndexId,last:number,lastDate='2026-11-06'):IndexSeries=>({id,source:src(id),retrievedAt:now.toISOString(),closes:[{date:'2026-11-04',close:last*1.01},{date:'2026-11-05',close:last*1.02},{date:lastDate,close:last}]});
const provider=(f:(id:IndexId)=>IndexSeries|Promise<IndexSeries>):IndexProvider=>({name:'test',fetchSeries:async id=>f(id)});
const ok=provider(id=>series(id,id==='nifty50'?24000:79000));

describe('daily refresh',()=>{
 it('verifies both indices and produces a deterministic brief without AI',async()=>{
  const r=await refresh({indices:ok,news:null,generate:null,model:null,now});
  expect(r.status).toBe('updated');if(r.status!=='updated')return;
  expect(r.snapshot).toMatchObject({sessionDate:'2026-11-06',brief:{kind:'deterministic'}});
  expect(r.snapshot.indices.map(i=>i.session.direction)).toEqual(['down','down']);
  expect(r.snapshot.sources).toHaveLength(2);
 });
 it('keeps the stored brief when the session has not changed (weekends, holidays, repeat runs)',async()=>{
  const first=await refresh({indices:ok,news:null,generate:null,model:null,now});if(first.status!=='updated')throw Error();
  expect(await refresh({indices:ok,news:null,generate:null,model:null,now,previous:first.snapshot})).toMatchObject({status:'unchanged',sessionDate:'2026-11-06',reason:expect.stringContaining('No new trading session')});
  expect((await refresh({indices:ok,news:null,generate:null,model:null,now,previous:first.snapshot,force:true})).status).toBe('updated');
 });
 it('fails without publishing when a provider errors or data fails verification',async()=>{
  expect(await refresh({indices:provider(()=>{throw Error('HTTP 429')}),news:null,generate:null,model:null,now})).toMatchObject({status:'failed',reason:expect.stringContaining('HTTP 429')});
  const weekend=provider(id=>series(id,24000,'2026-11-07'));
  expect(await refresh({indices:weekend,news:null,generate:null,model:null,now})).toMatchObject({status:'failed',reason:expect.stringContaining('weekend')});
 });
 it('tolerates a news failure (news is optional evidence)',async()=>{
  const r=await refresh({indices:ok,news:{name:'n',fetchNews:async()=>{throw Error('feed down')}},generate:null,model:null,now});
  expect(r.status).toBe('updated');if(r.status==='updated')expect(r.snapshot.news).toEqual([]);
 });
 it('notes when the two indices report different session dates',async()=>{
  const earlier:IndexSeries={id:'sensex',source:src('sensex'),retrievedAt:now.toISOString(),closes:[{date:'2026-11-03',close:79500},{date:'2026-11-04',close:79800},{date:'2026-11-05',close:79000}]};
  const mixed=provider(id=>id==='nifty50'?series(id,24000):earlier);
  const r=await refresh({indices:mixed,news:null,generate:null,model:null,now});
  expect(r.status==='updated'&&r.snapshot.notes[0]).toContain('different latest session dates');
 });
});

describe('safeguards for the stored brief',()=>{
 // A minimal analysis that passes the gate for the synthetic series above (both indices down on 6 November 2026).
 const passing=JSON.stringify({verdict_headline:'Indian benchmark indices closed lower on 6 November 2026',
  verdict_summary:{text:'NIFTY 50 and BSE SENSEX closed below their previous closes.',supports:['F_NIFTY_CHG','F_SENSEX_CHG']},
  market_facts:[{text:'NIFTY 50 closed lower than its previous close.',supports:['F_NIFTY_CLOSE','F_NIFTY_PREV']}],
  context:[],history_context:[],sip_education:[{text:'A SIP invests a fixed amount on set dates, whatever the market level.',supports:['F_NIFTY_PCT']}],
  uncertainty:['The sources provided do not establish why the market moved.']});
 const ai=async()=>passing,bad=async()=>'{"not":"valid"}';
 const first=async()=>{const r=await refresh({indices:ok,news:null,generate:null,model:null,now});if(r.status!=='updated')throw Error();return r.snapshot};

 it('never lets an older session from the source overwrite a newer stored brief',async()=>{
  const stored={...(await first()),sessionDate:'2026-11-09'};
  const r=await refresh({indices:ok,news:null,generate:ai,model:'m',now,previous:stored});
  expect(r).toMatchObject({status:'unchanged',sessionDate:'2026-11-09',reason:expect.stringContaining('older session')});
 });
 it('retries AI for the same session when the stored brief fell back to verified facts',async()=>{
  const stored=await first();expect(stored.brief.kind).toBe('deterministic');
  const up=await refresh({indices:ok,news:null,generate:ai,model:'m',now,previous:stored});
  expect(up).toMatchObject({status:'updated',reason:'ai-upgrade',snapshot:{brief:{kind:'ai'}}});
 });
 it('keeps the stored brief when the AI retry fails again',async()=>{
  const r=await refresh({indices:ok,news:null,generate:bad,model:'m',now,previous:await first()});
  expect(r).toMatchObject({status:'unchanged',reason:expect.stringContaining('stored brief is kept')});
 });
 it('does not regenerate an AI brief for the same session, and a forced run cannot downgrade it',async()=>{
  const up=await refresh({indices:ok,news:null,generate:ai,model:'m',now,previous:await first()});if(up.status!=='updated')throw Error();
  expect((await refresh({indices:ok,news:null,generate:ai,model:'m',now,previous:up.snapshot})).status).toBe('unchanged');
  expect((await refresh({indices:ok,news:null,generate:bad,model:'m',now,previous:up.snapshot,force:true})).status).toBe('unchanged');
 });
 it('stores a new session even when AI fails (verified figures, facts-only brief)',async()=>{
  const stored={...(await first()),sessionDate:'2026-11-05'};
  const r=await refresh({indices:ok,news:null,generate:bad,model:'m',now,previous:stored});
  expect(r).toMatchObject({status:'updated',reason:'new-session',snapshot:{sessionDate:'2026-11-06',brief:{kind:'deterministic'}}});
 });
 it('caps slow news so the run stays within its time budget',async()=>{
  const t=Date.now();
  const r=await refresh({indices:ok,news:{name:'slow',fetchNews:()=>new Promise(()=>{})},generate:null,model:null,now,newsTimeoutMs:50});
  expect(r.status).toBe('updated');expect(Date.now()-t).toBeLessThan(2000);
 });
});

describe('open-data mode (no licensed index source)',()=>{
 const pts=Array.from({length:24},(_,i)=>{const d=new Date(Date.UTC(2024,10+i,1));return {period:d.toISOString().slice(0,7),value:i===23?267.44:250+i}});
 const monthly={name:'OECD',fetchSeries:async()=>({name:'India share price index (OECD, monthly, 2015 = 100)',points:pts,source:{name:'OECD Data Explorer',url:'https://data-explorer.oecd.org/',attribution:'OECD'},retrievedAt:now.toISOString()})};
 const news={name:'n',fetchNews:async()=>[{id:'N1',title:'Test Wire: Sensex ends lower',publisher:'Test Wire',publishedAt:'2026-11-06T11:00:00Z',url:'https://example.test/1',summary:'The Sensex closed lower, the report said.'}]};
 it('stores an open brief dated to the latest weekday session, with OECD facts and no index closes',async()=>{
  const r=await refresh({indices:null,monthly,news,generate:null,model:null,now});
  expect(r).toMatchObject({status:'updated',snapshot:{mode:'open',sessionDate:'2026-11-06',indices:[],brief:{kind:'deterministic'}}});
  if(r.status==='updated'){expect(r.snapshot.monthly?.points).toHaveLength(24);expect(r.snapshot.brief.summary).toContain('267.44 in October 2026')}
 });
 it('keeps the stored brief for the same date, and on the weekend',async()=>{
  const first=await refresh({indices:null,monthly,news,generate:null,model:null,now});if(first.status!=='updated')throw Error();
  expect((await refresh({indices:null,monthly,news,generate:null,model:null,now,previous:first.snapshot})).status).toBe('unchanged');
  expect((await refresh({indices:null,monthly,news,generate:null,model:null,now:new Date('2026-11-08T05:00:00Z'),previous:first.snapshot})).status).toBe('unchanged');
 });
 it('still publishes with news only if the OECD series fails, and notes it',async()=>{
  const r=await refresh({indices:null,monthly:{name:'OECD',fetchSeries:async()=>{throw Error('OECD HTTP 503')}},news,generate:null,model:null,now});
  expect(r.status).toBe('updated');if(r.status==='updated'){expect(r.snapshot.monthly).toBeNull();expect(r.snapshot.notes[0]).toContain('OECD HTTP 503')}
 });
 it('fails (keeping the stored brief) when neither OECD nor news is available',async()=>{
  const r=await refresh({indices:null,monthly:{name:'OECD',fetchSeries:async()=>{throw Error('down')}},news:null,generate:null,model:null,now});
  expect(r).toMatchObject({status:'failed',reason:expect.stringContaining('No verified open data')});
 });
});
