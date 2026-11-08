'use client';
import {useId,useRef} from 'react';
import gsap from 'gsap';
import {useGSAP} from '@gsap/react';
import {MotionPathPlugin} from 'gsap/MotionPathPlugin';
import {money,type Profile,type Scenario} from '../lib/calc';
import './money-flow.css';

gsap.registerPlugin(useGSAP,MotionPathPlugin);

/**
 * Money-flow animation (GSAP, following greensock/gsap-skills: useGSAP with a scope, fromTo tweens, matchMedia for
 * prefers-reduced-motion). Every amount comes from LifeFlow's calculation engine; the animation only shows it.
 * The server renders the final state, so the figures are correct before any animation runs.
 */
export type FlowPart={id:'expenses'|'sip'|'change'|'remaining';label:string;amount:number};

const W=600,H=220,SRC_X=104,SRC_TOP=48,SRC_H=120,END_X=W-14,MAX_COINS=6;
type Geo={d:string;w:number;y1:number};
export function geometry(parts:FlowPart[],basis:number):Record<string,Geo>{
 const rows=parts.length===4?[36,84,132,180]:[48,108,168];
 let cum=0;const out:Record<string,Geo>={};
 parts.forEach((p,i)=>{
  const w=basis>0?Math.max(0,p.amount)/basis*SRC_H:0;const y0=SRC_TOP+cum+w/2;cum+=w;const y1=rows[i];
  out[p.id]={w:Math.round(w*100)/100,y1,d:`M ${SRC_X} ${y0.toFixed(2)} C ${SRC_X+170} ${y0.toFixed(2)} ${END_X-240} ${y1} ${END_X} ${y1}`};
 });
 return out;
}
export const basisOf=(salary:number,parts:FlowPart[])=>Math.max(salary,parts.reduce((s,p)=>s+Math.max(0,p.amount),0),1);
/** More coins travel along bigger streams (1–6), so the share of money is visible in the motion too. */
const coinCount=(amount:number,basis:number)=>amount>0?Math.max(1,Math.min(MAX_COINS,Math.round(amount/basis*12))):0;
type Layer='stream'|'shadow'|'hl'|'cap';
const layerVars=(g:Geo):Record<Layer,gsap.TweenVars>=>({
 stream:{attr:{d:g.d,'stroke-width':g.w}},
 shadow:{attr:{d:g.d,'stroke-width':g.w}},
 hl:{attr:{d:g.d,'stroke-width':g.w*0.3},y:-g.w*0.2,opacity:g.w>3?1:0},
 cap:{attr:{cy:g.y1,ry:g.w/2},opacity:g.w>1?1:0},
});

export default function MoneyFlow({salary,parts,from,label}:{salary:number;parts:FlowPart[];from?:FlowPart[];label:string}){
 const root=useRef<HTMLDivElement>(null);
 const prev=useRef<Record<string,Geo>|null>(null);
 const uid=useId().replace(/[^a-zA-Z0-9]/g,'');
 const basis=basisOf(salary,parts);
 const final=geometry(parts,basis);
 const key=parts.map(p=>`${p.id}:${p.amount}`).join('|')+`|${salary}`;

 useGSAP(()=>{
  const start=prev.current??(from?geometry(from,basisOf(salary,from)):Object.fromEntries(parts.map(p=>[p.id,{...final[p.id],w:0}])));
  const first=prev.current===null;prev.current=final;
  const q=gsap.utils.selector(root);
  const mm=gsap.matchMedia();
  mm.add({motion:'(prefers-reduced-motion: no-preference)',reduce:'(prefers-reduced-motion: reduce)'},ctx=>{
   const {reduce}=ctx.conditions as {reduce:boolean};
   const grow=first?0.9:0.5,base=first?(from?0.5:0.35):0;
   // The salary "arrives": the vault drops in, then the streams grow out of it.
   if(!reduce&&first&&!from)gsap.from(q('.mf-vault'),{y:-28,opacity:0,scale:0.85,transformOrigin:'50% 100%',duration:0.7,ease:'back.out(1.7)'});
   parts.forEach((p,i)=>{
    const g=final[p.id],s=start[p.id]??{...g,w:0};
    const to=layerVars(g),fromV=layerVars(s);
    for(const layer of ['stream','shadow','hl','cap'] as Layer[]){
     const el=q(`[data-${layer}="${p.id}"]`)[0];if(!el)continue;
     if(reduce)gsap.set(el,to[layer]);
     else gsap.fromTo(el,fromV[layer],{...to[layer],duration:grow,ease:'power3.out',delay:base+i*0.08,overwrite:'auto'});
    }
    if(reduce)return;
    // Glossy coins travel along each stream once it has reached its new size.
    const path=q(`[data-stream="${p.id}"]`)[0] as unknown as SVGPathElement|undefined,n=coinCount(p.amount,basis),dur=2.6;
    q(`[data-coin="${p.id}"]`).forEach((c,j)=>{
     gsap.set(c,{opacity:0});if(j>=n||!path)return;
     gsap.to(c,{motionPath:{path,align:path,alignOrigin:[0.5,0.5]},duration:dur,ease:'none',repeat:-1,delay:base+grow+i*0.12+j*dur/n,onStart:()=>{gsap.set(c,{opacity:1})}});
    });
   });
  });
  return()=>mm.revert();
 },{scope:root,dependencies:[key],revertOnUpdate:true});

 const ids=parts.map(p=>p.id);
 return <div ref={root} className="money-flow" role="img" aria-label={label}>
  <svg viewBox={`0 0 ${W} ${H}`} aria-hidden="true" focusable="false">
   <defs>
    <radialGradient id={`coin${uid}`} cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fffbe8"/><stop offset=".45" stopColor="#f5c451"/><stop offset="1" stopColor="#a8721a"/></radialGradient>
    <linearGradient id={`vault${uid}`} x1="0" y1="0" x2="0" y2="1"><stop className="mf-vault-hi" offset="0"/><stop className="mf-vault-lo" offset="1"/></linearGradient>
    <filter id={`soft${uid}`} x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
   </defs>
   <ellipse className="mf-floor" cx="300" cy={H-8} rx="270" ry="9" filter={`url(#soft${uid})`}/>
   {ids.map(id=><path key={id} data-shadow={id} className="mf-shadow" d={final[id].d} strokeWidth={final[id].w} transform="translate(0 8)" filter={`url(#soft${uid})`}/>)}
   {ids.map(id=><path key={id} data-stream={id} className={`mf-stream mf-${id}`} d={final[id].d} strokeWidth={final[id].w}/>)}
   {ids.map(id=><path key={id} data-hl={id} className="mf-hl" d={final[id].d} strokeWidth={final[id].w*0.3} transform={`translate(0 ${-final[id].w*0.2})`} opacity={final[id].w>3?1:0}/>)}
   {ids.map(id=><ellipse key={id} data-cap={id} className={`mf-cap mf-${id}`} cx={END_X} cy={final[id].y1} rx="7" ry={final[id].w/2} opacity={final[id].w>1?1:0}/>)}
   {ids.map(id=>Array.from({length:MAX_COINS},(_,j)=><circle key={id+j} data-coin={id} className="mf-coin" r="6.5" cx="0" cy="0" fill={`url(#coin${uid})`} opacity="0"/>))}
   <g className="mf-vault">
    <rect className="mf-vault-shadow" x="4" y={SRC_TOP+10} width={SRC_X} height={SRC_H} rx="16" filter={`url(#soft${uid})`}/>
    <rect x="0" y={SRC_TOP} width={SRC_X} height={SRC_H} rx="16" fill={`url(#vault${uid})`}/>
    <rect className="mf-vault-gloss" x="8" y={SRC_TOP+6} width={SRC_X-16} height="14" rx="7"/>
    <text className="mf-rupee" x={SRC_X/2} y={SRC_TOP+SRC_H/2+2}>₹</text>
   </g>
  </svg>
 </div>;
}

/** Colour key for the flow. Labels only: the figures are already shown once in the result above. */
export function FlowLegend({parts}:{parts:FlowPart[]}){
 return <div className="flow-legend" aria-hidden="true">{parts.filter(p=>p.amount>0||p.id==='remaining').map(p=><span key={p.id}><i className={`mf-dot mf-${p.id}`}/> {p.label}</span>)}</div>;
}

const CHANGE_LABEL:Record<string,string>={expense:'This expense',rent:'Rent increase'};
const day=(iso:string)=>{const d=new Date(iso+'T00:00:00Z');return Number.isNaN(d.getTime())?null:d};
const short=(d:Date)=>d.toLocaleDateString('en-IN',{day:'numeric',month:'short',timeZone:'UTC'});

/** Scenario Lab: the monthly flow morphs from before to after (expense, rent); a salary delay shows the timing instead. */
export function ScenarioFlow({result,profile}:{result:Scenario;profile:Profile}){
 const p=result.profile??profile;
 if((result.type==='expense'||result.type==='rent')&&result.estimateKnown!==false){
  const change=Math.max(0,result.before-result.after);
  const before:FlowPart[]=[{id:'expenses',label:'Expenses',amount:p.expenses},{id:'sip',label:'SIP',amount:p.sip},{id:'change',label:CHANGE_LABEL[result.type],amount:0},{id:'remaining',label:'Remaining before',amount:Math.max(0,result.before)}];
  const after:FlowPart[]=[{id:'expenses',label:'Expenses',amount:p.expenses},{id:'sip',label:'SIP',amount:p.sip},{id:'change',label:CHANGE_LABEL[result.type],amount:change},{id:'remaining',label:'Remaining after',amount:Math.max(0,result.after)}];
  return <div className="scenario-flow">
   <MoneyFlow salary={p.salary} parts={after} from={before} label={`Money flow: of ${money(p.salary)}, ${CHANGE_LABEL[result.type].toLowerCase()} of ${money(change)} reduces remaining cash from ${money(result.before)} to ${money(result.after)}.`}/>
   <FlowLegend parts={after}/>
  </div>;
 }
 if(result.type==='salary'&&result.inputs){
  const expected=day(result.inputs.salaryDate||''),delay=Number(result.inputs.delay),debit=day(result.inputs.debitDate||p.sipDate||'');
  if(!expected||!debit||!Number.isFinite(delay))return null;
  const arrival=new Date(expected.getTime()+delay*86400e3);
  const bal=(result.inputs.balance||'').trim();const balance=bal&&Number.isFinite(Number(bal))?Number(bal):null;
  return <SalaryTimeline expected={expected} debit={debit} arrival={arrival} sip={p.sip} balance={balance}/>;
 }
 return null;
}

/**
 * Usability fix (sessions P1, P3, P4): people read the salary-delay result as a yes/no prediction and looked for their
 * bank balance. This states the condition plainly and, when the optional balance is entered, compares it with the SIP.
 * LifeFlow never sees a real account; the comparison uses only the figure the person typed.
 */
function DebitDayAnswer({debit,gapDays,sip,balance}:{debit:Date;gapDays:number;sip:number;balance:number|null}){
 const when=short(debit);
 let verdict:string,tone:'ok'|'warn'|'info';
 if(gapDays<=0){verdict=`Your salary should arrive on or before ${when}, so the SIP is paid from it if it is credited on time.`;tone='ok'}
 else if(balance===null){verdict=`It depends on your balance on ${when}: the SIP goes through only if at least ${money(sip)} is in your account that day, after any other debits. LifeFlow can’t see your bank balance. Enter “Available balance” above to check.`;tone='info'}
 else if(balance>=sip){verdict=`The ${money(balance)} you entered covers the ${money(sip)} SIP on ${when}, as long as other debits don’t use it first.`;tone='ok'}
 else{verdict=`The ${money(balance)} you entered is ${money(sip-balance)} short of the ${money(sip)} SIP on ${when}. Unless more money arrives by then, the debit may fail.`;tone='warn'}
 return <div className={`debit-answer ${tone}`} role="note" aria-label="Will my SIP go through?">
  <b>Will my SIP go through?</b>
  <p>{verdict}</p>
  <small>Based only on the figures you entered; confirm with your bank or fund house.</small>
 </div>;
}

function SalaryTimeline({expected,debit,arrival,sip,balance}:{expected:Date;debit:Date;arrival:Date;sip:number;balance:number|null}){
 const root=useRef<HTMLDivElement>(null);
 const t=[expected,debit,arrival].map(d=>d.getTime());const lo=Math.min(...t),hi=Math.max(...t),span=Math.max(hi-lo,86400e3);
 const x=(d:Date)=>40+(d.getTime()-lo)/span*520;
 const gapDays=Math.round((arrival.getTime()-debit.getTime())/86400e3);
 const xe=x(expected),xd=x(debit),xa=x(arrival);
 useGSAP(()=>{
  const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
   gsap.fromTo('.tl-coin',{x:xe-xa},{x:0,duration:1.4,ease:'power3.inOut',delay:0.3});
   if(gapDays>0)gsap.fromTo('.tl-gap',{scaleX:0},{scaleX:1,transformOrigin:'0% 50%',duration:0.7,ease:'power2.out',delay:1.2});
  });
  return()=>mm.revert();
 },{scope:root,dependencies:[xe,xd,xa]});
 const msg=gapDays>0?`Salary lands ${gapDays} day${gapDays===1?'':'s'} after the SIP debit date.`:'Salary lands on or before the SIP debit date.';
 return <div ref={root} className="salary-timeline" role="img" aria-label={`Timing: salary expected ${short(expected)}, SIP debit ${short(debit)}, salary arrives ${short(arrival)}. ${msg} The monthly total is unchanged.`}>
  <svg viewBox="0 0 600 80" aria-hidden="true" focusable="false">
   <line className="tl-axis" x1="20" y1="44" x2="580" y2="44"/>
   {gapDays>0&&<rect className="tl-gap" x={xd} y="30" width={xa-xd} height="10" rx="3"/>}
   <line className="tl-tick" x1={xe} y1="34" x2={xe} y2="54"/>
   <line className="tl-tick tl-debit" x1={xd} y1="30" x2={xd} y2="58"/>
   <line className="tl-tick tl-arrive" x1={xa} y1="34" x2={xa} y2="54"/>
   <circle className="tl-coin" cx={xa} cy="44" r="9"/>
  </svg>
  <div className="tl-labels"><span>Salary expected <b>{short(expected)}</b></span><span className="tl-debit-label">SIP debit <b>{short(debit)}</b></span><span className="tl-arrive-label">Salary arrives <b>{short(arrival)}</b></span></div>
  <p className={gapDays>0?'tl-note warn':'tl-note'}>{msg} Only the timing moves; the monthly total is unchanged.</p>
  <DebitDayAnswer debit={debit} gapDays={gapDays} sip={sip} balance={balance}/>
 </div>;
}
