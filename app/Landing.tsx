'use client';
import {useRef} from 'react';
import gsap from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {SplitText} from 'gsap/SplitText';
import {useGSAP} from '@gsap/react';
import {basisOf,geometry,type FlowPart} from './MoneyFlow';
import LiquidLogo from './LiquidLogo';
import './money-flow.css';
import './landing.css';

gsap.registerPlugin(useGSAP,ScrollTrigger,SplitText);

/**
 * LifeFlow landing page (first visit only). A 3D hero, then a pinned scroll story whose chapters change as you scroll:
 * salary arrives → it splits → a bill → late salary → checked AI answers. Built with greensock/gsap-skills patterns:
 * one scrubbed, pinned timeline on ScrollTrigger (children animated, never the pinned element), useGSAP cleanup,
 * SplitText titles, quickTo pointer parallax, and gsap.matchMedia for reduced motion (static, unpinned story).
 * All figures are LifeFlow's illustrative reference case and match its calculator.
 */
const SALARY=35000;
const SPLIT:FlowPart[]=[{id:'expenses',label:'Expenses',amount:21000},{id:'sip',label:'SIP',amount:4000},{id:'change',label:'Medical bill',amount:0},{id:'remaining',label:'Remaining',amount:10000}];
const BILL:FlowPart[]=[{id:'expenses',label:'Expenses',amount:21000},{id:'sip',label:'SIP',amount:4000},{id:'change',label:'Medical bill',amount:6000},{id:'remaining',label:'Remaining',amount:4000}];
const IDS=SPLIT.map(p=>p.id);
const gSplit=geometry(SPLIT,basisOf(SALARY,SPLIT)),gBill=geometry(BILL,basisOf(SALARY,BILL));
const rupees=(n:number)=>'₹'+Math.round(n).toLocaleString('en-IN');

const CHAPTERS=[
 {eyebrow:'01 · Salary day',title:'Your salary arrives.',body:'₹35,000 lands. LifeFlow works from the illustrative figures you enter, never your real bank account.'},
 {eyebrow:'02 · Where it goes',title:'It splits into what matters.',body:'₹21,000 for expenses, ₹4,000 for your SIP, and ₹10,000 left for the month.'},
 {eyebrow:'03 · Life happens',title:'Then a ₹6,000 bill arrives.',body:'A one-time medical bill takes what is left from ₹10,000 to ₹4,000, for this month only.'},
 {eyebrow:'04 · Timing matters',title:'Sometimes salary is late.',body:'Due 1 Dec, it arrives 8 Dec, three days after your SIP debit on 5 Dec. It goes through only if ₹4,000 is in your account that day.'},
 {eyebrow:'05 · Markets move',title:'Markets move. Your plan doesn’t have to panic.',body:'Market Pulse gives an end-of-day brief from cited sources and compares continuing, pausing or stopping your SIP, without telling you what to do.'},
 {eyebrow:'06 · Ask, safely',title:'Ask anything. Every answer is checked.',body:'Google Gemini or Groq explain your situation. LifeFlow calculates every number and blocks advice, guesses and unsupported claims.'},
];
const CHECKS=['Figures calculated by LifeFlow','Numbers match LifeFlow’s calculation','Each claim traced to your figures or SEBI/AMFI','No investment advice or return promises','Says what it can’t know'];

export default function Landing({theme,onEnter}:{theme:string;onEnter:()=>void}){
 const root=useRef<HTMLDivElement>(null);

 const {contextSafe}=useGSAP(()=>{
  if(document.documentElement.classList.contains('lf-app'))return;
  const q=gsap.utils.selector(root);
  const mm=gsap.matchMedia();
  mm.add({motion:'(prefers-reduced-motion: no-preference)',reduce:'(prefers-reduced-motion: reduce)'},ctx=>{
   const {reduce}=ctx.conditions as {reduce:boolean};
   if(reduce){root.current?.classList.add('lp-static');return()=>root.current?.classList.remove('lp-static')}

   // Hero: the title moves in word by word; copy and 3D cards follow.
   const title=q('.lp-title')[0] as HTMLElement|undefined;const name=title?.innerText.replace(/\s+/g,' ').trim()||'';
   if(title)SplitText.create(title,{type:'words',wordsClass:'title-word',onSplit:self=>{title.setAttribute('aria-label',name);return gsap.from(self.words,{yPercent:70,opacity:0,rotationX:-55,filter:'blur(6px)',transformOrigin:'50% 100%',duration:0.9,ease:'power4.out',stagger:0.07,clearProps:'filter,transform'})},onRevert:()=>title.removeAttribute('aria-label')});
   gsap.from(q('.lp-hero-copy .lp-reveal'),{y:18,opacity:0,duration:0.7,ease:'power3.out',stagger:0.1,delay:0.45});
   gsap.from(q('.lp-card'),{y:70,rotationX:35,opacity:0,duration:1.2,ease:'power3.out',stagger:0.14,delay:0.2});
   gsap.from(q('.lp-orb'),{scale:0.4,opacity:0,duration:1.4,ease:'back.out(1.5)',delay:0.1});
   gsap.to(q('.lp-float'),{y:'-=12',duration:3.2,ease:'sine.inOut',yoyo:true,repeat:-1,stagger:{each:0.7,from:'random'}});
   gsap.to(q('.lp-coin'),{y:'-=18',rotation:'+=25',duration:2.6,ease:'sine.inOut',yoyo:true,repeat:-1,stagger:{each:0.4,from:'random'}});
   // Pointer parallax tilts the 3D scene (quickTo reuses one tween per axis, per the performance skill).
   const scene=q('.lp-scene')[0];
   let off=()=>{};
   if(scene&&window.matchMedia('(pointer: fine)').matches){
    const rx=gsap.quickTo(scene,'rotationX',{duration:0.9,ease:'power3'}),ry=gsap.quickTo(scene,'rotationY',{duration:0.9,ease:'power3'});
    const move=(e:PointerEvent)=>{rx(8-(e.clientY/window.innerHeight)*16);ry(-14+(e.clientX/window.innerWidth)*20)};
    window.addEventListener('pointermove',move);off=()=>window.removeEventListener('pointermove',move);
   }

   // Story: one pinned, scrubbed timeline. Chapters change as you scroll; the dots follow the chapter on screen.
   const chapters=q('.lp-chapter'),dots=q('.lp-dot');
   const stream=(id:string)=>q(`[data-lp-stream="${id}"]`)[0],hl=(id:string)=>q(`[data-lp-hl="${id}"]`)[0];
   const setRead=(sel:string)=>{const el=q(sel)[0];return (v:number)=>{if(el)el.textContent=rupees(v)}};
   const salaryOut=setRead('.lp-salary'),remainOut=setRead('.lp-remaining');
   gsap.set(chapters,{autoAlpha:0,y:30});gsap.set(chapters[0],{autoAlpha:1,y:0});
   gsap.set(q('.lp-vault'),{autoAlpha:0,y:-40});gsap.set(q('.lp-readout, .lp-remaining-wrap, .lp-bill-tag, .lp-tl, .lp-tl-labels, .lp-market, .lp-ai-card'),{autoAlpha:0});gsap.set(q('.lp-bill-tag'),{y:12});
   for(const id of IDS){gsap.set([stream(id),hl(id)],{attr:{d:gSplit[id].d,'stroke-width':0}})}
   const swap=(tl:gsap.core.Timeline,from:number,to:number,at:string)=>tl.to(chapters[from],{autoAlpha:0,y:-30,duration:0.4},at).fromTo(chapters[to],{autoAlpha:0,y:30},{autoAlpha:1,y:0,duration:0.5},'<0.15');
   const money={salary:0,remaining:10000};
   const syncDots=()=>{let i=0,best=-1;chapters.forEach((c,j)=>{const o=Number(gsap.getProperty(c,'opacity'));if(o>best){best=o;i=j}});dots.forEach((d,j)=>{d.classList.toggle('on',j===i);d.setAttribute('aria-current',j===i?'step':'false')})};
   const tl=gsap.timeline({defaults:{ease:'power2.out'},onUpdate:syncDots,scrollTrigger:{trigger:q('.lp-story')[0],pin:q('.lp-pin')[0],start:'top top',end:'+=5300',scrub:0.8}});
   tl.addLabel('arrive')
    .to(q('.lp-vault'),{autoAlpha:1,y:0,duration:0.6,ease:'back.out(1.6)'})
    .to(q('.lp-readout'),{autoAlpha:1,duration:0.3},'<0.2')
    .to(money,{salary:SALARY,duration:0.6,onUpdate:()=>salaryOut(money.salary)},'<');
   swap(tl,0,1,'+=0.4');
   tl.addLabel('split');
   ['expenses','sip','remaining'].forEach((id,i)=>{tl.to(stream(id),{attr:{'stroke-width':gSplit[id].w},duration:0.7},i?'<0.12':'<');tl.to(hl(id),{attr:{'stroke-width':gSplit[id].w*0.3},duration:0.7},'<')});
   tl.to(q('.lp-remaining-wrap'),{autoAlpha:1,duration:0.3},'<');
   swap(tl,1,2,'+=0.5');
   tl.addLabel('bill');
   for(const id of IDS){tl.to(stream(id),{attr:{d:gBill[id].d,'stroke-width':gBill[id].w},duration:0.8},'<');tl.to(hl(id),{attr:{d:gBill[id].d,'stroke-width':gBill[id].w*0.3},duration:0.8},'<')}
   tl.to(q('.lp-bill-tag'),{autoAlpha:1,y:0,duration:0.4},'<0.2').to(money,{remaining:4000,duration:0.8,onUpdate:()=>remainOut(money.remaining)},'<');
   swap(tl,2,3,'+=0.5');
   tl.addLabel('timing')
    .to(q('.lp-flow'),{opacity:0.05,duration:0.5},'<').to(q('.lp-readout, .lp-bill-tag'),{autoAlpha:0,duration:0.3},'<')
    .to(q('.lp-tl, .lp-tl-labels'),{autoAlpha:1,duration:0.4},'<0.1')
    .fromTo(q('.lp-tl-coin'),{x:0},{x:370,duration:1.1,ease:'power1.inOut'})
    .fromTo(q('.lp-tl-gap'),{scaleX:0},{scaleX:1,transformOrigin:'0% 50%',duration:0.5},'-=0.45');
   swap(tl,3,4,'+=0.5');
   tl.addLabel('market')
    .to(q('.lp-tl, .lp-tl-labels'),{autoAlpha:0,duration:0.3},'<').to(q('.lp-flow'),{opacity:0.03,duration:0.3},'<')
    .fromTo(q('.lp-market'),{autoAlpha:0,y:40,rotationX:20},{autoAlpha:1,y:0,rotationX:0,duration:0.6},'<0.1')
    .fromTo(q('.lp-spark-line'),{strokeDashoffset:620},{strokeDashoffset:0,duration:0.9,ease:'none'},'-=0.2')
    .from(q('.lp-mp-chip, .lp-option'),{opacity:0,y:10,stagger:0.08,duration:0.3},'-=0.4');
   swap(tl,4,5,'+=0.5');
   tl.addLabel('ai')
    .to(q('.lp-market'),{autoAlpha:0,y:-30,duration:0.4},'<')
    .fromTo(q('.lp-ai-card'),{autoAlpha:0,y:40,rotationX:20},{autoAlpha:1,y:0,rotationX:0,duration:0.6},'<0.1')
    .from(q('.lp-check'),{opacity:0,x:-14,stagger:0.12,duration:0.3},'-=0.1')
    .to({},{duration:0.6});
   gsap.to(q('.lp-dash'),{strokeDashoffset:-36,duration:1.4,ease:'none',repeat:-1});
   // Heartbeat: a bright pulse keeps running along the Market Pulse line.
   gsap.fromTo(q('.lp-ecg-glow'),{strokeDashoffset:60},{strokeDashoffset:-560,duration:2.2,ease:'none',repeat:-1});
   gsap.from(q('.lp-final .lp-reveal'),{y:30,opacity:0,stagger:0.12,duration:0.7,scrollTrigger:{trigger:q('.lp-final')[0],start:'top 75%',toggleActions:'play none none reverse'}});
   return()=>off();
  });
  return()=>mm.revert();
 },{scope:root});

 const enter=contextSafe(()=>{
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(reduce||!root.current){onEnter();return}
  gsap.to(root.current,{autoAlpha:0,scale:1.015,duration:0.45,ease:'power2.in',onComplete:onEnter});
 });

 return <div ref={root} className="landing" data-theme={theme}>
  <header className="lp-top">
   <span className="lp-brand"><span className="lp-mark" aria-hidden="true">✳</span><b>Groww <span>LifeFlow</span></b></span>
   <button type="button" className="lp-btn ghost" onClick={enter}>Open LifeFlow</button>
  </header>

  <section className="lp-hero" aria-labelledby="lp-title">
   <div className="lp-hero-copy">
    <div className="lp-eyebrow lp-reveal"><span/> YOUR MONEY, IN MOTION</div>
    <h1 id="lp-title" className="lp-title">Life happens.<br/><em>Let’s plan for it.</em></h1>
    <p className="lp-lead lp-reveal">See how salary days, surprise bills and late paydays shape your monthly cash flow and your SIP, before they happen.</p>
    <div className="lp-actions lp-reveal">
     <button type="button" className="lp-btn" onClick={enter}>Open LifeFlow <span aria-hidden="true">↗</span></button>
     <a className="lp-scroll" href="#lp-story">Scroll to see how <span aria-hidden="true">↓</span></a>
    </div>
    <p className="lp-small lp-reveal">Educational prototype. Not investment advice. Not affiliated with Groww.</p>
   </div>
   <div className="lp-scene-wrap" aria-hidden="true">
    <div className="lp-scene">
     <div className="lp-orb lp-float"><LiquidLogo theme={theme}/></div>
     <div className="lp-card c1"><div className="lp-float"><small>TAKE-HOME</small><b>₹35,000</b><span>arrives 1 Dec</span></div></div>
     <div className="lp-card c2"><div className="lp-float"><small>SIP</small><b>₹4,000</b><span>debits 5 Dec</span></div></div>
     <div className="lp-card c3"><div className="lp-float"><small>LEFT THIS MONTH</small><b>₹10,000</b><span>after expenses and SIP</span></div></div>
     {[0,1,2,3,4].map(i=><span key={i} className={`lp-coin k${i}`}/>)}
    </div>
   </div>
  </section>

  <section id="lp-story" className="lp-story" aria-label="How LifeFlow works">
   <div className="lp-pin">
    <div className="lp-chapters">
     {CHAPTERS.map((c,i)=><article key={i} className="lp-chapter"><div className="lp-eyebrow">{c.eyebrow}</div><h2>{c.title}</h2><p>{c.body}</p></article>)}
     <ol className="lp-dots" aria-label="Story progress">{CHAPTERS.map((c,i)=><li key={i} className={`lp-dot${i===0?' on':''}`} aria-current={i===0?'step':'false'}><span className="sr-only">{c.title}</span></li>)}</ol>
    </div>
    <div className="lp-stage" aria-hidden="true">
     <div className="lp-stage3d">
      <svg className="lp-svg" viewBox="0 0 600 240" focusable="false">
       <defs>
        <linearGradient id="lpVault" x1="0" y1="0" x2="0" y2="1"><stop className="mf-vault-hi" offset="0"/><stop className="mf-vault-lo" offset="1"/></linearGradient>
        <filter id="lpSoft" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="5"/></filter>
        <radialGradient id="lpCoin" cx="35%" cy="30%" r="75%"><stop offset="0" stopColor="#fffbe8"/><stop offset=".45" stopColor="#f5c451"/><stop offset="1" stopColor="#a8721a"/></radialGradient>
       </defs>
       <g className="lp-flow">
        <ellipse className="mf-floor" cx="300" cy="226" rx="270" ry="9" filter="url(#lpSoft)"/>
        {IDS.map(id=><path key={id} data-lp-stream={id} className={`mf-stream mf-${id}`} d={gSplit[id].d} strokeWidth={gSplit[id].w}/>)}
        {IDS.map(id=><path key={id} data-lp-hl={id} className="mf-hl" d={gSplit[id].d} strokeWidth={gSplit[id].w*0.3} transform={`translate(0 ${-gSplit[id].w*0.2})`}/>)}
        {IDS.map(id=><path key={id} className="lp-dash" d={gSplit[id].d}/>)}
        <g className="lp-vault">
         <rect className="mf-vault-shadow" x="4" y="58" width="104" height="120" rx="16" filter="url(#lpSoft)"/>
         <rect x="0" y="48" width="104" height="120" rx="16" fill="url(#lpVault)"/>
         <rect className="mf-vault-gloss" x="8" y="54" width="88" height="14" rx="7"/>
         <text className="mf-rupee" x="52" y="110">₹</text>
        </g>
       </g>
       <g className="lp-tl">
        <line className="tl-axis" x1="40" y1="120" x2="560" y2="120"/>
        <rect className="tl-gap lp-tl-gap" x="300" y="104" width="160" height="12" rx="3"/>
        <line className="tl-tick" x1="90" y1="108" x2="90" y2="132"/>
        <line className="tl-tick tl-debit" x1="300" y1="102" x2="300" y2="138"/>
        <line className="tl-tick tl-arrive" x1="460" y1="108" x2="460" y2="132"/>
        <circle className="lp-tl-coin" cx="90" cy="120" r="11" fill="url(#lpCoin)"/>
       </g>
      </svg>
      <div className="lp-readout"><span>Take-home</span><b className="lp-salary">₹35,000</b><span className="lp-remaining-wrap">Left this month <b className="lp-remaining">₹10,000</b></span></div>
      <div className="lp-bill-tag">Medical bill −₹6,000</div>
      <div className="lp-tl-labels"><span>1 Dec<br/><small>salary due</small></span><span className="d">5 Dec<br/><small>SIP ₹4,000</small></span><span className="a">8 Dec<br/><small>salary arrives</small></span></div>
      <div className="lp-market">
       <div className="lp-mp-head"><b>Market Pulse</b><span>Daily brief · after market close</span></div>
       <svg className="lp-spark" viewBox="0 0 300 76" preserveAspectRatio="none" focusable="false">
        <g className="lp-ecg-grid">{[12,24,36,48,60].map(y=><line key={'h'+y} x1="0" x2="300" y1={y} y2={y}/>)}{[30,60,90,120,150,180,210,240,270].map(x=><line key={'v'+x} y1="0" y2="76" x1={x} x2={x}/>)}</g>
        <path className="lp-spark-line" d="M0 42 H34 L40 37 L46 42 H62 L68 48 L76 10 L84 66 L90 42 H104 Q112 31 120 42 H150 L156 37 L162 42 H178 L184 48 L192 10 L200 66 L206 42 H220 Q228 31 236 42 H300"/>
        <path className="lp-ecg-glow" d="M0 42 H34 L40 37 L46 42 H62 L68 48 L76 10 L84 66 L90 42 H104 Q112 31 120 42 H150 L156 37 L162 42 H178 L184 48 L192 10 L200 66 L206 42 H220 Q228 31 236 42 H300"/>
       </svg>
       <small className="lp-spark-note">Illustration, not market data</small>
       <div className="lp-mp-chips"><span className="lp-mp-chip">What moved</span><span className="lp-mp-chip">Why, with cited news</span><span className="lp-mp-chip">What it means for an SIP</span></div>
       <div className="lp-explorer"><b>SIP Decision Explorer</b><div className="lp-options"><span className="lp-option">Continue</span><span className="lp-option">Pause</span><span className="lp-option">Stop</span></div><small>Compared side by side; never recommended.</small></div>
      </div>
      <div className="lp-ai-card">
       <div className="lp-ai-q">“My salary is 7 days late. Will my SIP go through?”</div>
       <div className="lp-ai-a">It depends on having ₹4,000 in your account on 5 Dec. Your salary lands on 8 Dec, three days after the debit.</div>
       <ul>{CHECKS.map(c=><li key={c} className="lp-check"><span aria-hidden="true">✓</span> {c}</li>)}</ul>
       <div className="lp-ai-foot"><span className="rec">Google Gemini · Recommended</span><span>Groq · Alternative</span></div>
      </div>
     </div>
    </div>
   </div>
  </section>

  <section className="lp-final" aria-labelledby="lp-final-title">
   <h2 id="lp-final-title" className="lp-reveal">A little more clarity, <em>for what comes next.</em></h2>
   <p className="lp-reveal">Try your own figures in the Scenario Lab, follow the market in Market Pulse, and ask the AI Companion. Nothing connects to your bank.</p>
   <button type="button" className="lp-btn big lp-reveal" onClick={enter}>Open LifeFlow <span aria-hidden="true">↗</span></button>
   <p className="lp-small lp-reveal">Groww LifeFlow is an independent educational prototype by a NextLeap fellow. It is not affiliated with or endorsed by Groww and does not provide investment advice.</p>
  </section>
 </div>;
}
