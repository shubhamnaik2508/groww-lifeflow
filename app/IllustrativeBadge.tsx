'use client';
import {useEffect,useId,useRef,useState} from 'react';
import './illustrative-badge.css';

/**
 * The "Illustrative mode" pill in the top bar. It looks exactly as before; clicking or tapping it opens a short
 * explanation. It closes on a second click, a click elsewhere, or Escape (which returns focus to the pill).
 */
export default function IllustrativeBadge(){
 const [open,setOpen]=useState(false);
 const wrap=useRef<HTMLSpanElement>(null),button=useRef<HTMLButtonElement>(null);
 const id=useId();
 useEffect(()=>{
  if(!open)return;
  const away=(e:PointerEvent)=>{if(!wrap.current?.contains(e.target as Node))setOpen(false)};
  const esc=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);button.current?.focus()}};
  document.addEventListener('pointerdown',away);document.addEventListener('keydown',esc);
  return()=>{document.removeEventListener('pointerdown',away);document.removeEventListener('keydown',esc)};
 },[open]);
 return <span className="illustrative" ref={wrap}>
  <button ref={button} type="button" className="private" aria-expanded={open} aria-controls={id} onClick={()=>setOpen(o=>!o)}>
   <span aria-hidden="true">◉</span>{'  '}Illustrative mode
  </button>
  {open&&<div id={id} className="illustrative-pop" role="note" aria-label="About illustrative mode">
   <b>Illustrative mode</b>
   <p>All figures in LifeFlow are examples you enter. It never connects to a bank, Groww or any investment account, and never asks for PAN, Aadhaar, passwords or account numbers.</p>
   <p>Your figures stay in this browser, except when you ask the AI Companion: your question and example figures are then sent to LifeFlow’s server and Groq to write the answer.</p>
   <p>Keep them between visits with “Save my illustrative data on this device” on Home; clear them with “Reset illustrative data” in My Journey.</p>
  </div>}
 </span>;
}
