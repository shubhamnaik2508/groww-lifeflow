import 'server-only';
import type {IndexProvider,NewsProvider} from './refresh';
import type {DailyClose,IndexId,IndexSeries,Source} from './market';
import type {NewsItem} from './evidence';

/**
 * Market Pulse data providers. Source research (2026-11-07, see MARKET_PULSE.md):
 * - Index values: no free source was found whose terms permit public display. EODHD is supported, but only
 *   when the operator has written permission and sets MARKET_DATA_LICENSE_CONFIRMED=true. No scraping, no
 *   undocumented exchange endpoints, no unofficial Yahoo endpoints.
 * - News: SEBI's official RSS (linking permitted), the GDELT Project (open use with citation), and GNews
 *   (only with GNEWS_API_KEY, after the operator confirms the free plan covers this site).
 */

const TIMEOUT=12000;
const UA='GrowwLifeFlow-MarketPulse/1.0 (educational prototype)';
async function get(url:string,init:RequestInit={}):Promise<Response>{
 return fetch(url,{...init,headers:{'User-Agent':UA,...(init.headers??{})},signal:AbortSignal.timeout(TIMEOUT),cache:'no-store'});
}

// ---------- Index data: EODHD (licence-gated) ----------
const EODHD_SYMBOL:Record<IndexId,string>={nifty50:'NSEI.INDX',sensex:'BSESN.INDX'};
/** Parses EODHD's /api/eod JSON: [{date, open, high, low, close, adjusted_close, volume}]. */
export function parseEodhd(json:unknown):DailyClose[]{
 if(!Array.isArray(json))throw new Error('Unexpected response shape');
 return json.flatMap(r=>{const d=(r as {date?:unknown}).date,c=Number((r as {close?:unknown}).close);return typeof d==='string'&&Number.isFinite(c)?[{date:d,close:c}]:[]});
}
export function eodhdProvider(token:string,attribution:string,fetchImpl:typeof get=get):IndexProvider{
 const source:Source={name:'EODHD',url:'https://eodhd.com',attribution};
 return {name:'EODHD',fetchSeries:async(id)=>{
  const from=new Date(Date.now()-400*86400000).toISOString().slice(0,10);
  const r=await fetchImpl(`https://eodhd.com/api/eod/${EODHD_SYMBOL[id]}?fmt=json&from=${from}&api_token=${encodeURIComponent(token)}`);
  if(!r.ok)throw new Error(`EODHD HTTP ${r.status}`);
  return {id,closes:parseEodhd(await r.json()),source,retrievedAt:new Date().toISOString()} satisfies IndexSeries;
 }};
}

// ---------- News ----------
// Entities are decoded before tags are stripped, so entity-encoded HTML (&lt;p&gt;) is removed too.
// Output is plain text rendered by React (escaped), never as HTML.
const decode=(s:string)=>s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,'$1').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/<[^>]+>/g,' ').replace(/\s+/g,' ').trim();
const clip=(s:string,n=260)=>s.length>n?`${s.slice(0,n).replace(/\s+\S*$/,'')}…`:s;
const httpsUrl=(u:string)=>{try{const x=new URL(u.trim());return x.protocol==='https:'||x.protocol==='http:'?x.toString():null}catch{return null}};
const MONTHS='jan feb mar apr may jun jul aug sep oct nov dec'.split(' ');
/** RFC 822 dates, plus SEBI's "06 Nov, 2026 +0530" (date only; read as 12:00 IST). */
export const isoDate=(s:string)=>{
 const sebi=/^(\d{1,2}) ([A-Za-z]{3}),? (\d{4})(?: \+0530)?$/.exec(s.trim());
 if(sebi){const m=MONTHS.indexOf(sebi[2].toLowerCase());if(m<0)return null;return new Date(`${sebi[3]}-${String(m+1).padStart(2,'0')}-${sebi[1].padStart(2,'0')}T12:00:00+05:30`).toISOString()}
 const t=Date.parse(s);return Number.isFinite(t)?new Date(t).toISOString():null;
};

/** Minimal RSS 2.0 parser for SEBI's feed (title, link, description, pubDate). */
export function parseRss(xml:string,publisher:string):Omit<NewsItem,'id'>[]{
 return [...xml.matchAll(/<item\b[\s\S]*?<\/item>/gi)].flatMap(m=>{
  const tag=(t:string)=>decode(m[0].match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)<\\/${t}>`,'i'))?.[1]??'');
  const title=tag('title'),url=httpsUrl(tag('link')),publishedAt=isoDate(tag('pubDate'));
  return title&&url&&publishedAt?[{title:clip(title,220),publisher,publishedAt,url,summary:clip(tag('description'))}]:[];
 });
}
const SEBI_RELEVANT=/\b(mutual funds?|investors?|markets?|securities|SIP|equity|index|indices|circular|consultation|stock|broker|AMC)\b/i;
export const sebiNews:NewsProvider={name:'SEBI',fetchNews:async()=>{
 const r=await get('https://www.sebi.gov.in/sebirss.xml');if(!r.ok)throw new Error(`SEBI HTTP ${r.status}`);
 return parseRss(await r.text(),'SEBI').filter(n=>SEBI_RELEVANT.test(`${n.title} ${n.summary}`)).map((n,i)=>({...n,id:`S${i+1}`,topic:'Regulation'}));
}};

/** Parses GDELT DOC 2.0 artlist JSON. GDELT gives no summary; the publisher is the source domain. */
export function parseGdelt(json:unknown):Omit<NewsItem,'id'>[]{
 const arts=(json as {articles?:unknown[]})?.articles;if(!Array.isArray(arts))return [];
 return arts.flatMap(a=>{const x=a as Record<string,string>;const url=httpsUrl(x.url??'');const m=/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(x.seendate??'');
  const title=decode(x.title??'').replace(/\s+([,.;:!?%)'])/g,'$1').replace(/\(\s+/g,'(');
  return url&&m&&title&&(x.language??'English')==='English'?[{title:clip(title,220),publisher:(x.domain??new URL(url).hostname).replace(/^www\./,''),publishedAt:`${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`,url,summary:''}]:[];
 });
}
export const gdeltNews:NewsProvider={name:'GDELT',fetchNews:async()=>{
 const q=encodeURIComponent('(sensex OR nifty OR "reserve bank of india" OR "indian stocks" OR "indian shares") sourcecountry:india sourcelang:english');
 const url=`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&format=json&maxrecords=25&timespan=2d&sort=datedesc`;
 let r=await get(url);
 if(r.status===429){await new Promise(res=>setTimeout(res,6000));r=await get(url)} // GDELT asks for one request per 5 seconds
 if(!r.ok)throw new Error(`GDELT HTTP ${r.status}`);
 return parseGdelt(await r.json()).map((n,i)=>({...n,id:`G${i+1}`,topic:'Markets'}));
}};

/** Parses GNews v4 JSON: {articles:[{title, description, url, publishedAt, source:{name}}]}. */
export function parseGnews(json:unknown):Omit<NewsItem,'id'>[]{
 const arts=(json as {articles?:unknown[]})?.articles;if(!Array.isArray(arts))return [];
 return arts.flatMap(a=>{const x=a as {title?:string;description?:string;url?:string;publishedAt?:string;source?:{name?:string}};const url=httpsUrl(x.url??''),publishedAt=isoDate(x.publishedAt??'');
  return x.title&&url&&publishedAt?[{title:clip(decode(x.title),220),publisher:x.source?.name?.slice(0,80)||new URL(url).hostname,publishedAt,url,summary:clip(decode(x.description??''))}]:[]});
}
export function gnewsProvider(key:string):NewsProvider{return {name:'GNews',fetchNews:async()=>{
 const q=encodeURIComponent('Sensex OR Nifty OR RBI OR inflation OR "repo rate"');
 const r=await get(`https://gnews.io/api/v4/search?q=${q}&country=in&lang=en&sortby=publishedAt&max=10`,{headers:{'X-Api-Key':key}});
 if(!r.ok)throw new Error(`GNews HTTP ${r.status}`);
 return parseGnews(await r.json()).map((n,i)=>({...n,id:`W${i+1}`,topic:'Markets'}));
}}}

/** Combines feeds; keeps items from the two days up to the session (IST), newest first, de-duplicated. */
export function combineNews(providers:NewsProvider[]):NewsProvider{return {name:providers.map(p=>p.name).join(' + '),fetchNews:async(sessionDate)=>{
 const lists=await Promise.allSettled(providers.map(p=>p.fetchNews(sessionDate)));
 const start=Date.parse(`${sessionDate}T00:00:00+05:30`)-2*86400000,end=Date.parse(`${sessionDate}T23:59:59+05:30`)+18*3600000;
 const seen=new Set<string>();const all=lists.flatMap(l=>l.status==='fulfilled'?l.value:[]).filter(n=>{const t=Date.parse(n.publishedAt);return t>=start&&t<=end})
  .filter(n=>{const k=n.title.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();if(seen.has(k))return false;seen.add(k);return true})
  .sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 // Keep regulator items visible alongside market headlines.
 const official=all.filter(n=>n.publisher==='SEBI').slice(0,2),rest=all.filter(n=>n.publisher!=='SEBI').slice(0,8-official.length);
 return [...rest,...official].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt)).map((n,i)=>({...n,id:`N${i+1}`}));
}}}

export const NEWS_SOURCES:Record<string,Source>={
 GDELT:{name:'GDELT Project',url:'https://www.gdeltproject.org',attribution:'News discovery via the GDELT Project'},
 SEBI:{name:'SEBI RSS',url:'https://www.sebi.gov.in',attribution:'Official SEBI updates feed'},
 GNews:{name:'GNews',url:'https://gnews.io',attribution:'News search via GNews'},
};

export type ProviderStatus={ok:true;indices:IndexProvider;news:NewsProvider|null;newsSources:Source[]}|{ok:false;reason:string};
/**
 * Index data is enabled only when the operator confirms written permission to display it publicly.
 * Without that, refresh is refused and the site states the licensing blocker.
 */
export function configuredProviders(env:Record<string,string|undefined>=process.env):ProviderStatus{
 const token=env.EODHD_API_TOKEN?.trim();
 if(!token||env.MARKET_DATA_LICENSE_CONFIRMED!=='true')return {ok:false,reason:'Index data needs a source licensed for public display. Set EODHD_API_TOKEN and MARKET_DATA_LICENSE_CONFIRMED=true only after obtaining written permission.'};
 const providers:NewsProvider[]=[sebiNews];
 if(env.MARKET_PULSE_GDELT!=='false')providers.unshift(gdeltNews);
 if(env.GNEWS_API_KEY?.trim()&&env.GNEWS_USE_CONFIRMED==='true')providers.unshift(gnewsProvider(env.GNEWS_API_KEY.trim()));
 return {ok:true,indices:eodhdProvider(token,env.MARKET_DATA_ATTRIBUTION?.trim()||'End-of-day index data from EODHD'),news:combineNews(providers),newsSources:providers.map(p=>NEWS_SOURCES[p.name]).filter(Boolean)};
}
