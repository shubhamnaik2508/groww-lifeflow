'use client';
import {useEffect,useRef} from 'react';

/**
 * TradingView's free embeddable widgets (iframe format, https://www.tradingview.com/widget-docs/).
 * TradingView licenses and displays the data; this page never reads it (cross-origin iframe), so no number shown in a
 * widget is ever passed to the AI. TradingView's attribution must stay visible and unaltered (TradingView policies §4).
 * Only BSE symbols are used: NSE symbols (NIFTY 50) are not licensed for TradingView widgets.
 */
export type TvWidget='single-quote'|'symbol-overview';
const SRC:Record<TvWidget,string>={
 'single-quote':'https://s3.tradingview.com/external-embedding/embed-widget-single-quote.js',
 'symbol-overview':'https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js',
};

/** Attribution exactly as TradingView's widget builder generates it (for BSE:SENSEX: "SENSEX quote by TradingView"). */
export type TvAttribution={symbolPage:string;label:string};
export const SENSEX_ATTRIBUTION:TvAttribution={symbolPage:'https://www.tradingview.com/symbols/BSE-SENSEX/',label:'SENSEX quote'};

export default function TradingViewWidget({kind,config,title,height,attribution}:{kind:TvWidget;config:Record<string,unknown>;title:string;height:number;attribution:TvAttribution}){
 const host=useRef<HTMLDivElement>(null);
 const json=JSON.stringify(config);
 useEffect(()=>{
  const el=host.current;if(!el)return;
  const slot=el.querySelector('.tradingview-widget-container__widget') as HTMLDivElement|null;if(!slot)return;
  slot.replaceChildren();
  // TradingView's documented pattern: a script whose body is the JSON configuration.
  const s=document.createElement('script');s.type='text/javascript';s.src=SRC[kind];s.async=true;s.text=json;slot.appendChild(s);
  // Give the injected iframe an accessible name.
  const name=()=>el.querySelectorAll('iframe').forEach(f=>{if(!f.title)f.title=title});
  const mo=new MutationObserver(name);mo.observe(el,{childList:true,subtree:true});
  return ()=>{mo.disconnect();slot.replaceChildren()};
 },[kind,json,title]);
 return <div className="tradingview-widget-container mp-tv" ref={host} style={{height}}>
  <div className="tradingview-widget-container__widget" style={{height:'calc(100% - 28px)'}}/>
  <div className="tradingview-widget-copyright"><a href={attribution.symbolPage} rel="noopener nofollow" target="_blank"><span className="blue-text">{attribution.label}</span></a><span className="trademark">{'\u00a0by TradingView'}</span></div>
 </div>;
}
