'use client';
import type {RefObject} from 'react';
import gsap from 'gsap';
import {SplitText} from 'gsap/SplitText';
import {useGSAP} from '@gsap/react';

gsap.registerPlugin(useGSAP,SplitText);

/**
 * GSAP page motion (greensock/gsap-skills: useGSAP with a scope, SplitText with onSplit, matchMedia for reduced motion).
 * - Page titles move in word by word on every tab change (Home included).
 * - The Home logo (✳ and its orbits) enters, then turns and breathes slowly.
 * Reduced motion: nothing moves; the text and logo are simply shown.
 */
export function usePageMotion(scope:RefObject<HTMLElement|null>,page:string){
 useGSAP(()=>{
  const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
   // SplitText hides the word pieces from screen readers and labels the heading. Its label drops the space at a <br>,
   // so each heading is labelled with its own visible wording (captured before splitting) and restored on revert.
   const heads=gsap.utils.toArray<HTMLElement>('.page-heading h1, .intro h1',scope.current);
   const names=heads.map(h=>h.innerText.replace(/\s+/g,' ').trim());
   SplitText.create(heads,{
    type:'words',wordsClass:'title-word',
    onSplit:self=>{
     heads.forEach((h,i)=>h.setAttribute('aria-label',names[i]));
     return gsap.from(self.words,{yPercent:70,opacity:0,rotationX:-55,filter:'blur(6px)',transformOrigin:'50% 100%',duration:0.8,ease:'power4.out',stagger:0.06,clearProps:'filter,transform'});
    },
    onRevert:()=>heads.forEach(h=>h.removeAttribute('aria-label')),
   });
   const hero=scope.current?.querySelector('.hero-art');
   if(hero){
    const q=gsap.utils.selector(hero);
    gsap.timeline({defaults:{ease:'power3.out'}})
     .from(q('.orbit'),{scale:0.6,opacity:0,duration:1,stagger:0.12})
     .from(q('.hero-symbol'),{rotation:-140,scale:0.3,opacity:0,duration:1.2,ease:'back.out(1.6)'},'<0.1')
     .from(q('.art-label'),{y:16,opacity:0,duration:0.7},'-=0.6');
    gsap.to(q('.hero-symbol'),{rotation:'+=360',duration:28,ease:'none',repeat:-1,delay:1.3});
    gsap.to(q('.orbit1'),{scale:1.04,duration:3.2,ease:'sine.inOut',yoyo:true,repeat:-1,delay:1});
    gsap.to(q('.orbit2'),{scale:0.96,duration:2.6,ease:'sine.inOut',yoyo:true,repeat:-1,delay:1.2});
    gsap.to(q('.art-label'),{y:-6,duration:2.8,ease:'sine.inOut',yoyo:true,repeat:-1,delay:1.6});
   }
  });
  return()=>mm.revert();
 },{scope,dependencies:[page],revertOnUpdate:true});
}

/**
 * Scenario result "number change": the after figure rolls in digit by digit (odometer) after the before figure, and the
 * arrow nudges towards it. The text itself is unchanged; the result block remounts per result, so React never updates
 * the split text in place.
 */
export function useNumberRoll(scope:RefObject<HTMLElement|null>,resultKey:string){
 useGSAP(()=>{
  if(!resultKey||!scope.current)return;
  const mm=gsap.matchMedia();
  mm.add('(prefers-reduced-motion: no-preference)',()=>{
   const after=scope.current?.querySelector<HTMLElement>('.result-numbers > div:last-child b');
   const arrow=scope.current?.querySelector('.result-numbers > span');
   if(arrow)gsap.fromTo(arrow,{x:-10,opacity:0},{x:0,opacity:1,duration:0.5,ease:'power2.out',delay:0.25});
   if(after)SplitText.create(after,{type:'chars',mask:'chars',charsClass:'roll-char',onSplit:self=>gsap.from(self.chars,{yPercent:110,duration:0.55,ease:'power3.out',stagger:0.045,delay:0.45})});
  });
  return()=>mm.revert();
 },{scope,dependencies:[resultKey],revertOnUpdate:true});
}
