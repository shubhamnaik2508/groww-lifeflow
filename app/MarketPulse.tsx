'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import './market-pulse.css';
import {money} from '../lib/calc';
import {DEMO_INPUTS,exploreSip,type ExplorerInputs,type OptionId} from '../lib/market-pulse/sip-explorer';
import {periodStats,PERIODS,type DailyClose,type IndexId,type PeriodId} from '../lib/market-pulse/market';
import type {NewsItem} from '../lib/market-pulse/evidence';
import type {Brief} from '../lib/market-pulse/analyst';

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
  <div className="page-heading mp-heading"><div className="eyebrow"><span/>MARKET PULSE</div><h1>Understand the market. <em>Evaluate your options.</em></h1><p>Stay informed with the latest completed Indian trading session, explained with sources, next to a neutral comparison of your SIP choices.</p></div>
  <Hero pulse={pulse}/>
  <Explorer snap={snap}/>
  <History snap={snap}/>
  <News snap={snap}/>
  <Insight snap={snap}/>
  <section className="card mp-disclaimer" aria-labelledby="mp-disclaimer"><h2 id="mp-disclaimer">About Market Pulse</h2>
   <p>Market Pulse is an educational market-analysis and hypothetical SIP comparison tool in an independent student prototype. It is not affiliated with or endorsed by Groww, NSE or BSE. It shows end-of-day data from the latest completed trading session, not live prices. It does not provide personalised investment recommendations, does not access any investment or bank account, and cannot pause, modify, stop or start a SIP, or buy, sell or redeem any investment. Past market movements do not indicate future returns. Check your platform or fund house, and consider a SEBI-registered adviser for personal advice.</p></section>
 </div>;
}

// ---------- Section 1: Daily Market Brief (hero) ----------
function Hero({pulse}:{pulse:Pulse|null}){
 if(!pulse)return <section className="mp-hero" aria-labelledby="mp-brief" aria-busy="true"><h2 id="mp-brief" className="mp-hero-title">Daily Market Brief</h2><p className="mp-hero-sub">Loading the latest completed trading session…</p></section>;
 if(pulse.status!=='ok')return <section className="mp-hero" aria-labelledby="mp-brief"><h2 id="mp-brief" className="mp-hero-title">Daily Market Brief</h2>
  <div className="mp-unavailable" role="status"><b>Market data is not available right now.</b><p>{pulse.message}</p><p>No figures are shown rather than estimated ones. The SIP Decision Explorer below works without market data.</p>
   <p>Official index information: <a href="https://www.nseindia.com" target="_blank" rel="noreferrer">NSE (NIFTY 50) ↗</a> · <a href="https://www.bseindia.com" target="_blank" rel="noreferrer">BSE (SENSEX) ↗</a></p></div></section>;
 const {snapshot:s,freshness:f}=pulse;const b=s.brief;
 return <section className="mp-hero" aria-labelledby="mp-brief">
  <div className="mp-hero-top"><div><h2 id="mp-brief" className="mp-hero-title">Daily Market Brief</h2>
   <p className="mp-hero-sub">Latest completed trading session · <b>{day(s.sessionDate)}</b></p></div>
   <div className="mp-badges"><span className="mp-badge">End-of-day data · not live</span>
    <span className={`mp-badge ${f.status}`}>{f.status==='current'?'Latest session':f.status==='possibly-stale'?'May be one session behind (or a market holiday)':`Stale: ${f.weekdaysBehind} weekdays behind`}</span></div></div>
  {f.status==='stale'&&<p className="mp-stale" role="status">The latest refresh did not complete, so this is the last verified session ({day(s.sessionDate)}). Figures are not updated or estimated.</p>}
  <div className="mp-indices">{s.indices.map(({session:x})=><article key={x.id} className={`mp-index ${x.direction}`} aria-label={`${x.name}: closed at ${fmt(x.close)}, ${x.direction==='flat'?'unchanged':`${x.direction} ${fmt(Math.abs(x.change))} points, ${signed(x.changePct)} percent`} on ${day(x.sessionDate)}`}>
   <div className="mp-index-name">{x.name}{x.sessionDate!==s.sessionDate&&<small> · {day(x.sessionDate)}</small>}</div>
   <div className="mp-index-close">{fmt(x.close)}</div>
   <div className="mp-index-change"><span aria-hidden="true">{arrow(x.direction)}</span> {signed(x.change)} <span>({signed(x.changePct)}%)</span></div>
   <dl><div><dt>Previous close</dt><dd>{fmt(x.previousClose)} <small>({day(x.previousDate)})</small></dd></div><div><dt>Source</dt><dd><a href={x.source.url} target="_blank" rel="noreferrer">{x.source.name} ↗</a></dd></div></dl>
  </article>)}</div>
  <div className="mp-verdict">
   <div className="mp-verdict-label">{b.kind==='ai'?<><span className="mp-pill ai">AI market verdict</span> passed every Market Pulse check · {b.model}</>:<><span className="mp-pill facts">Verified facts summary · not AI</span>{b.fallbackReason}</>}</div>
   <h3>{b.headline}</h3><p>{b.summary}</p>
   {b.analysis?.context.length?<ul className="mp-dev">{b.analysis.context.slice(0,2).map((c,i)=><li key={i}>{c.text} <Cites ids={c.supports} news={s.news}/></li>)}</ul>:null}
   <div className="mp-uncertain"><b>What remains uncertain</b>{b.analysis?<ul>{b.analysis.uncertainty.slice(0,2).map((u,i)=><li key={i}>{u}</li>)}</ul>:<p>{b.note}</p>}</div>
  </div>
  <div className="mp-evidence"><b>Evidence</b><ul>
   {s.sources.map(x=><li key={x.url}><a href={x.url} target="_blank" rel="noreferrer">{x.name} ↗</a> <small>{x.attribution}</small></li>)}
   {citedNews(b,s.news).map(n=><li key={n.id}><a href={n.url} target="_blank" rel="noreferrer">{n.publisher}: {n.title} ↗</a> <small>{day(n.publishedAt)}</small></li>)}
  </ul><small>Last successful update: {stamp(s.updatedAt)}</small></div>
 </section>;
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
 const max=r.ok?Math.max(1,...r.options.map(o=>Math.abs(o.remaining)+o.contribution)):1;
 return <section className="card mp-explorer" aria-labelledby="mp-explore">
  <h2 id="mp-explore">Explore Your SIP Options</h2>
  <p className="mp-lead">Compare how different SIP contribution choices could affect your monthly cash flow. These are educational scenarios, not investment recommendations.</p>
  {nifty&&<p className="mp-connect">{nifty.direction==='flat'?`${nifty.name} closed unchanged`:`${nifty.name} ${nifty.direction==='up'?'rose':'declined'} ${fmt(Math.abs(nifty.changePct))}%`} during the latest completed session ({day(nifty.sessionDate)}). Continuing SIP contributions maintains periodic market exposure, while pausing or stopping reduces new contributions. The considerations include cash-flow affordability, emergency savings, investment horizon and uncertainty. A single session’s move does not indicate what markets will do next.</p>}
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
 const [id,setId]=useState<IndexId>('nifty50');const [period,setPeriod]=useState<PeriodId>('3M');
 const series=snap?.indices.find(i=>i.session.id===id);
 const available=useMemo(()=>series?PERIODS.filter(p=>periodStats(series.closes,p.id)):[],[series]);
 const active=available.find(p=>p.id===period)?.id??available.at(-1)?.id;
 const stats=series&&active?periodStats(series.closes,active):null;
 const points=series&&stats?series.closes.filter(c=>c.date>=stats.from):[];
 return <section className="card mp-history" aria-labelledby="mp-hist"><h2 id="mp-hist">Historical Market Trends</h2>
  {!snap?<p className="mp-empty">Historical data appears once the daily market data is available. No sample or illustrative chart is shown.</p>:<>
   <div className="mp-controls"><div role="group" aria-label="Index">{snap.indices.map(i=><button key={i.session.id} aria-pressed={id===i.session.id} onClick={()=>setId(i.session.id)}>{i.session.name}</button>)}</div>
    <div role="group" aria-label="Period">{PERIODS.map(p=><button key={p.id} aria-pressed={active===p.id} disabled={!available.some(a=>a.id===p.id)} onClick={()=>setPeriod(p.id)} title={available.some(a=>a.id===p.id)?undefined:'Not enough history from the data source'}>{p.id}</button>)}</div></div>
   {stats&&series?<><div className="mp-stats"><div><small>Period change</small><b className={stats.change<0?'neg':'pos'}>{signed(stats.change)} ({signed(stats.changePct)}%)</b></div><div><small>From → to</small><b>{day(stats.from)} → {day(stats.to)}</b></div><div><small>High</small><b>{fmt(stats.high.close)} <span>{day(stats.high.date)}</span></b></div><div><small>Low</small><b>{fmt(stats.low.close)} <span>{day(stats.low.date)}</span></b></div></div>
    <Chart points={points} name={series.session.name}/>
    <p className="mp-small">Daily closing values. Source: <a href={series.session.source.url} target="_blank" rel="noreferrer">{series.session.source.name} ↗</a> · {series.session.source.attribution}</p></>:<p className="mp-empty">The data source does not provide enough history for these periods.</p>}</>}
 </section>;
}
function Chart({points,name}:{points:DailyClose[];name:string}){
 const [i,setI]=useState(points.length-1);const ref=useRef<SVGSVGElement>(null);
 useEffect(()=>setI(points.length-1),[points]);
 if(points.length<2)return null;
 const W=640,H=230,P={l:8,r:8,t:16,b:24};const lo=Math.min(...points.map(p=>p.close)),hi=Math.max(...points.map(p=>p.close));const span=hi-lo||1;
 const x=(k:number)=>P.l+k/(points.length-1)*(W-P.l-P.r),y=(v:number)=>P.t+(1-(v-lo)/span)*(H-P.t-P.b);
 const d=points.map((p,k)=>`${k?'L':'M'}${x(k).toFixed(1)},${y(p.close).toFixed(1)}`).join('');
 const sel=points[Math.min(i,points.length-1)];const up=points.at(-1)!.close>=points[0].close;
 const pick=(clientX:number)=>{const r=ref.current?.getBoundingClientRect();if(!r)return;const k=Math.round((clientX-r.left)/r.width*W/((W-P.l-P.r)/(points.length-1)));setI(Math.max(0,Math.min(points.length-1,k)))};
 return <figure className="mp-chart"><svg ref={ref} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${name} daily closes from ${day(points[0].date)} to ${day(points.at(-1)!.date)}. Use the left and right arrow keys to read each session.`} tabIndex={0}
  onPointerMove={e=>pick(e.clientX)} onKeyDown={e=>{if(e.key==='ArrowLeft'){e.preventDefault();setI(k=>Math.max(0,k-1))}if(e.key==='ArrowRight'){e.preventDefault();setI(k=>Math.min(points.length-1,k+1))}if(e.key==='Home')setI(0);if(e.key==='End')setI(points.length-1)}}>
  <defs><linearGradient id="mp-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor={up?'#2bb5c9':'#e58b8b'} stopOpacity=".28"/><stop offset="1" stopColor={up?'#2bb5c9':'#e58b8b'} stopOpacity="0"/></linearGradient></defs>
  {[0,.5,1].map(t=><line key={t} x1={P.l} x2={W-P.r} y1={P.t+t*(H-P.t-P.b)} y2={P.t+t*(H-P.t-P.b)} className="mp-grid"/>)}
  <path d={`${d}L${x(points.length-1)},${H-P.b}L${x(0)},${H-P.b}Z`} fill="url(#mp-fill)"/>
  <path d={d} className={`mp-line ${up?'up':'down'}`}/>
  <line x1={x(i)} x2={x(i)} y1={P.t} y2={H-P.b} className="mp-cursor"/><circle cx={x(i)} cy={y(sel.close)} r="4.5" className="mp-dot"/>
  <text x={P.l} y={H-6} className="mp-axis">{day(points[0].date)}</text><text x={W-P.r} y={H-6} textAnchor="end" className="mp-axis">{day(points.at(-1)!.date)}</text>
 </svg><figcaption aria-live="polite"><b>{day(sel.date)}</b> · {name} closed at <b>{fmt(sel.close)}</b> · range shown {fmt(lo)} – {fmt(hi)}</figcaption></figure>;
}

// ---------- Section 4: Verified Financial News ----------
function News({snap}:{snap:Snapshot|null}){
 return <section className="card mp-news" aria-labelledby="mp-news-h"><h2 id="mp-news-h">Verified Financial News</h2>
  {!snap?<p className="mp-empty">News appears with the daily market data.</p>:!snap.news.length?<p className="mp-empty">No news items were retrieved for this session. Headlines are never written by AI.</p>:<>
   <p className="mp-small">Headlines and summaries are the publishers’ own, from their public feeds. Market Pulse does not claim any of these caused the market move unless a cited source says so.</p>
   <ul className="mp-news-list">{snap.news.map(n=><li key={n.id}><a href={n.url} target="_blank" rel="noreferrer">{n.title} ↗</a><small>{n.publisher} · {day(n.publishedAt)}</small>{n.summary&&<p>{n.summary}</p>}</li>)}</ul></>}
 </section>;
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
  <div className="mp-insight-body"><h3>One-year context (calculated)</h3><ul>{stats.filter(x=>x.s).map(({name,s})=><li key={name}>{name}: {signed(s!.changePct)}% from {day(s!.from)} to {day(s!.to)}; range {fmt(s!.low.close)} – {fmt(s!.high.close)}; {s!.daysAbove1Pct} of {s!.sessions} sessions moved 1% or more{s!.largestFall?`; largest one-session fall ${signed(s!.largestFall.pct)}% on ${day(s!.largestFall.date)}`:''}.</li>)}</ul></div>
 </details></section>;
}
function Block({title,items,news,empty}:{title:string;items:{text:string;supports:string[]}[];news:NewsItem[];empty?:string}){
 return <div><h3>{title}</h3>{items.length?<ul>{items.map((c,k)=><li key={k}>{c.text} <Cites ids={c.supports} news={news}/></li>)}</ul>:<p>{empty??'Nothing to add from the verified evidence.'}</p>}</div>;
}
