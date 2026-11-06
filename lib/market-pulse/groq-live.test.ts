import {describe,expect,it} from 'vitest';
import {groqConfig,groqGenerate} from '../ai/groq';
import {verifySeries,type IndexSeries} from './market';
import {buildEvidence,type NewsItem} from './evidence';
import {analyse} from './analyst';
import {evaluate} from './gate';

/**
 * Opt-in live check of the Market Pulse analyst against real Groq (MARKET_PULSE_LIVE=1, GROQ_API_KEY set).
 * Uses SYNTHETIC test evidence, never stores or publishes output, and prints only check results.
 * Run: node --env-file=.env.local node_modules/vitest/vitest.mjs run lib/market-pulse/groq-live.test.ts
 */
const live=(process.env.MARKET_PULSE_LIVE==='1'||process.env.npm_lifecycle_event==='test:market-pulse:live')&&groqConfig().configured;
const now=new Date('2026-11-08T05:00:00Z');
const src={name:'Synthetic test source',url:'https://example.test',attribution:'Synthetic'};
const mk=(id:'nifty50'|'sensex',base:number,last:number):IndexSeries=>{const closes=[];let d=Date.parse('2025-10-01T00:00:00Z'),v=base;
 while(d<=Date.parse('2026-11-05T00:00:00Z')){const w=new Date(d).getUTCDay();if(w&&w<6){closes.push({date:new Date(d).toISOString().slice(0,10),close:Math.round(v*100)/100});v*=1+Math.sin(closes.length/9)*0.003}d+=86400000}
 closes.push({date:'2026-11-06',close:last});return {id,closes,source:src,retrievedAt:now.toISOString()}};
const v=(s:IndexSeries)=>{const r=verifySeries(s,now);if(!r.ok)throw Error(r.errors.join());return r};
const news:NewsItem[]=[
 {id:'N1',title:'Synthetic Wire: Indian shares end lower as crude oil prices rise',publisher:'Synthetic Wire',publishedAt:'2026-11-06T11:00:00Z',url:'https://example.test/1',summary:'Indian equity benchmarks closed lower, with higher crude oil prices weighing on sentiment, the report said.'},
 {id:'N2',title:'Synthetic Daily: RBI keeps policy rate unchanged',publisher:'Synthetic Daily',publishedAt:'2026-11-06T06:00:00Z',url:'https://example.test/2',summary:'The Reserve Bank of India left its policy rate unchanged at its latest meeting, according to the statement.'},
];

describe.skipIf(!live)('Market Pulse analyst with real Groq (synthetic evidence)',()=>{
 it('reports how many of 3 generations pass the gate',async()=>{
  const c=groqConfig();if(!c.configured)return;
  const s=mk('nifty50',23500,24000),t=mk('sensex',78000,79000);
  const e=buildEvidence([v(s),v(t)],news);
  const results=[];
  const gen=groqGenerate(c);let raw='';
  const capture:typeof gen=async req=>{raw=await gen(req);return raw};
  for(let i=0;i<3;i++){const b=await analyse(e,capture,c.model,now);results.push(b);
   console.log(`run ${i+1}: ${b.kind}${b.kind==='deterministic'?` (${b.fallbackReason})`:''} | failed: ${b.checks.filter(x=>!x.passed).map(x=>x.id).join(', ')||'none'}`);
   // Local diagnostics only: the gate's reasons for this run (never stored or published).
   try{for(const ch of evaluate(JSON.parse(raw),e).checks.filter(x=>!x.passed))console.log(`  ${ch.id}: ${ch.detail}`)}catch{console.log('  (unparseable output)')}
   if(b.kind==='ai')console.log(`  headline: ${b.headline}`);
   await new Promise(r=>setTimeout(r,2500));}
  expect(results.length).toBe(3);
 },120000);
});
