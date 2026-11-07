'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import './market-pulse.css';
import {money} from '../lib/calc';
import {DEMO_INPUTS,exploreSip,type ExplorerInputs,type OptionId} from '../lib/market-pulse/sip-explorer';
import {periodStats,PERIODS,type DailyClose,type IndexId,type PeriodId} from '../lib/market-pulse/market';
import type {NewsItem} from '../lib/market-pulse/evidence';
import type {Brief} from '../lib/market-pulse/analyst';
import {monthlyStats,monthName} from '../lib/market-pulse/oecd';
import type {VideosResponse} from './api/market-pulse/videos/route';
import TradingViewWidget,{SENSEX_ATTRIBUTION,TvSingleTicker} from './TradingViewWidget';

import type {PulseResponse,Snapshot} from '../lib/market-pulse/types';
type Pulse=PulseResponse;

const API='/api/market-pulse';
const fmt=(n:number,dp=2)=>new Intl.NumberFormat('en-IN',{minimumFractionDigits:dp,maximumFractionDigits:dp}).format(n);
const signed=(n:number,dp=2)=>`${n>0?'+':n<0?'−':''}${fmt(Math.abs(n),dp)}`;
const day=(d:string)=>new Date(`${d.slice(0,10)}T00:00:00Z`).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'});
const stamp=(iso:string)=>new Date(iso).toLocaleString('en-IN',{day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',timeZone:'Asia/Kolkata'})+' IST';
const arrow=(d:'up'|'down'|'flat')=>d==='up'?'▲':d==='down'?'▼':'■';

export default function MarketPulse(){
 const [pulse,setPulse]=useState<Pulse|null>(null);
 useEffect(()=>{let live=true;fetch(API).then(r=>r.json()).then((x:Pulse)=>{if(live)setPulse(x)}).catch(()=>{if(live)setPulse({status:'error',message:'Market Pulse data could not be loaded. The SIP Decision Explorer below still works.'})});return()=>{live=false}},[]);
 const snap=pulse?.status==='ok'?pulse.snapshot:null;
 return <div className="mp">
  <div className="page-heading mp-heading"><div className="eyebrow"><span/>MARKET PULSE</div><h1>Understand the market. <em>Evaluate your options.</em></h1><p>Stay informed with end-of-day market context, explained with sources, next to a neutral comparison of your SIP choices.</p></div>
  <Hero pulse={pulse}/>
  <Explorer snap={snap}/>
  <History snap={snap}/>
  <News snap={snap}/>
  <Insight snap={snap}/>
  <section className="card mp-disclaimer" aria-labelledby="mp-disclaimer"><h2 id="mp-disclaimer">About Market Pulse</h2>
   <p>Market Pulse is an educational market-analysis and hypothetical SIP comparison tool in an independent student prototype. It is not affiliated with or endorsed by Groww, NSE or BSE. Market data is end-of-day, not live: SENSEX is displayed by TradingView's licensed widget (LifeFlow does not read or store it); NIFTY 50 is not shown, because no free source is licensed to display it; the AI brief uses only the OECD's monthly India share price index and publishers' own headlines from SEBI and the GDELT Project. It does not provide personalised investment recommendations, does not access any investment or bank account, and cannot pause, modify, stop or start a SIP, or buy, sell or redeem any investment. Past market movements do not indicate future returns. Check your platform or fund house, and consider a SEBI-registered adviser for personal advice.</p></section>
 </div>;
}

// ---------- Section 1: Daily Market Brief (hero) ----------
const NIFTY_TV='https://www.tradingview.com/symbols/NSE-NIFTY/';
/** Licensed mode shows verified closes. Otherwise: SENSEX through TradingView's licensed widget, and an honest NIFTY 50 card. */
function IndexCards({snap}:{snap:Snapshot|null}){
 if(snap&&snap.indices.length)return <div className="mp-indices">{snap.indices.map(({session:x})=><article key={x.id} className={`mp-index ${x.direction}`} aria-label={`${x.name}: closed at ${fmt(x.close)}, ${x.direction==='flat'?'unchanged':`${x.direction} ${fmt(Math.abs(x.change))} points, ${signed(x.changePct)} percent`} on ${day(x.sessionDate)}`}>
   <div className="mp-index-name">{x.name}{x.sessionDate!==snap.sessionDate&&<small> · {day(x.sessionDate)}</small>}</div>
   <div className="mp-index-close">{fmt(x.close)}</div>
   <div className="mp-index-change"><span aria-hidden="true">{arrow(x.direction)}</span> {signed(x.change)} <span>({signed(x.changePct)}%)</span></div>
   <dl><div><dt>Previous close</dt><dd>{fmt(x.previousClose)} <small>({day(x.previousDate)})</small></dd></div><div><dt>Source</dt><dd><a href={x.source.url} target="_blank" rel="noreferrer">{x.source.name} ↗</a></dd></div></dl>
  </article>)}</div>;
 return <div className="mp-indices mp-indices-open">
  <article className="mp-index mp-index-tv" aria-labelledby="mp-sensex-h">
   <div className="mp-index-name" id="mp-sensex-h">BSE SENSEX <small>· end of day, via TradingView</small></div>
   <TvSingleTicker symbol="BSE:SENSEX" label="BSE SENSEX end-of-day quote from TradingView"/>
   <p className="mp-tv-note">Shown and licensed by TradingView, not read by LifeFlow, so the AI brief never quotes it.</p>
  </article>
  <article className="mp-index mp-index-na" aria-labelledby="mp-nifty-h">
   <div className="mp-index-name" id="mp-nifty-h">NIFTY 50</div>
   <p className="mp-na-title">Not shown on this free site</p>
   <p>NIFTY 50 values need a licence from NSE Indices for public display, and no free widget or API is permitted to show them. Nothing is estimated in their place.</p>
   <a href={NIFTY_TV} target="_blank" rel="noreferrer">View NIFTY 50 on TradingView ↗</a>
  </article>
 </div>;
}
function Hero({pulse}:{pulse:Pulse|null}){
 const snap=pulse?.status==='ok'?pulse.snapshot:null;
 const open=!!snap&&!snap.indices.length;
 return <section className="mp-hero" aria-labelledby="mp-brief" aria-busy={!pulse}>
  <div className="mp-hero-top"><div><h2 id="mp-brief" className="mp-hero-title">Daily Market Brief</h2>
   <p className="mp-hero-sub">{snap?<>{open?'Brief for':'Latest completed trading session ·'} <b>{day(snap.sessionDate)}</b></>:'Latest end-of-day market context'}</p></div>
   <div className="mp-badges"><span className="mp-badge">End-of-day data · not live</span>
    {pulse?.status==='ok'&&!open&&<span className={`mp-badge ${pulse.freshness.status}`}>{pulse.freshness.status==='current'?'Latest session':pulse.freshness.status==='possibly-stale'?'May be one session behind (or a market holiday)':`Stale: ${pulse.freshness.weekdaysBehind} weekdays behind`}</span>}</div></div>
  {pulse?.status==='ok'&&pulse.freshness.status==='stale'&&<p className="mp-stale" role="status">The latest refresh did not complete, so this is the last verified brief ({day(pulse.snapshot.sessionDate)}). Figures are not updated or estimated.</p>}
  <IndexCards snap={snap}/>
  {pulse?.status==='ok'?<Verdict pulse={pulse}/>:<div className="mp-unavailable" role="status"><b>{pulse?'The daily AI brief is not available right now.':'Loading the daily brief…'}</b>{pulse&&<p>{pulse.message}</p>}{pulse&&<p>The SENSEX widget above and the SIP Decision Explorer below work without it.</p>}</div>}
 </section>;
}
function Verdict({pulse}:{pulse:Extract<Pulse,{status:'ok'}>}){
 const s=pulse.snapshot,b=s.brief;
 return <><div className="mp-verdict">
   <div className="mp-verdict-label">{b.kind==='ai'?<><span className="mp-pill ai">AI market verdict</span> passed every Market Pulse check · {b.model}</>:<><span className="mp-pill facts">Verified facts summary · not AI</span>{b.fallbackReason}</>}</div>
   <h3>{b.headline}</h3><p>{b.summary}</p>
   {b.analysis?.context.length?<ul className="mp-dev">{b.analysis.context.slice(0,2).map((c,i)=><li key={i}>{c.text} <Cites ids={c.supports} news={s.news}/></li>)}</ul>:null}
   <div className="mp-uncertain"><b>What remains uncertain</b>{b.analysis?<ul>{b.analysis.uncertainty.slice(0,2).map((u,i)=><li key={i}>{u}</li>)}</ul>:<p>{b.note}</p>}</div>
  </div>
  <div className="mp-evidence"><b>Evidence</b><ul>
   {s.sources.map(x=><li key={x.url}><a href={x.url} target="_blank" rel="noreferrer">{x.name} ↗</a> <small>{x.attribution}</small></li>)}
   {citedNews(b,s.news).map(n=><li key={n.id}><a href={n.url} target="_blank" rel="noreferrer">{n.publisher}: {n.title} ↗</a> <small>{day(n.publishedAt)}</small></li>)}
  </ul><small>Last successful update: {stamp(s.updatedAt)}{pulse.checkedAt&&pulse.checkedAt!==s.updatedAt?<> · Last checked: {stamp(pulse.checkedAt)}</>:null}{pulse.lastRunFailed?<> · The latest scheduled refresh did not complete; this is the last verified brief.</>:null}</small></div></>;
}
const citedNews=(b:Brief,news:NewsItem[])=>{const ids=new Set(b.analysis?[b.analysis.verdict_summary,...b.analysis.context].flatMap(c=>c.supports):[]);return news.filter(n=>ids.has(n.id))};
function Cites({ids,news}:{ids:string[];news:NewsItem[]}){const n=news.filter(x=>ids.includes(x.id));return n.length?<span className="mp-cite">{n.map(x=><a key={x.id} href={x.url} target="_blank" rel="noreferrer">[{x.publisher}]</a>)}</span>:null}

// ---------- Section 2: SIP Decision Explorer ----------
const FIELDS:[keyof ExplorerInputs,string,string][]=[['salary','Monthly salary (₹)','Take-home pay'],['essentials','Essential monthly expenses (₹)','Rent, food, bills, EMIs'],['sip','Current monthly SIP (₹)',''],['emergency','Available emergency savings (₹)',''],['reducedSip','Proposed reduced SIP (₹)','For the Reduce option'],['extraExpense','Additional monthly expense (₹)','Optional'],['pauseMonths','Pause length (months)','For the Pause option, 1–24']];
function Explorer({snap}:{snap:Snapshot|null}){
 const [vals,setVals]=useState<Record<string,string>>(()=>Object.fromEntries(Object.entries(DEMO_INPUTS).map(([k,v])=>[k,String(v)])));
 const r=useMemo(()=>exploreSip(vals),[vals]);
 const [focus,setFocus]=useState<OptionId>('continue');
 const nifty=snap?.indices.find(i=>i.session.id==='nifty50')?.session;
 const ms=!nifty&&snap?.monthly?monthlyStats(snap.monthly.points):null;
 const max=r.ok?Math.max(1,...r.options.map(o=>Math.abs(o.remaining)+o.contribution)):1;
 return <section className="card mp-explorer" aria-labelledby="mp-explore">
  <h2 id="mp-explore">Explore Your SIP Options</h2>
  <p className="mp-lead">Compare how different SIP contribution choices could affect your monthly cash flow. These are educational scenarios, not investment recommendations.</p>
  {nifty&&<p className="mp-connect">{nifty.direction==='flat'?`${nifty.name} closed unchanged`:`${nifty.name} ${nifty.direction==='up'?'rose':'declined'} ${fmt(Math.abs(nifty.changePct))}%`} during the latest completed session ({day(nifty.sessionDate)}). Continuing SIP contributions maintains periodic market exposure, while pausing or stopping reduces new contributions. The considerations include cash-flow affordability, emergency savings, investment horizon and uncertainty. A single session’s move does not indicate what markets will do next.</p>}
  {!nifty&&<p className="mp-connect">{ms?<>India’s share price index (OECD, monthly) {ms.direction==='flat'?'was unchanged':ms.direction==='up'?`rose ${fmt(Math.abs(ms.changePct))}%`:`fell ${fmt(Math.abs(ms.changePct))}%`} in {monthName(ms.latest.period)}. </>:null}Markets rise and fall. Continuing SIP contributions maintains periodic market exposure, while pausing or stopping reduces new contributions. The considerations include cash-flow affordability, emergency savings, investment horizon and uncertainty. A single period’s move does not indicate what markets will do next.</p>}
  <div className="mp-inputs"><p className="mp-demo">Hypothetical demonstration figures; change them freely. Nothing is saved or sent.</p>
   {FIELDS.map(([k,label,hint])=><label key={k} className="field"><span>{label}</span><input type="number" inputMode="decimal" min={0} step={k==='pauseMonths'?1:100} value={vals[k]} onChange={e=>setVals(v=>({...v,[k]:e.target.value}))} aria-describedby={hint?`hint-${k}`:undefined}/><small id={`hint-${k}`} aria-hidden={hint?undefined:true}>{hint||' '}</small></label>)}</div>
  {!r.ok?<div className="mp-errors" role="alert"><b>Check your inputs</b><ul>{r.errors.map(e=><li key={e}>{e}</li>)}</ul></div>:<>
   <div className="mp-baseline" aria-live="polite">Current plan: {money(r.baseline.income)} income − {money(r.inputs.essentials+r.inputs.extraExpense)} expenses − {money(r.inputs.sip)} SIP = <b>{money(r.baseline.remaining)}</b> remaining a month
    {r.emergency.monthsOfEssentials!==null&&<> · Emergency savings cover about <b>{fmt(r.emergency.monthsOfEssentials,1)} months</b> of essential and additional expenses</>}
    {r.emergency.shortfallMonthsCovered!==null&&<> · They would cover the monthly shortfall for about <b>{fmt(r.emergency.shortfallMonthsCovered,1)} months</b></>}</div>
   <div className="mp-options" role="tablist" aria-label="SIP options">{r.options.map(o=><button key={o.id} role="tab" aria-selected={focus===o.id} aria-controls="mp-option-detail" id={`opt-${o.id}`} className={`mp-option${focus===o.id?' on':''}`} onClick={()=>setFocus(o.id)}>
    <span className="mp-option-title">{o.title}</span>
    <span className="mp-option-row"><small>SIP</small><b>{money(o.contribution)}</b></span>
    <span className="mp-option-row"><small>Remaining</small><b className={o.remaining<0?'neg':''}>{money(o.remaining)}</b></span>
    <span className="mp-option-row"><small>vs current</small><b>{o.difference===0?'—':`${o.difference>0?'+':'−'}${money(Math.abs(o.difference))}`}</b></span>
    <span className="mp-bar" aria-hidden="true"><i className="sip" style={{width:`${o.contribution/max*100}%`}}/><i className={o.remaining<0?'neg':'cash'} style={{width:`${Math.abs(o.remaining)/max*100}%`}}/></span>
   </button>)}</div>
   <p className="mp-legend" aria-hidden="true"><i className="sip"/> SIP contribution <i className="cash"/> Remaining cash <i className="neg"/> Shortfall</p>
   {r.options.filter(o=>o.id===focus).map(o=><div key={o.id} id="mp-option-detail" role="tabpanel" aria-labelledby={`opt-${o.id}`} className="mp-detail"><h3>{o.title}: what changes</h3><ul>{o.tradeOffs.map(t=><li key={t}>{t}</li>)}</ul>
    {o.notContributed!==null&&o.notContributed>0&&<p className="mp-small">{o.id==='pause'?`Contributions not made over a ${r.inputs.pauseMonths}-month pause: ${money(o.notContributed)}.`:`Contribution reduced by ${money(o.notContributed)} a month.`}</p>}</div>)}
   <ul className="mp-notes">{r.notes.map(n=><li key={n}>{n}</li>)}</ul></>}
 </section>;
}

// ---------- Section 3: Historical Market Trends ----------
function History({snap}:{snap:Snapshot|null}){
 return <section className="card mp-history" aria-labelledby="mp-hist"><h2 id="mp-hist">Historical Market Trends</h2>
  {snap&&snap.indices.length?<VerifiedHistory snap={snap}/>:<>
   <h3 id="mp-sensex-chart">BSE SENSEX: 1 month to 1 year (end of day, TradingView)</h3>
   <TradingViewWidget kind="symbol-overview" title="BSE SENSEX history chart from TradingView" height={440} attribution={SENSEX_ATTRIBUTION}
    config={{symbols:[['BSE:SENSEX|12M']],chartOnly:false,width:'100%',height:'100%',locale:'en',colorTheme:'light',autosize:true,showVolume:false,chartType:'area',dateRanges:['1m|1D','3m|1D','6m|1D','12m|1D']}}/>
   <p className="mp-small">Use the 1M, 3M, 6M and 12M tabs inside the chart. The chart is displayed by TradingView in your browser, which receives your IP address and this page’s address. LifeFlow does not read or store its values. NIFTY 50 history isn’t available to embed on a free site.</p>
   {snap?.monthly&&snap.monthly.points.length>1?<MonthlyHistory m={snap.monthly}/>:null}
  </>}
 </section>;
}
function MonthlyHistory({m}:{m:NonNullable<Snapshot['monthly']>}){
 const [years,setYears]=useState(1);
 const pts=m.points.slice(-(years*12+1)).map(p=>({date:`${p.period}-01`,close:p.value}));
 const st=monthlyStats(m.points);
 return <div className="mp-monthly"><h3>India’s share price index (OECD, monthly, 2015 = 100)</h3>
  <p className="mp-small">A broad monthly index of Indian share prices from the OECD. It is not the NIFTY 50 or SENSEX level and not a daily close. It is the only market series LifeFlow verifies and lets the AI cite.</p>
  <div className="mp-controls"><div role="group" aria-label="Period">{[1,3,5].map(y=><button key={y} aria-pressed={years===y} disabled={m.points.length<y*12+1} onClick={()=>setYears(y)}>{y}Y</button>)}</div></div>
  {st&&<div className="mp-stats"><div><small>Latest month</small><b>{fmt(st.latest.value)} <span>{monthName(st.latest.period)}</span></b></div><div><small>Change from previous month</small><b className={st.changePct<0?'neg':'pos'}>{signed(st.changePct)}%</b></div>{st.change12m!==null&&<div><small>Change over 12 months</small><b className={st.change12m<0?'neg':'pos'}>{signed(st.change12m)}%</b></div>}</div>}
  <Chart points={pts} name="India share price index (OECD)" label={d=>monthName(d.slice(0,7))} verb="was"/>
  <p className="mp-small">Source: <a href={m.source.url} target="_blank" rel="noreferrer">{m.source.name} ↗</a> · {m.source.attribution}</p>
 </div>;
}
function VerifiedHistory({snap}:{snap:Snapshot}){
 const [id,setId]=useState<IndexId>('nifty50');const [period,setPeriod]=useState<PeriodId>('3M');
 const series=snap.indices.find(i=>i.session.id===id);
 const available=useMemo(()=>series?PERIODS.filter(p=>periodStats(series.closes,p.id)):[],[series]);
 const active=available.find(p=>p.id===period)?.id??available.at(-1)?.id;
 const stats=series&&active?periodStats(series.closes,active):null;
 const points=series&&stats?series.closes.filter(c=>c.date>=stats.from):[];
 return <>
   <div className="mp-controls"><div role="group" aria-label="Index">{snap.indices.map(i=><button key={i.session.id} aria-pressed={id===i.session.id} onClick={()=>setId(i.session.id)}>{i.session.name}</button>)}</div>
    <div role="group" aria-label="Period">{PERIODS.map(p=><button key={p.id} aria-pressed={active===p.id} disabled={!available.some(a=>a.id===p.id)} onClick={()=>setPeriod(p.id)} title={available.some(a=>a.id===p.id)?undefined:'Not enough history from the data source'}>{p.id}</button>)}</div></div>
   {stats&&series?<><div className="mp-stats"><div><small>Period change</small><b className={stats.change<0?'neg':'pos'}>{signed(stats.change)} ({signed(stats.changePct)}%)</b></div><div><small>From → to</small><b>{day(stats.from)} → {day(stats.to)}</b></div><div><small>High</small><b>{fmt(stats.high.close)} <span>{day(stats.high.date)}</span></b></div><div><small>Low</small><b>{fmt(stats.low.close)} <span>{day(stats.low.date)}</span></b></div></div>
    <Chart points={points} name={series.session.name}/>
    <p className="mp-small">Daily closing values. Source: <a href={series.session.source.url} target="_blank" rel="noreferrer">{series.session.source.name} ↗</a> · {series.session.source.attribution}</p></>:<p className="mp-empty">The data source does not provide enough history for these periods.</p>}
 </>;
}
function Chart({points,name,label=day,verb='closed at'}:{points:DailyClose[];name:string;label?:(d:string)=>string;verb?:string}){
 const [i,setI]=useState(points.length-1);const ref=useRef<SVGSVGElement>(null);
 useEffect(()=>setI(points.length-1),[points]);
 if(points.length<2)return null;
 const W=640,H=230,P={l:8,r:8,t:16,b:24};const lo=Math.min(...points.map(p=>p.close)),hi=Math.max(...points.map(p=>p.close));const span=hi-lo||1;
 const x=(k:number)=>P.l+k/(points.length-1)*(W-P.l-P.r),y=(v:number)=>P.t+(1-(v-lo)/span)*(H-P.t-P.b);
 const d=points.map((p,k)=>`${k?'L':'M'}${x(k).toFixed(1)},${y(p.close).toFixed(1)}`).join('');
 const sel=points[Math.min(i,points.length-1)];const up=points.at(-1)!.close>=points[0].close;
 const pick=(clientX:number)=>{const r=ref.current?.getBoundingClientRect();if(!r)return;const k=Math.round((clientX-r.left)/r.width*W/((W-P.l-P.r)/(points.length-1)));setI(Math.max(0,Math.min(points.length-1,k)))};
 return <figure className="mp-chart"><svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} from ${label(points[0].date)} to ${label(points.at(-1)!.date)}. Use the left and right arrow keys to read each value.`} tabIndex={0}
  onPointerMove={e=>pick(e.clientX)} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();setI(k=>Math.max(0,k-1))}if(e.key==='ArrowRight'){e.preventDefault();setI(k=>Math.min(points.length-1,k+1))}if(e.key==='Home')setI(0);if(e.key==='End')setI(points.length-1)}}>
  <defs><linearGradient id="mp-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={up?'#2bb5c9':'#e58b8b'} stopOpacity=".28"/><stop offset="1" stopColor={up?'#2bb5c9':'#e58b8b'} stopOpacity="0"/></linearGradient></defs>
  {[0,.5,1].map(t=><line key={t} x1={P.l} x2={W-P.r} y1={P.t+t*(H-P.t-P.b)} y2={P.t+t*(H-P.t-P.b)} className="mp-grid"/>)}
  <path d={`${d}L${x(points.length-1)},${H-P.b}L${x(0)},${H-P.b}Z`} fill="url(#mp-fill)"/>
  <path d={d} className={`mp-line ${up?'up':'down'}`}/>
  <line x1={x(i)} x2={x(i)} y1={P.t} y2={H-P.b} className="mp-cursor"/><circle cx={x(i)} cy={y(sel.close)} r="4.5" className="mp-dot"/>
  <text x={P.l} y={H-6} className="mp-axis">{label(points[0].date)}</text><text x={W-P.r} y={H-6} textAnchor="end" className="mp-axis">{label(points.at(-1)!.date)}</text>
 </svg><figcaption aria-live="polite"><b>{label(sel.date)}</b> · {name} {verb} <b>{fmt(sel.close)}</b> · range shown {fmt(lo)} – {fmt(hi)}</figcaption></figure>;
}

// ---------- Section 4: Verified Financial News ----------
function News({snap}:{snap:Snapshot|null}){
 return <section className="card mp-news" aria-labelledby="mp-news-h"><h2 id="mp-news-h">Verified Financial News</h2>
  {!snap?<p className="mp-empty">News appears with the daily market data.</p>:!snap.news.length?<p className="mp-empty">No news items were retrieved for this session. Headlines are never written by AI.</p>:<>
   <p className="mp-small">Headlines and summaries are the publishers’ own, from their public feeds. Market Pulse does not claim any of these caused the market move unless a cited source says so.</p>
   <ul className="mp-news-list">{snap.news.map(n=><li key={n.id}><a href={n.url} target="_blank" rel="noreferrer">{n.title} ↗</a><small>{n.publisher} · {day(n.publishedAt)}</small>{n.summary&&<p>{n.summary}</p>}</li>)}</ul></>}
  <MarketVideos/>
 </section>;
}
/**
 * Market videos from official YouTube channels, in their own block (YouTube results are never mixed with other news),
 * with titles unmodified and YouTube credited. Hidden entirely until a YouTube API key is configured on the server.
 */
function MarketVideos(){
 const [v,setV]=useState<VideosResponse|null>(null);
 useEffect(()=>{let live=true;fetch('/api/market-pulse/videos').then(r=>r.json()).then((x:VideosResponse)=>{if(live)setV(x)}).catch(()=>{if(live)setV({status:'error'})});return()=>{live=false}},[]);
 if(!v||v.status==='not_configured')return null;
 return <div className="mp-videos" aria-labelledby="mp-videos-h">
  <h3 id="mp-videos-h">Market videos <span>· from YouTube</span></h3>
  {v.status==='error'?<p className="mp-empty">Market videos could not be loaded right now.</p>:!v.videos.length?<p className="mp-empty">No market videos from these channels in the last three days.</p>:
   <ul className="mp-video-list">{v.videos.map(x=><li key={x.videoId}>
    <a href={x.url} target="_blank" rel="noreferrer">{x.thumbnail&&<img src={x.thumbnail} alt="" loading="lazy" width={160} height={90}/>}<span className="mp-video-title">{x.title}</span></a>
    <small>{x.channel} · {stamp(x.publishedAt)}</small></li>)}</ul>}
  {v.status==='ok'&&<p className="mp-small">Latest Indian market videos from {v.channels.map((c,i)=><span key={c.url}>{i?' and ':''}<a href={c.url} target="_blank" rel="noreferrer">{c.name}</a></span>)} on YouTube, selected by topic; titles are the channels’ own and are not used by the AI. Stock-tip videos are left out. Videos open on YouTube, where <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube’s Terms of Service</a> and the <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy Policy</a> apply.{v.partial?' One channel could not be reached this hour.':''}</p>}
 </div>;
}

// ---------- Section 5: Expanded AI Market Insight ----------
function Insight({snap}:{snap:Snapshot|null}){
 if(!snap)return null;const a=snap.brief.analysis;
 const stats=snap.indices.map(i=>({name:i.session.name,s:periodStats(i.closes,'1Y')}));
 return <section className="card mp-insight" aria-labelledby="mp-insight-h"><details><summary><h2 id="mp-insight-h">Expanded AI Market Insight</h2><span>{a?'AI-generated, checked against verified facts and cited news':'AI insight unavailable for this session · verified facts only'}</span></summary>
  {a?<div className="mp-insight-body">
   <Block title="What happened in the market" items={a.market_facts} news={snap.news}/>
   <Block title="Reported developments" items={a.context} news={snap.news} empty="No developments in the retrieved news could be linked to this session."/>
   <Block title="Historical volatility context" items={a.history_context} news={snap.news}/>
   <Block title="What this means for periodic investing (educational)" items={a.sip_education} news={snap.news}/>
   <div><h3>Important uncertainties</h3><ul>{a.uncertainty.map((u,k)=><li key={k}>{u}</li>)}</ul></div>
   <div><h3>Checks passed</h3><ul className="mp-checks">{snap.brief.checks.map(c=><li key={c.id}>✓ {c.label}</li>)}</ul></div>
  </div>:<div className="mp-insight-body"><p>{snap.brief.fallbackReason} The figures below are calculated by LifeFlow from the source data.</p>
   {snap.brief.checks.length>0&&<div><h3>Checks that did not pass</h3><ul>{snap.brief.checks.filter(c=>!c.passed).map(c=><li key={c.id}>✗ {c.label}</li>)}</ul></div>}</div>}
  {snap.monthly&&!snap.indices.length&&(()=>{const st=monthlyStats(snap.monthly!.points);return st?<div className="mp-insight-body"><h3>Monthly context (calculated from OECD data)</h3><ul><li>India’s share price index was {fmt(st.latest.value)} in {monthName(st.latest.period)}, {signed(st.changePct)}% from {monthName(st.previous.period)}.</li>{st.change3m!==null&&<li>Over 3 months: {signed(st.change3m)}%.</li>}{st.change12m!==null&&<li>Over 12 months: {signed(st.change12m)}%.</li>}{st.high12m&&st.low12m&&<li>12-month range: {fmt(st.low12m.value)} ({monthName(st.low12m.period)}) to {fmt(st.high12m.value)} ({monthName(st.high12m.period)}).</li>}</ul></div>:null})()}
  {snap.indices.length>0&&<div className="mp-insight-body"><h3>One-year context (calculated)</h3><ul>{stats.filter(x=>x.s).map(({name,s})=><li key={name}>{name}: {signed(s!.changePct)}% from {day(s!.from)} to {day(s!.to)}; range {fmt(s!.low.close)} – {fmt(s!.high.close)}; {s!.daysAbove1Pct} of {s!.sessions} sessions moved 1% or more{s!.largestFall?`; largest one-session fall ${signed(s!.largestFall.pct)}% on ${day(s!.largestFall.date)}`:''}.</li>)}</ul></div>}
 </details></section>;
}
function Block({title,items,news,empty}:{title:string;items:{text:string;supports:string[]}[];news:NewsItem[];empty?:string}){
 return <div><h3>{title}</h3>{items.length?<ul>{items.map((c,k)=><li key={k}>{c.text} <Cites ids={c.supports} news={news}/></li>)}</ul>:<p>{empty??'Nothing to add from the verified evidence.'}</p>}</div>;
}
