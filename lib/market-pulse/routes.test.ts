import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {GET as pulse} from '../../app/api/market-pulse/route';
import {GET as refreshRoute} from '../../app/api/market-pulse/refresh/route';

// Upstash REST and EODHD are mocked; values below are synthetic test data, not market data.
const ENV={...process.env};
let store:Record<string,string>={};
const calls:string[]=[];
function mockFetch(eod:(sym:string)=>unknown){
 vi.stubGlobal('fetch',vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);calls.push(url.replace(/api_token=[^&]+/,'api_token=***'));
  if(url.startsWith('https://test.upstash.io')){const [cmd,key,val]=JSON.parse(String(init?.body));
   if(cmd==='GET')return Response.json({result:store[key]??null});if(cmd==='SET'){store[key]=val;return Response.json({result:'OK'})}return Response.json({result:0})}
  if(url.startsWith('https://eodhd.com/api/eod/'))return Response.json(eod(url.split('/api/eod/')[1].split('?')[0]));
  return new Response('offline',{status:503}); // news feeds are unavailable in this test
 }));
}
const series=(last:number)=>{const out=[];let d=Date.parse('2025-10-01T00:00:00Z');let v=last*0.9;while(d<=Date.parse('2026-11-06T00:00:00Z')){const w=new Date(d).getUTCDay();if(w&&w<6){out.push({date:new Date(d).toISOString().slice(0,10),close:Math.round(v*100)/100});v*=1.0004}d+=86400000}out[out.length-1].close=last;return out};

beforeEach(()=>{store={};calls.length=0;process.env={...ENV};delete process.env.UPSTASH_REDIS_REST_URL;delete process.env.KV_REST_API_URL;delete process.env.EODHD_API_TOKEN;delete process.env.MARKET_DATA_LICENSE_CONFIRMED;delete process.env.GROQ_API_KEY;process.env.LIFEFLOW_AI_ENABLED='false'});
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();process.env={...ENV}});

describe('GET /api/market-pulse',()=>{
 it('states the licensing blocker and shows no figures when no licensed source is configured',async()=>{
  const r=await (await pulse()).json();expect(r.status).toBe('not_configured');expect(r.message).toContain('licensed for public display');expect(r.snapshot).toBeUndefined();
 });
 it('reports an empty store honestly, then serves the stored brief with freshness and CDN caching',async()=>{
  process.env.UPSTASH_REDIS_REST_URL='https://test.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='t';process.env.EODHD_API_TOKEN='k';process.env.MARKET_DATA_LICENSE_CONFIRMED='true';
  mockFetch(()=>[]);
  expect((await (await pulse()).json()).status).toBe('empty');
  store['lifeflow:market-pulse:latest:v1']=JSON.stringify({version:1,sessionDate:'2026-11-06'});
  const res=await pulse();const r=await res.json();
  expect(r.status).toBe('ok');expect(r.freshness.status).toMatch(/current|stale|possibly-stale/);expect(res.headers.get('cache-control')).toContain('s-maxage=300');
 });
});

describe('GET /api/market-pulse/refresh',()=>{
 const req=(auth?:string)=>new Request('http://localhost/api/market-pulse/refresh',{headers:auth?{authorization:auth}:{}});
 it('rejects calls without the cron secret',async()=>{
  process.env.CRON_SECRET='a-long-test-secret-value';
  expect((await refreshRoute(req())).status).toBe(401);expect((await refreshRoute(req('Bearer wrong'))).status).toBe(401);
  delete process.env.CRON_SECRET;expect((await refreshRoute(req('Bearer '))).status).toBe(401);
 });
 it('refuses to fetch index data without confirmed licence',async()=>{
  process.env.CRON_SECRET='a-long-test-secret-value';process.env.UPSTASH_REDIS_REST_URL='https://test.upstash.io';process.env.UPSTASH_REDIS_REST_TOKEN='t';process.env.EODHD_API_TOKEN='k';
  mockFetch(()=>[]);const r=await refreshRoute(req('Bearer a-long-test-secret-value'));
  expect(r.status).toBe(503);expect((await r.json()).error).toBe('provider_not_configured');expect(calls.some(c=>c.includes('eodhd')) ).toBe(false);
 });
 it('fetches, verifies and stores a deterministic brief (AI off), keeping the token out of logs',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-11-06T13:05:00Z'));
  Object.assign(process.env,{CRON_SECRET:'a-long-test-secret-value',UPSTASH_REDIS_REST_URL:'https://test.upstash.io',UPSTASH_REDIS_REST_TOKEN:'t',EODHD_API_TOKEN:'secret-token',MARKET_DATA_LICENSE_CONFIRMED:'true',MARKET_PULSE_GDELT:'false'});
  mockFetch(sym=>series(sym.startsWith('NSEI')?24000:79000));
  const r=await refreshRoute(req('Bearer a-long-test-secret-value'));const body=await r.json();
  expect(r.status).toBe(200);expect(body).toMatchObject({status:'updated',sessionDate:'2026-11-06',brief:'deterministic'});
  const saved=JSON.parse(store['lifeflow:market-pulse:latest:v1']);
  expect(saved.indices.map((i:{session:{name:string;close:number}})=>[i.session.name,i.session.close])).toEqual([['NIFTY 50',24000],['BSE SENSEX',79000]]);
  expect(JSON.stringify(saved)).not.toContain('secret-token');
  // A repeat run for the same session keeps the stored brief.
  expect((await (await refreshRoute(req('Bearer a-long-test-secret-value'))).json()).status).toBe('unchanged');
 });
});
