'use client';
import type {CompanionAnswer} from '../lib/ai/pipeline';
import type {GateCheck} from '../lib/ai/gate';

const mark:Record<GateCheck['status'],string>={passed:'✓',failed:'✕',not_run:'–',not_applicable:'·'};
const word:Record<GateCheck['status'],string>={passed:'Passed',failed:'Failed',not_run:'Not run',not_applicable:'Not applicable'};

export function CheckList({checks}:{checks:GateCheck[]}){
 return <ul className="check-list">{checks.map(c=><li key={c.id} className={`check check-${c.status}`}><span aria-hidden="true">{mark[c.status]}</span> <span className="sr-only">{word[c.status]}: </span>{c.label}{c.status!=='passed'&&<small> · {word[c.status]}{c.detail?` — ${c.detail}`:''}</small>}</li>)}</ul>;
}

type Line={state:'ok'|'fail'|'info'|'skip';text:string};
/** Plain-language summary derived only from checks that actually ran. */
export function verificationLines(a:CompanionAnswer):Line[]{
 const s=(id:string)=>a.checks.find(c=>c.id===id)?.status;
 const lines:Line[]=[];
 if(a.kind==='safety-rule'||a.kind==='clarification')lines.push({state:'info',text:a.kind==='clarification'?'More information is needed before LifeFlow can explain this; no AI was used.':'Stopped by a LifeFlow safety rule before reaching the AI.'});
 else if(a.kind==='model')lines.push({state:'ok',text:'Passed the evaluation gate: every check below ran and passed.'});
 else lines.push({state:'fail',text:s('model')==='passed'?'The AI’s answer could not be verified, so it was not shown.':'No AI answer was produced, so it could not be verified.'});
 const map:[string,string,string][]=[
  ['calculation','Figures calculated by LifeFlow, not the AI','No figures to calculate'],
  ['numbers','Calculation consistency: the AI’s figures match LifeFlow’s','Calculation consistency check failed'],
  ['source_support','Source support: each claim traced to your figures or an official source','Source support check failed'],
  ['investment_safety','Safety screening: no investment advice, return promises or bank-specific rules','Safety screening failed'],
  ['uncertainty','Uncertainty: the answer states what it cannot know','Uncertainty check failed'],
 ];
 for(const [id,ok,bad] of map){const st=s(id);if(st==='passed')lines.push({state:'ok',text:ok});else if(st==='failed')lines.push({state:'fail',text:bad});else if(st==='not_run'&&a.kind!=='safety-rule'&&a.kind!=='clarification'&&id!=='calculation')lines.push({state:'skip',text:`${ok.split(':')[0]}: not checked`})}
 lines.push(a.missing_information.length?{state:'info',text:`Missing information identified (${a.missing_information.length})`}:{state:'info',text:'No missing information flagged'});
 if(a.topic&&['salary_delay','debit_failure','mandate_basics','job_transition'].includes(a.topic))lines.push({state:'info',text:'Official verification required: confirm account and payment details with your bank or fund house'});
 return lines;
}
const icon={ok:'✓',fail:'✕',info:'ℹ',skip:'–'};

export default function AnswerView({answer,disclaimer}:{answer:CompanionAnswer;disclaimer:string}){
 const List=({title,items}:{title:string;items:string[]})=>items.length?<div className="answer-block"><b>{title}</b><ul>{items.map(x=><li key={x}>{x}</li>)}</ul></div>:null;
 return <div className="answer" aria-live="polite">
  <div className="eyebrow">RESPONSE · {answer.scenario.toUpperCase()}</div>
  <div className={`simulation-badge kind-${answer.kind}`}>{answer.label}</div>
  <div className="verification" aria-label="Verification summary"><b>Verification</b><ul>{verificationLines(answer).map(l=><li key={l.text} className={`v-${l.state}`}><span aria-hidden="true">{icon[l.state]}</span> {l.text}</li>)}</ul></div>
  {answer.notice&&<p className="answer-notice" role="status">{answer.notice}</p>}
  <h3>{answer.summary}</h3>
  {answer.claims.length?<ul className="claims">{answer.claims.map((c,i)=><li key={i}><p>{c.text}</p><small>Based on: {c.supports.map(s=>s.label).join(' · ')}</small></li>)}</ul>:<p>{answer.explanation}</p>}
  {answer.requires_abstention&&answer.kind==='model'&&answer.abstention_reason&&<p className="answer-notice"><b>Why the AI did not answer fully:</b> {answer.abstention_reason}</p>}
  {answer.sources.length>0&&<div className="answer-sources"><b>Official sources for this explanation</b>{answer.sources.map(s=><p key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.organisation} · {s.title} ({s.locator}) ↗</a><small>“{s.excerpt}”</small><small>Limitation: {s.limitations}</small></p>)}</div>}
  {answer.user_facts.length>0&&<div className="answer-block"><b>What you entered</b><dl className="fact-list">{answer.user_facts.map(f=><div key={f.id}><dt>{f.label}</dt><dd>{f.display}</dd></div>)}</dl></div>}
  {answer.calculated_facts.length>0&&<div className="answer-block"><b>Calculated by LifeFlow</b><dl className="fact-list">{answer.calculated_facts.map(f=><div key={f.id}><dt>{f.label}</dt><dd>{f.display}</dd></div>)}</dl></div>}
  <List title="Assumptions" items={answer.assumptions}/>
  <List title="Missing information" items={answer.missing_information}/>
  <List title="Educational next steps" items={answer.next_steps}/>
  <div className="answer-block"><b>Uncertainty</b><p>{answer.uncertainty}</p></div>
  {answer.model&&<p className="muted model-meta">{answer.kind==='model'?'Generated by':'Attempted with'} {answer.model.name} · {answer.model.library} · prompt {answer.model.prompt_version}{answer.latency_ms!==undefined?` · ${(answer.latency_ms/1000).toFixed(1)} s`:''}{answer.attempts&&answer.attempts>1?` · ${answer.attempts} attempts`:''}</p>}
  <p className="disclaimer answer-disclaimer">{disclaimer}</p>
 </div>;
}
