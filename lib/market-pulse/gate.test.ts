import {describe,expect,it} from 'vitest';
import {verifySeries,type IndexSeries} from './market';
import {buildEvidence,deterministicBrief,type NewsItem} from './evidence';
import {evaluate,type Analysis} from './gate';
import {analyse} from './analyst';

// Synthetic test numbers and a made-up test headline; they exercise the gate and are not market data.
const now=new Date('2026-11-08T05:00:00Z');
const src={name:'Test',url:'https://example.test',attribution:'Test'};
const mk=(id:'nifty50'|'sensex',a:number,b:number):IndexSeries=>({id,source:src,retrievedAt:'2026-11-06T13:00:00Z',closes:[{date:'2025-11-06',close:a*0.95},{date:'2026-10-06',close:a*1.01},{date:'2026-11-05',close:a},{date:'2026-11-06',close:b}]});
const v=(s:IndexSeries)=>{const r=verifySeries(s,now);if(!r.ok)throw Error(r.errors.join());return r};
const news:NewsItem[]=[{id:'N1',title:'Test Wire: equities slip as crude oil prices climb',publisher:'Test Wire',publishedAt:'2026-11-06T12:00:00Z',url:'https://example.test/n1',summary:'Indian shares ended lower as higher crude oil prices weighed on sentiment, the report said.'}];
const e=buildEvidence([v(mk('nifty50',24200,24000)),v(mk('sensex',80000,79400))],news);

const good:Analysis={
 verdict_headline:'Indian benchmark indices closed lower on 6 November 2026',
 verdict_summary:{text:'NIFTY 50 closed at 24,000.00, down 200.00 points (−0.83%), and SENSEX closed at 79,400.00 (−0.75%).',supports:['F_NIFTY_CLOSE','F_NIFTY_CHG','F_NIFTY_PCT','F_SENSEX_CLOSE','F_SENSEX_PCT']},
 market_facts:[{text:'NIFTY 50 fell from a previous close of 24,200.00 to 24,000.00.',supports:['F_NIFTY_PREV','F_NIFTY_CLOSE']}],
 context:[{text:'According to Test Wire, higher crude oil prices weighed on sentiment.',supports:['N1']}],
 history_context:[{text:'Over the past year NIFTY 50 changed by +4.39%.',supports:['F_NIFTY_1Y_PCT']}],
 sip_education:[{text:'A SIP invests a fixed amount on set dates, so lower prices buy more units and higher prices buy fewer. Affordability, emergency savings and your time horizon are the things to weigh.',supports:['F_NIFTY_PCT']}],
 uncertainty:['The sources provided do not establish how much each development contributed to the move.'],
};
const variant=(f:(a:Analysis)=>void)=>{const a=structuredClone(good);f(a);return evaluate(a,e)};
const failed=(r:ReturnType<typeof evaluate>)=>r.checks.filter(c=>!c.passed).map(c=>c.id);

describe('Market Pulse gate',()=>{
 it('passes a grounded, neutral analysis',()=>{const r=evaluate(good,e);expect(failed(r)).toEqual([]);expect(r.passed).toBe(true)});
 // Regressions from live Groq output (2026-11-07), restated with the synthetic figures above.
 it('allows every number printed in a verified fact (e.g. "7 of 249 sessions"), but not a near miss',()=>{
  const e2={...e,facts:[...e.facts,{id:'F_TEST_DAYS',label:'test',value:7,display:'7 of 249 sessions'}]};
  const claim=(t:string)=>{const a=structuredClone(good);a.history_context=[{text:t,supports:['F_TEST_DAYS']}];return evaluate(a,e2)};
  expect(failed(claim('NIFTY 50 moved 1% or more in 7 of 249 sessions over the past year.'))).toEqual([]);
  expect(failed(claim('NIFTY 50 moved 1% or more in 7 of 250 sessions over the past year.'))).toContain('numbers');
 });
 it('does not treat a general explanation of rising and falling markets as a session claim',()=>
  expect(failed(variant(a=>{a.sip_education=[{text:'In a rising market, the same contribution buys fewer units; in a falling market, it buys more.',supports:['F_NIFTY_PCT']}]}))).toEqual([]));
 it('still checks the benchmarks collectively',()=>expect(failed(variant(a=>{a.market_facts[0].text='Benchmark indices advanced in the session.'}))).toContain('direction'));
 it('rejects malformed output',()=>{expect(evaluate({verdict_headline:'x'},e).passed).toBe(false);expect(evaluate({...good,extra:1},e).passed).toBe(false)});
 it.each<[string,(a:Analysis)=>void,string]>([
  ['a wrong close',a=>{a.verdict_summary.text='NIFTY 50 closed at 24,100.00, down 200.00 points.'},'numbers'],
  ['a wrong percentage',a=>{a.market_facts[0].text='NIFTY 50 fell 1.20% in the session.'},'numbers'],
  ['an invented source',a=>{a.context[0].supports=['N9']},'sources'],
  ['context without news',a=>{a.context[0].supports=['F_NIFTY_PCT']},'sources'],
  ['a fact claim without facts',a=>{a.market_facts[0].supports=[]},'sources'],
  ['the wrong direction',a=>{a.market_facts[0].text='NIFTY 50 rose to 24,000.00.'},'direction'],
  ['a general rise when indices fell',a=>{a.market_facts[0].text='Indian benchmark indices gained in the session.'},'direction'],
  ['“today”',a=>{a.verdict_headline='Indian benchmark indices closed lower today'},'dates'],
  ['an unsupported cause',a=>{a.market_facts[0].text='NIFTY 50 fell to 24,000.00 because of foreign investor selling.'},'causes'],
  ['a cause citing unrelated news',a=>{a.context[0].text='Markets fell due to weak monsoon rainfall.'},'causes'],
  ['advice to continue',a=>{a.sip_education[0].text='You should continue your SIP through this dip.'},'advice'],
  ['a buying opportunity',a=>{a.sip_education[0].text='A fall like this is a buying opportunity for SIP investors.'},'advice'],
  ['stop your SIP',a=>{a.sip_education[0].text='Investors may want to stop your SIP until markets settle.'},'advice'],
  ['an imperative',a=>{a.sip_education[0].text='Markets are volatile. Invest a lump sum while prices are low.'},'advice'],
  ['buy now',a=>{a.sip_education[0].text='Many investors buy now when indices fall.'},'advice'],
  ['a prediction',a=>{a.uncertainty[0]='Markets will likely recover next week.'},'predictions'],
  ['an expected rebound',a=>{a.history_context[0].text='NIFTY 50 is expected to rebound from these levels.'},'predictions'],
  ['a guarantee',a=>{a.sip_education[0].text='Long-term SIPs are risk-free over time.'},'guarantees'],
 ])('blocks %s',(_,f,check)=>{const r=variant(f);expect(r.passed).toBe(false);expect(failed(r)).toContain(check)});
});

describe('analyst',()=>{
 it('uses AI text only when every check passes',async()=>{
  const b=await analyse(e,async()=>JSON.stringify(good),'test-model',now);
  expect(b).toMatchObject({kind:'ai',headline:good.verdict_headline,fallbackReason:null});
 });
 it('never stores rejected text, and falls back to verified facts',async()=>{
  const bad={...good,sip_education:[{text:'You should buy more now.',supports:['F_NIFTY_PCT']}]};
  const b=await analyse(e,async()=>JSON.stringify(bad),'test-model',now);
  expect(b.kind).toBe('deterministic');expect(b.analysis).toBeNull();expect(JSON.stringify(b)).not.toContain('buy more');
  expect(b.checks.find(c=>c.id==='advice')?.passed).toBe(false);expect(b.summary).toContain('NIFTY 50 closed at 24,000.00');
 });
 it('falls back on provider errors, invalid JSON and missing configuration',async()=>{
  expect((await analyse(e,async()=>{throw Error('busy')},'m',now)).kind).toBe('deterministic');
  expect((await analyse(e,async()=>'not json','m',now)).fallbackReason).toContain('not valid JSON');
  expect((await analyse(e,null,null,now)).fallbackReason).toContain('not configured');
 });
});

describe('deterministic brief',()=>{
 it('states movement without causes',()=>{const d=deterministicBrief(e);
  expect(d.headline).toBe('Indian benchmark indices closed lower on 6 November 2026');
  expect(d.summary).toContain('NIFTY 50 closed at 24,000.00, down 200.00 points (−0.83%) from 24,200.00');
  expect(d.note).toContain('does not explain why');
 });
 it('evidence exposes the verified history statistics as facts',()=>expect(e.facts.map(f=>f.id)).toEqual(expect.arrayContaining(['F_NIFTY_1M_PCT','F_NIFTY_1Y_PCT','F_NIFTY_1Y_HIGH','F_SENSEX_1Y_FALL'])));
});
