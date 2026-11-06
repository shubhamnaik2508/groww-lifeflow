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
  expect(await refresh({indices:ok,news:null,generate:null,model:null,now,previous:first.snapshot})).toEqual({status:'unchanged',sessionDate:'2026-11-06'});
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
