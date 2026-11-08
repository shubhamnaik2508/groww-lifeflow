'use client';
import {useEffect,useRef,useState} from 'react';
import {openPanel} from './motion';
import type {ProviderStatus} from './ProviderPicker';
import {calculateScenario,type Profile,type Scenario} from '../lib/calc';
import {runCompanion,type CompanionAnswer} from '../lib/ai/pipeline';
import {PROMPT_VERSION} from '../lib/ai/prompt';
import {casesFromEvidenceLog,failureCategory,fileSchema,observedBehaviour,type Dataset,type EvalCase} from '../lib/evaluation';
import {CheckList} from './AnswerView';
import ModelPanel from './ModelPanel';
import type {BrowserModel} from './useBrowserModel';

const DEFAULT_PROFILE:Profile={salary:30000,expenses:18000,sip:3000,sipDate:''};
const API='/api/lifeflow/companion';
const PUBLISHED='/evaluation/lifeflow-human-review.json';
type Mode='gemini'|'groq'|'browser'|'rules';
const live=(m:Mode):m is 'gemini'|'groq'=>m==='gemini'||m==='groq';
type Run={answer:CompanionAnswer;timestamp:string;mode:Mode;behaviour_match:boolean|null;failure_category:string};
type Review={factual:string;grounding:string;context:string;safety:string;abstention:string;result:string;correction:string;failure_category:string;reviewer:string};
const blankReview:Review={factual:'',grounding:'',context:'',safety:'',abstention:'',result:'',correction:'',failure_category:'',reviewer:''};
const dimensions=[['factual','Factual accuracy'],['grounding','Source grounding'],['context','Context relevance'],['safety','Investment safety'],['abstention','Appropriate abstention']] as const;
const kindLabel={'human-labelled':'Human-labelled evaluation data','engineering-fixture':'Engineering fixture · not evaluation evidence','simulation':'Simulation · not evaluation evidence'};
const modeLabel:Record<Mode,string>={gemini:'LifeFlow AI (Google Gemini, server)',groq:'LifeFlow AI (Groq, server)',browser:'Experimental on-device model',rules:'Rule-based guide (not AI)'};

function toScenario(c:EvalCase,profile:Profile):Scenario|null{
 if(!c.scenario)return null;
 return {...calculateScenario(c.scenario.type,c.scenario.inputs,profile),id:`eval-${c.id}`,createdAt:new Date(0).toISOString(),inputs:c.scenario.inputs,profile};
}

export default function Reliability({model,providers}:{model:BrowserModel;providers:ProviderStatus}){
 const [dataset,setDataset]=useState<Dataset|null>(null),[cases,setCases]=useState<EvalCase[]>([]),[runs,setRuns]=useState<Record<string,Run>>({}),[reviews,setReviews]=useState<Record<string,Review>>({});
 const [message,setMessage]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(''),[selected,setSelected]=useState('');
 const [mode,setMode]=useState<Mode>('gemini');
 const ready=(m:'gemini'|'groq')=>Boolean(providers?.[m]?.available);
 const runWith=(m:'gemini'|'groq')=>`${modeLabel[m]}${providers?(ready(m)?` · ${providers[m].model}`:' · not available'):''}`;
 const casesPanel=useRef<HTMLElement>(null);
 useEffect(()=>{openPanel(casesPanel.current)},[cases.length]);
 async function load(file:File){
  try{
   if(file.size>2000000)throw Error('File exceeds 2 MB.');
   const raw=JSON.parse(await file.text());
   let f:{dataset:Dataset;cases:EvalCase[];runs?:Record<string,unknown>;reviews?:Record<string,unknown>};
   if(raw?.format==='lifeflow-evidence-log-v1')f=casesFromEvidenceLog(raw);
   else{const parsed=fileSchema.safeParse(raw);if(!parsed.success){const i=parsed.error.issues[0];throw Error(`Not a LifeFlow evaluation file: ${i?.path.join('.')||'root'} — ${i?.message}. See fixtures/README.md for the format.`)}f=parsed.data}
   const ids=new Set<string>();
   for(const c of f.cases){if(ids.has(c.id))throw Error(`Duplicate case id "${c.id}".`);ids.add(c.id);if(f.dataset.kind==='human-labelled'&&!c.provenance)throw Error(`Case "${c.id}" is marked human-labelled but has no provenance (labeller, labelled_at, source).`);if(c.scenario)toScenario(c,c.profile||DEFAULT_PROFILE)}
   const restoredRuns:Record<string,Run>={},restoredReviews:Record<string,Review>={};
   for(const c of f.cases){const r=f.runs?.[c.id] as Run|undefined;if(r&&typeof r==='object'&&r.answer&&typeof r.timestamp==='string')restoredRuns[c.id]=r;const v=f.reviews?.[c.id];if(v&&typeof v==='object')restoredReviews[c.id]={...blankReview,...Object.fromEntries(Object.entries(v as Record<string,unknown>).filter(([k,x])=>k in blankReview&&typeof x==='string').map(([k,x])=>[k,String(x).slice(0,2000)]))}}
   setDataset(f.dataset);setCases(f.cases);setRuns(restoredRuns);setReviews(restoredReviews);setSelected(f.cases[0].id);
   setMessage(f.dataset.kind==='human-labelled'?`${f.cases.length} human-labelled cases imported from “${f.dataset.name}”. Check the provenance before relying on them.`:`${f.cases.length} cases imported as ${kindLabel[f.dataset.kind]}. They are excluded from the genuine sample size.`);
  }catch(e){setMessage(e instanceof Error?e.message:'Could not read the file.')}
 }
 async function loadPublished(){
  try{const r=await fetch(PUBLISHED,{cache:'no-store'});if(!r.ok)throw Error();await load(new File([await r.text()],'lifeflow-human-review.json',{type:'application/json'}))}
  catch{setMessage('Could not load the published review.')}
 }
 async function answerCase(c:EvalCase,m:Mode):Promise<CompanionAnswer>{
  const profile=c.profile||DEFAULT_PROFILE;let scenario:Scenario|null=null;try{scenario=toScenario(c,profile)}catch{}
  if(live(m)){
   try{
    const r=await fetch(API,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:c.question,profile,provider:m,scenario:c.scenario?{type:c.scenario.type,inputs:c.scenario.inputs,profile}:null})});
    const body=await r.json();if(r.ok&&body?.kind)return body;
    return runCompanion({question:c.question,profile,scenario,unavailable:{code:String(body?.error||'service_error'),message:String(body?.message||'The AI service returned an error.')}});
   }catch{return runCompanion({question:c.question,profile,scenario,unavailable:{code:'network_error',message:'The AI service could not be reached.'}})}
  }
  const useModel=m==='browser'&&model.status==='ready';
  return runCompanion({question:c.question,profile,scenario,generate:useModel?model.generate:null,model:useModel?model.info:null,onTimeout:model.interrupt,unavailable:useModel?null:{code:'rule_based_run',message:'Run with the rule-based guide; this is not an AI evaluation.'}});
 }
 async function run(){
  setBusy(true);
  for(const [i,c] of cases.entries()){
   setProgress(`Running case ${i+1} of ${cases.length} with ${modeLabel[mode]}…`);
   const answer=await answerCase(c,mode);
   const observed=observedBehaviour(answer);
   const result:Run={answer,timestamp:answer.created_at,mode,behaviour_match:c.expected_behaviour?observed===c.expected_behaviour:null,failure_category:failureCategory(answer)};
   setRuns(r=>({...r,[c.id]:result}));
   if(live(mode)&&i<cases.length-1)await new Promise(r=>setTimeout(r,8000));
  }
  setBusy(false);setProgress('');setMessage(`Run complete with ${modeLabel[mode]}. Automated gate results and behaviour matches are shown per case; correctness needs human review.`);
 }
 function update(key:keyof Review,value:string){setReviews(r=>({...r,[selected]:{...blankReview,...r[selected],[key]:value}}))}
 function download(){const blob=new Blob([JSON.stringify({dataset,cases,runs,reviews,exportedAt:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='lifeflow-evaluation-review.json';a.click();URL.revokeObjectURL(url)}
 const genuine=dataset?.kind==='human-labelled'?cases.length:0;
 const runList=Object.values(runs);const aiRuns=runList.filter(r=>r.answer.model);
 const passed=aiRuns.filter(r=>r.answer.kind==='model').length,blocked=aiRuns.filter(r=>r.answer.kind==='rule-based').length,ruleStopped=runList.filter(r=>r.answer.kind==='safety-rule'||r.answer.kind==='clarification').length;
 const compared=runList.filter(r=>r.behaviour_match!==null);const matched=compared.filter(r=>r.behaviour_match).length;
 const reviewed=Object.entries(reviews).filter(([id,r])=>r.result&&runs[id]);const outcomes=reviewed.reduce<Record<string,number>>((acc,[,r])=>({...acc,[r.result]:(acc[r.result]||0)+1}),{});
 const current=cases.find(c=>c.id===selected),currentRun=runs[selected],review={...blankReview,...reviews[selected]};
 const canRun=live(mode)?true:mode==='browser'?model.status==='ready':true;
 return <>
  <div className="metrics">
   <div><span>GENUINE LABELLED CASES</span><strong>{genuine}</strong><small>{dataset&&dataset.kind!=='human-labelled'?'Import is not human-labelled · excluded':'Human-labelled with provenance'}</small></div>
   <div><span>AI RESPONSES</span><strong>{aiRuns.length}</strong><small>{passed} passed gate · {blocked} blocked · {ruleStopped} stopped by rules</small></div>
   <div><span>BEHAVIOUR MATCH</span><strong>{compared.length?`${matched}/${compared.length}`:'—'}</strong><small>{dataset?.kind==='human-labelled'?'Answer/abstain/clarify vs human label':'Not evidence: labels are not human'}</small></div>
   <div className="metric-dark"><span>ACCURACY</span><strong className="smaller">{reviewed.length&&genuine?`${reviewed.length} reviewed`:'Not claimed'}</strong><small>{Object.entries(outcomes).map(([k,v])=>`${k}: ${v}`).join(' · ')||'No human review recorded'}</small></div>
  </div>
  <section className="card reliability">
   <div className="eyebrow">EVIDENCE, NOT ASSUMPTIONS</div><h3>Evaluate the live AI against labelled cases.</h3>
   <p><b>Current status:</b> one human-labelled set of 6 cases (answer, abstain, clarify), each labelled by a different human tester, was run against the live AI on 8 November 2026 (IST). Behaviour matched on 4 of 6. The human review recorded 2 Pass, 2 Correct abstention, 1 Partial pass and 1 Fail. In the two cases that did not match (a salary delay and a rent increase), the investment-safety check blocked the AI’s answer and the generic rule-based guide was shown instead. Six cases are too few to establish accuracy. Use “Load published review” to inspect every output, check and verdict. The Evidence Log in the separate SIP Discovery Engine holds 20 records, all marked synthetic, labelled with discovery themes rather than expected companion answers. It can be imported for context-relevance review but is shown as a simulation, not evidence.</p>
   <p>Import a LifeFlow evaluation file (<code>fixtures/README.md</code>) or an Evidence Log export from <code>scripts/export-evidence-log.mjs</code>. Each case runs through the same pipeline and evaluation gate as the AI Companion. Cases may carry their own illustrative profile and scenario; otherwise ₹30,000 salary, ₹18,000 expenses and ₹3,000 SIP are used.</p>
   <div className="model-actions">
    <label className="outline file-label">Import JSON <input type="file" accept="application/json,.json" aria-label="Import evaluation JSON" onChange={e=>{const f=e.target.files?.[0];if(f)void load(f);e.currentTarget.value=''}}/></label>
    <label className="field eval-mode"><span>Run with</span><select value={mode} onChange={e=>setMode(e.target.value as Mode)} disabled={busy}><option value="gemini">{runWith('gemini')}</option><option value="groq">{runWith('groq')}</option><option value="rules">{modeLabel.rules}</option><option value="browser">{modeLabel.browser}</option></select></label>
    <button className="outline" disabled={busy} onClick={()=>void loadPublished()}>Load published review</button>
    <button className="primary" disabled={!cases.length||busy||!canRun} onClick={()=>void run()}>{busy?'Running…':'Run cases'}</button>
    {Object.keys(runs).length>0&&<button className="outline" onClick={download}>Export runs and reviews</button>}
   </div>
   {live(mode)&&providers&&!ready(mode)&&<p className="answer-notice">{modeLabel[mode]} is not available on this server right now, so every case will show the labelled fallback. That run tests failure handling, not the AI.</p>}
   {mode==='browser'&&model.status!=='ready'&&<details className="eval-model" open><summary>Load the experimental on-device model first</summary><ModelPanel model={model} compact/></details>}
   {progress&&<p role="status"><span className="t-shimmer" data-text={progress}>{progress}</span></p>}
   <p role="status">{message||'No labelled examples imported.'}</p>
   {dataset&&<p className={dataset.kind==='human-labelled'?'dataset-kind genuine':'dataset-kind fixture'}><b>{kindLabel[dataset.kind]}</b> · {dataset.name} · created {dataset.created}{dataset.labelled_by?` · labelled by ${dataset.labelled_by}`:''}{dataset.description?` · ${dataset.description}`:''}</p>}
   <div className="dimensions">{dimensions.map(([,l])=><span key={l}>{l}</span>)}</div>
   <p className="muted">Automated results show which checks ran and whether the behaviour (answer, abstain, clarify) matched the label; they do not establish correctness. A small sample cannot establish accuracy beyond the cases reviewed. Data stays in this page until you export it.</p>
  </section>
  {cases.length>0&&<section ref={casesPanel} className="card reliability t-panel-slide" data-open="false">
   <label className="field"><span>Inspect case</span><select value={selected} onChange={e=>setSelected(e.target.value)}>{cases.map(c=><option key={c.id} value={c.id}>{c.id} · {c.question.slice(0,65)}</option>)}</select></label>
   {current&&<><h3>{current.question}</h3>
    <p><b>Expected ({dataset?.kind==='human-labelled'?'human label':'not a human label'}{current.label_scope==='theme_only'?', theme only':''}):</b> {current.expected}{current.expected_behaviour?` · expected behaviour: ${current.expected_behaviour}`:''}</p>
    <p><b>Rationale:</b> {current.rationale}</p>
    <p className="muted">Scenario context: {current.scenario?`${current.scenario.type} · ${Object.entries(current.scenario.inputs).map(([k,v])=>`${k}=${v}`).join(', ')}`:'none'} · profile {JSON.stringify(current.profile||DEFAULT_PROFILE)}</p>
    {current.provenance&&<p className="muted">Provenance: {current.provenance.labeller} · {current.provenance.labelled_at} · {current.provenance.source}</p>}</>}
   {currentRun?<>
    <p><b>Actual output</b> · {currentRun.answer.label} · {currentRun.timestamp} · {modeLabel[currentRun.mode]} · {currentRun.answer.model?`${currentRun.answer.model.id} · prompt ${currentRun.answer.model.prompt_version}`:`no AI · prompt ${PROMPT_VERSION}`}{currentRun.answer.latency_ms!==undefined?` · ${(currentRun.answer.latency_ms/1000).toFixed(1)} s`:''}</p>
    <p className="muted">Observed behaviour: {observedBehaviour(currentRun.answer)}{currentRun.behaviour_match===null?'':currentRun.behaviour_match?' · matches label':' · does not match label'} · automatic failure category: {currentRun.failure_category}</p>
    {currentRun.answer.notice&&<p className="answer-notice">{currentRun.answer.notice}</p>}
    <div className="eval-columns"><div><b>Displayed to the user</b><pre className="eval-output">{[currentRun.answer.summary,currentRun.answer.explanation,...currentRun.answer.next_steps.map(s=>`• ${s}`),currentRun.answer.uncertainty].join('\n')}</pre></div><div><b>Raw AI output</b><pre className="eval-output">{currentRun.answer.raw_output??'No AI output (not run, unavailable, or stopped before the AI).'}</pre></div></div>
    <b>Automated checks</b><CheckList checks={currentRun.answer.checks}/>
    <div className="form-grid">{dimensions.map(([d,l])=><label className="field" key={d}><span>{l}</span><select value={review[d]} onChange={e=>update(d,e.target.value)}><option value="">Not reviewed</option><option>Pass</option><option>Partial</option><option>Fail</option></select></label>)}<label className="field"><span>Overall human outcome</span><select value={review.result} onChange={e=>update('result',e.target.value)}><option value="">Not reviewed</option><option>Pass</option><option>Partial pass</option><option>Fail</option><option>Correct abstention</option><option>Incorrect abstention</option></select></label><label className="field"><span>Failure category (reviewer)</span><select value={review.failure_category} onChange={e=>update('failure_category',e.target.value)}><option value="">Use automatic</option><option>factual_error</option><option>unsupported_claim</option><option>irrelevant_context</option><option>unsafe_advice</option><option>missed_abstention</option><option>unnecessary_abstention</option><option>arithmetic_error</option><option>other</option></select></label><label className="field"><span>Reviewer name or initials</span><input value={review.reviewer} onChange={e=>update('reviewer',e.target.value)} maxLength={80}/></label></div>
    <label className="field"><span>Reviewer correction</span><textarea value={review.correction} onChange={e=>update('correction',e.target.value)} maxLength={2000}/></label>
   </>:<div className="empty">Not run yet.</div>}
  </section>}
 </>;
}
