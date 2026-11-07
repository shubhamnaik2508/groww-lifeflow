import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchMarketVideos,isMarketVideo,parsePlaylistItems,VIDEO_CHANNELS} from './youtube';
import {GET} from '../../app/api/market-pulse/videos/route';

// Synthetic items in the playlistItems.list shape; titles are made up for testing.
const ch=VIDEO_CHANNELS[0];
const item=(id:string,title:string,at:string,thumb='https://i.ytimg.com/vi/x/mqdefault.jpg')=>({snippet:{title,publishedAt:at,resourceId:{videoId:id},thumbnails:{medium:{url:thumb}}}});
const now=new Date('2026-11-07T12:00:00Z');

describe('market video selection',()=>{
 it.each([
  ['Stock Market LIVE: Nifty & Sensex today',true],['Market Opening LIVE | Nifty opens lower',true],['Closing Bell: what moved Dalal Street',true],['RBI keeps repo rate unchanged',true],
  ['Inside Crawford Market: Mumbai traders',false],['Football fans pay tribute',false],['Nifty: 5 stocks to buy this week',false],['Sensex target 90,000? Experts pick multibaggers',false],
 ])('%s → %s',(t,ok)=>expect(isMarketVideo(t)).toBe(ok));
 it('parses items, decodes entities, drops private/deleted and untrusted thumbnails',()=>{
  const v=parsePlaylistItems({items:[item('abc123def45','Nifty &amp; Sensex close lower','2026-11-06T10:00:00Z'),item('zzz','Private video','2026-11-06T10:00:00Z'),item('bad id!','Sensex','2026-11-06T10:00:00Z'),item('ok123456789','Sensex wrap','2026-11-06T09:00:00Z','https://evil.example/x.jpg')]},ch);
  expect(v.map(x=>[x.title,x.thumbnail])).toEqual([['Nifty & Sensex close lower','https://i.ytimg.com/vi/x/mqdefault.jpg'],['Sensex wrap',null]]);
  expect(v[0]).toMatchObject({channel:'moneycontrol',url:'https://www.youtube.com/watch?v=abc123def45'});
  expect(parsePlaylistItems({error:{}},ch)).toEqual([]);
 });
});

describe('fetching market videos',()=>{
 const json=(items:unknown[])=>new Response(JSON.stringify({items}));
 it('uses each channel’s uploads playlist, keeps market videos from the last 3 days, newest first, de-duplicated',async()=>{
  const urls:string[]=[];
  const r=await fetchMarketVideos('KEY',{now,fetchImpl:(async(u:string)=>{urls.push(u);return u.includes('UUhftTVI0QJmyXkajQYt2tiQ')
   ?json([item('a1234567','Sensex closes higher','2026-11-07T10:00:00Z'),item('b1234567','Cricket final','2026-11-07T09:00:00Z'),item('c1234567','Nifty weekly wrap','2026-11-01T09:00:00Z')])
   :json([item('d1234567','Market Opening LIVE: Nifty','2026-11-07T04:00:00Z'),item('a1234567','Sensex closes higher','2026-11-07T10:00:00Z')])}) as never});
  expect(urls.every(u=>u.startsWith('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=UU'))).toBe(true);
  expect(r.videos.map(v=>v.videoId)).toEqual(['a1234567','d1234567']);expect(r.failedChannels).toEqual([]);
 });
 it('tolerates one channel failing and caps the list',async()=>{
  const many=Array.from({length:9},(_,i)=>item(`v${i}abcdefg`,`Nifty update ${i}`,`2026-11-07T0${i}:00:00Z`));
  const r=await fetchMarketVideos('KEY',{now,limit:6,fetchImpl:(async(u:string)=>u.includes('UUmRbHAgG2k2vDUvb3xsEunQ')?new Response('quota',{status:403}):json(many)) as never});
  expect(r.videos).toHaveLength(6);expect(r.failedChannels).toEqual(['CNBC-TV18']);
 });
});

describe('GET /api/market-pulse/videos',()=>{
 const ENV={...process.env};
 afterEach(()=>{vi.unstubAllGlobals();process.env={...ENV}});
 it('is not configured without a key (the page hides the block)',async()=>{delete process.env.YOUTUBE_API_KEY;expect(await (await GET()).json()).toEqual({status:'not_configured'})});
 it('returns videos without ever exposing the key, with edge caching',async()=>{
  process.env.YOUTUBE_API_KEY='secret-yt-key';
  vi.stubGlobal('fetch',vi.fn(async()=>new Response(JSON.stringify({items:[item('a1234567','Sensex closes higher',new Date(Date.now()-3600000).toISOString())]}))));
  const res=await GET();const text=await res.text();
  expect(JSON.parse(text)).toMatchObject({status:'ok',partial:false,channels:[{name:'moneycontrol'},{name:'CNBC-TV18'}]});
  expect(text).not.toContain('secret-yt-key');expect(res.headers.get('cache-control')).toContain('s-maxage=1800');
 });
 it('reports an error when every channel fails',async()=>{
  process.env.YOUTUBE_API_KEY='k';vi.stubGlobal('fetch',vi.fn(async()=>new Response('no',{status:403})));
  expect(await (await GET()).json()).toEqual({status:'error'});
 });
});
