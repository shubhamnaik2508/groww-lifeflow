/**
 * Market videos from official YouTube channels, through the YouTube Data API v3 (playlistItems.list on each
 * channel's uploads playlist: 1 quota unit per call). YouTube API Services policies followed:
 * - titles and thumbnails are shown unmodified, with YouTube clearly credited as the source (III.F.2);
 * - videos are listed in their own block, never intermixed with other news sources (III.C.5);
 * - data is refreshed at least hourly, far inside the 30-day storage limit (III.E.4);
 * - videos open on YouTube; no embedded player, so no player rules or autoplay concerns;
 * - video titles are never passed to the AI or used as evidence for generated text.
 */
export type MarketVideo={videoId:string;title:string;channel:string;publishedAt:string;thumbnail:string|null;url:string};
export type VideoChannel={id:string;name:string;url:string};

/** Official channels (IDs read from each channel's public page on 2026-11-07). */
export const VIDEO_CHANNELS:VideoChannel[]=[
 {id:'UChftTVI0QJmyXkajQYt2tiQ',name:'moneycontrol',url:'https://www.youtube.com/@moneycontrol'},
 {id:'UCmRbHAgG2k2vDUvb3xsEunQ',name:'CNBC-TV18',url:'https://www.youtube.com/@CNBC-TV18'},
];

/** Indian market coverage only: these channels also publish world news, sport and politics. */
const MARKET=/\b(nifty|sensex|stock market|share market|bank nifty|closing bell|market (?:opening|closing|live|outlook|wrap|update)|markets? (?:today|this week)|dalal street|fii|fpi|ipo|rbi|repo rate|rupee|bse|nse)\b/i;
/** Stock-tip formats are left out of an educational, no-advice page; titles are never edited, only selected. */
const TIPS=/\b(buy|sell|targets?|tips?|multibaggers?|picks?|stocks? to watch|trading ideas?|jackpot)\b/i;
export const isMarketVideo=(title:string)=>MARKET.test(title)&&!TIPS.test(title);

const decode=(s:string)=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
/** Parses playlistItems.list JSON (part=snippet). */
export function parsePlaylistItems(json:unknown,channel:VideoChannel):MarketVideo[]{
 const items=(json as {items?:unknown[]})?.items;if(!Array.isArray(items))return [];
 return items.flatMap(it=>{
  const sn=(it as {snippet?:Record<string,unknown>}).snippet??{};
  const videoId=(sn.resourceId as {videoId?:string})?.videoId,title=typeof sn.title==='string'?decode(sn.title):'',publishedAt=typeof sn.publishedAt==='string'?sn.publishedAt:'';
  if(!videoId||!/^[\w-]{6,20}$/.test(videoId)||!title||title==='Private video'||title==='Deleted video'||!Number.isFinite(Date.parse(publishedAt)))return [];
  const th=sn.thumbnails as Record<string,{url?:string}>|undefined;const thumb=th?.medium?.url??th?.default?.url??null;
  return [{videoId,title,channel:channel.name,publishedAt:new Date(publishedAt).toISOString(),thumbnail:thumb&&/^https:\/\/i\.ytimg\.com\//.test(thumb)?thumb:null,url:`https://www.youtube.com/watch?v=${videoId}`}];
 });
}

type Getter=(url:string,init?:RequestInit&{next?:{revalidate?:number}})=>Promise<Response>;
/** Latest market videos from the configured channels: last 3 days, newest first, at most `limit`. Channel failures are tolerated. */
export async function fetchMarketVideos(key:string,opts:{fetchImpl?:Getter;now?:Date;limit?:number;channels?:VideoChannel[]}={}):Promise<{videos:MarketVideo[];failedChannels:string[]}>{
 const get=opts.fetchImpl??((u,i)=>fetch(u,i));const now=opts.now??new Date();const since=now.getTime()-3*86400000;
 const failed:string[]=[];
 const lists=await Promise.all((opts.channels??VIDEO_CHANNELS).map(async ch=>{
  const uploads=`UU${ch.id.slice(2)}`;
  try{
   const r=await get(`https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${uploads}&key=${encodeURIComponent(key)}`,{signal:AbortSignal.timeout(10000),next:{revalidate:3600}});
   if(!r.ok){failed.push(ch.name);return []}
   return parsePlaylistItems(await r.json(),ch);
  }catch{failed.push(ch.name);return []}
 }));
 const seen=new Set<string>();
 const videos=lists.flat().filter(v=>isMarketVideo(v.title)&&Date.parse(v.publishedAt)>=since&&Date.parse(v.publishedAt)<=now.getTime()+3600000)
  .filter(v=>!seen.has(v.videoId)&&!!seen.add(v.videoId)).sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).slice(0,opts.limit??6);
 return {videos,failedChannels:failed};
}
