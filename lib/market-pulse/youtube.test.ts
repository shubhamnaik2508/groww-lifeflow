import {afterEach,describe,expect,it,vi} from 'vitest';
import {fetchMarketVideos,isEndOfDayVideo,isMarketVideo,parsePlaylistItems,publishedAfterClose,VIDEO_CHANNELS} from './youtube';
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
 it.each([
  ['Market Closing LIVE | Sensex Sinks 1%, Nifty Below 22,400','2026-11-06T10:00:00Z',true],
  ['Market Ends Higher, Sensex & Nifty Snap Three-Day Losing Streak','2026-11-06T10:30:00Z',true],
  ['Stock Market Updates: Last Hour Of Trade | NSE Closing Bell','2026-11-06T09:00:00Z',true],
  ['India Business Hour: Nifty logs best week in six years','2026-11-06T16:00:00Z',true],
  ['Taking Stock: Nifty ends flat as IT drags','2026-11-06T12:00:00Z',true],
  ['Market Opening LIVE | Nifty Opens Below 24,500','2026-11-06T04:00:00Z',false],
  ['Market Closing LIVE | Sensex Sinks 1%','2026-11-06T05:00:00Z',false],
  ['Stock Market LIVE Updates: Nifty & Sensex Live','2026-11-06T21:10:00Z',false],
  ['Closing Bell: 3 stocks to buy tomorrow','2026-11-06T10:00:00Z',false],
 ])('end of day: %s at %s → %s',(t,at,ok)=>expect(isEndOfDayVideo(t,at)).toBe(ok));
 it('reads publish times in IST (after 14:00, or before the 09:15 open)',()=>{expect(publishedAfterClose('2026-11-06T08:30:00Z')).toBe(true);expect(publishedAfterClose('2026-11-06T08:29:00Z')).toBe(false);expect(publishedAfterClose('2026-11-06T03:44:00Z')).toBe(true);expect(publishedAfterClose('2026-11-06T03:45:00Z')).toBe(false)});
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
   :json([item('d1234567','Market Closing LIVE: Nifty ends flat','2026-11-07T09:45:00Z'),item('e1234567','Market Opening LIVE: Nifty','2026-11-07T04:00:00Z'),item('a1234567','Sensex closes higher','2026-11-07T10:00:00Z')])}) as never});
  expect(urls.every(u=>u.startsWith('https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=UU'))).toBe(true);
  expect(r.videos.map(v=>v.videoId)).toEqual(['a1234567','d1234567']);expect(r.failedChannels).toEqual([]);
 });
 it('tolerates one channel failing and caps the list',async()=>{
  const many=Array.from({length:9},(_,i)=>item(`v${i}abcdefg`,`Market Closing LIVE: Nifty update ${i}`,`2026-11-0${i%3+4}T1${i%5}:00:00Z`));
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
