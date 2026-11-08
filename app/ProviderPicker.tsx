'use client';
import './provider-picker.css';

export type LiveProvider='gemini'|'groq';
export type ProviderState={label:string;available:boolean;model:string;unavailable_reason:string|null};
export type ProviderStatus={gemini:ProviderState;groq:ProviderState}|null;

const OPTIONS:{id:LiveProvider;label:string;badge:string;tone:'recommended'|'alternative';description:string}[]=[
 {id:'gemini',label:'Google Gemini',badge:'Recommended',tone:'recommended',description:'Smart financial explanations and personalised learning assistance'},
 {id:'groq',label:'Groq',badge:'Alternative',tone:'alternative',description:'Fast AI responses powered by the existing Groq model'},
];
const REASONS:Record<string,string>={
 paused:'Paused on this demo',
 protection_unavailable:'Temporarily unavailable',
 missing_key:'Not configured on this server',
 invalid_model:'Model setting invalid',
 disabled:'Switched off on this server',
};

/** Choose the live AI provider. Gemini is LifeFlow's default; "Recommended" states that preference, not a quality claim. */
export default function ProviderPicker({value,onChange,status,statusError}:{value:string;onChange:(p:LiveProvider)=>void;status:ProviderStatus;statusError:boolean}){
 return <fieldset className="provider-picker">
  <legend>Choose your AI</legend>
  <div className="provider-options">
   {OPTIONS.map(o=>{
    const s=status?.[o.id];const selected=value===o.id;
    const state=statusError?'Status unknown':!s?'Checking…':s.available?'Ready':REASONS[s.unavailable_reason||'']||'Unavailable';
    return <label key={o.id} className={`provider-option${selected?' selected':''}${s&&!s.available?' unavailable':''}`}>
     <input type="radio" name="ai-provider" value={o.id} checked={selected} onChange={()=>onChange(o.id)}/>
     <span className="provider-head"><b>{o.label}</b><span className={`provider-badge ${o.tone}`} title={o.id==='gemini'?'LifeFlow’s default choice, not a quality claim':undefined}>{o.badge}</span></span>
     <small className="provider-desc">{o.description}</small>
     <span className="provider-state"><span className="provider-dot" aria-hidden="true"/>{state}{s?.available&&<> · <code>{s.model}</code></>}</span>
    </label>;
   })}
  </div>
  <p className="provider-note"><b>Why “Recommended”?</b> Google Gemini is LifeFlow’s default choice for this demo; it is not a claim that one model is better. Both providers get the same figures and pass the same quality checks. Switch at any time; your question, figures and scenario stay as they are.</p>
 </fieldset>;
}
