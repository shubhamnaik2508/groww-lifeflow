import {describe,expect,it} from 'vitest';
import {combineNews,configuredProviders,eodhdProvider,isoDate,parseEodhd,parseGdelt,parseGnews,parseRss} from './providers';

// Fixtures mirror each provider's documented response shape with made-up content; they are not real data.
describe('index provider (EODHD, licence-gated)',()=>{
 it('enables index closes only with confirmed written permission; otherwise open-data mode (OECD + news)',()=>{
  for(const env of [{},{EODHD_API_TOKEN:'x'},{MARKET_DATA_LICENSE_CONFIRMED:'true'}]){const p=configuredProviders(env);expect(p.indices).toBeNull();expect(p.licensedIndices).toBe(false);expect(p.monthly?.name).toBe('OECD')}
  const p=configuredProviders({EODHD_API_TOKEN:'x',MARKET_DATA_LICENSE_CONFIRMED:'true'});
  expect(p.indices?.name).toBe('EODHD');expect(p.licensedIndices).toBe(true);expect(p.newsSources.map(s=>s.name)).toEqual(['GDELT Project','SEBI RSS']);
  expect(configuredProviders({MARKET_PULSE_OECD:'false'}).monthly).toBeNull();
 });
 it('uses GNews only when its use is confirmed',()=>{
  const p=configuredProviders({EODHD_API_TOKEN:'x',MARKET_DATA_LICENSE_CONFIRMED:'true',GNEWS_API_KEY:'k'});if(p.ok)expect(p.newsSources.map(s=>s.name)).not.toContain('GNews');
  const q=configuredProviders({EODHD_API_TOKEN:'x',MARKET_DATA_LICENSE_CONFIRMED:'true',GNEWS_API_KEY:'k',GNEWS_USE_CONFIRMED:'true'});if(q.ok)expect(q.newsSources[0].name).toBe('GNews');
 });
 it('parses the EOD array and drops malformed rows',()=>{
  expect(parseEodhd([{date:'2026-11-05',open:1,close:100.5},{date:'2026-11-06',close:'101.25'},{date:3,close:1},{date:'2026-11-07'}])).toEqual([{date:'2026-11-05',close:100.5},{date:'2026-11-06',close:101.25}]);
  expect(()=>parseEodhd({error:'x'})).toThrow();
 });
 it('requests the documented endpoint and reports HTTP errors without leaking the token',async()=>{
  let called='';const p=eodhdProvider('secret',"Data: test",(async(u:string)=>{called=u;return new Response(JSON.stringify([{date:'2026-11-05',close:1},{date:'2026-11-06',close:2}]))}) as never);
  const s=await p.fetchSeries('sensex');expect(called).toMatch(/^https:\/\/eodhd\.com\/api\/eod\/BSESN\.INDX\?fmt=json&from=\d{4}-\d{2}-\d{2}&api_token=secret$/);expect(s.closes).toHaveLength(2);
  const bad=eodhdProvider('secret','x',(async()=>new Response('nope',{status:402})) as never);
  await expect(bad.fetchSeries('nifty50')).rejects.toThrow(/^EODHD HTTP 402$/);
 });
});

describe('news parsers',()=>{
 it('reads SEBI dates as IST',()=>{expect(isoDate('06 Nov, 2026 +0530')).toBe('2026-11-06T06:30:00.000Z');expect(isoDate('Fri, 06 Nov 2026 10:00:00 GMT')).toBe('2026-11-06T10:00:00.000Z');expect(isoDate('nonsense')).toBeNull()});
 it('parses RSS items, decoding CDATA and HTML, skipping incomplete items',()=>{
  const xml=`<rss><channel><item><title><![CDATA[Test circular on mutual funds &amp; investors]]></title><link>https://example.test/a</link><description>&lt;p&gt;Short test description.&lt;/p&gt;</description><pubDate>06 Nov, 2026 +0530</pubDate></item><item><title>No link</title><pubDate>06 Nov, 2026 +0530</pubDate></item></channel></rss>`;
  expect(parseRss(xml,'SEBI')).toEqual([{title:'Test circular on mutual funds & investors',publisher:'SEBI',publishedAt:'2026-11-06T06:30:00.000Z',url:'https://example.test/a',summary:'Short test description.'}]);
 });
 it('parses GDELT artlist and tidies title spacing',()=>{
  expect(parseGdelt({articles:[{url:'https://www.example.test/x',title:'Test headline , markets ( India ) close',seendate:'20261106T053000Z',domain:'example.test',language:'English'},{url:'bad',title:'x',seendate:'20261106T053000Z'}]}))
   .toEqual([{title:'Test headline, markets (India) close',publisher:'example.test',publishedAt:'2026-11-06T05:30:00Z',url:'https://www.example.test/x',summary:''}]);
  expect(parseGdelt({})).toEqual([]);
 });
 it('parses GNews articles',()=>expect(parseGnews({articles:[{title:'Test',description:'Desc',url:'https://example.test/g',publishedAt:'2026-11-06T09:00:00Z',source:{name:'Test Paper'}}]})[0]).toMatchObject({publisher:'Test Paper',summary:'Desc'}));
 it('combines feeds: session window, de-duplication, newest first, failures tolerated',async()=>{
  const item=(t:string,d:string,p='Wire')=>({id:'x',title:t,publisher:p,publishedAt:d,url:`https://example.test/${encodeURIComponent(t)}`,summary:''});
  const n=combineNews([
   {name:'a',fetchNews:async()=>[item('Old item','2026-10-01T00:00:00Z'),item('Same story','2026-11-06T08:00:00Z'),item('Later','2026-11-06T12:00:00Z')]},
   {name:'b',fetchNews:async()=>[item('Same  Story!','2026-11-06T09:00:00Z'),item('Circular','2026-11-06T06:30:00Z','SEBI')]},
   {name:'c',fetchNews:async()=>{throw Error('down')}},
  ]);
  const out=await n.fetchNews('2026-11-06');
  expect(out.map(x=>x.title)).toEqual(['Later','Same story','Circular']);expect(out.map(x=>x.id)).toEqual(['N1','N2','N3']);
 });
});
