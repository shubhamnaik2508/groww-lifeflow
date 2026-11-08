import type {Profile,Scenario} from '../calc';
import {offlineCompanion} from '../offline-companion';
import type {Source} from '../sources';
import {preflight,type Fact,type Topic} from './context';
import {gateModelOutput,OUTPUT_STAGES,type GateCheck,type Rendered} from './gate';
import {buildUserMessage,GENERATION,PROMPT_VERSION,responseSchema,supportIds,SYSTEM_PROMPT} from './prompt';

export type ChatMessage={role:'system'|'user';content:string};
/** Returns the model's raw text. Implemented by the Groq adapter (server), the WebLLM adapter (browser) or test doubles. */
export type Generate=(request:{messages:ChatMessage[];schema:Record<string,unknown>;signal:AbortSignal;onProgress?:(tokens:number)=>void})=>Promise<string>;
export type ModelInfo={id:string;name:string;library:string;provider:'gemini'|'groq'|'webllm'|'test'};

/** A provider failure with a stable code and a user-safe message. Never carries credentials or inputs. */
export class ProviderError extends Error{
 constructor(readonly code:string,readonly userMessage:string,readonly retryable=false){super(code);this.name='ProviderError'}
}

export type AnswerKind='model'|'rule-based'|'safety-rule'|'clarification';
export type Claim=Rendered['claims'][number];
export type CompanionAnswer={
 kind:AnswerKind;label:string;scenario:string;summary:string;explanation:string;claims:Claim[];
 known_facts:string[];user_facts:Fact[];calculated_facts:Fact[];facts_used:string[];assumptions:string[];missing_information:string[];
 sources:Source[];next_steps:string[];uncertainty:string;requires_abstention:boolean;abstention_reason:string;clarifying_question:string;safety_flags:string[];
 checks:GateCheck[];notice?:string;fallback_reason?:string;topic:Topic|null;created_at:string;attempts?:number;
 model?:ModelInfo&{prompt_version:string;params:typeof GENERATION};raw_output?:string;latency_ms?:number;
};

export const LABELS:Record<AnswerKind,string>={
 model:'AI-generated · passed every quality check',
 'rule-based':'Rule-based guide · not AI',
 'safety-rule':'LifeFlow safety rule · no AI used',
 clarification:'Clarifying question · no AI used',
};
export const DEFAULT_TIMEOUT_MS=180000;
export const STALL_TIMEOUT_MS=45000;
class Timeout extends Error {}

const scenarioName:Record<string,string>={cash_flow:'Monthly cash flow',unexpected_expense:'Unexpected expense',rent_increase:'Rent increase',salary_delay:'Salary delay',job_transition:'Job transition or income interruption',debit_failure:'SIP debit failure',sip_basics:'SIP basics',mandate_basics:'SIP mandates and payments'};
const split=(facts:Fact[])=>({user_facts:facts.filter(f=>f.origin==='user'),calculated_facts:facts.filter(f=>f.origin==='calculated'),known_facts:facts.map(f=>`${f.label}: ${f.display} (${f.origin==='user'?'entered by you':'calculated by LifeFlow'})`)});
const uniq=(xs:string[])=>[...new Set(xs.map(x=>x.trim()).filter(Boolean))];

export async function runCompanion(args:{
 question:string;profile:Profile;scenario:Scenario|null;generate?:Generate|null;model?:ModelInfo|null;
 /** Why no model is available (e.g. no API key). Shown honestly instead of pretending an AI answered. */
 unavailable?:{code:string;message:string}|null;
 timeoutMs?:number;stallMs?:number;signal?:AbortSignal;onTimeout?:()=>void;onProgress?:(tokens:number)=>void;
 /** Extra attempts after a structured-output (schema) failure only. Safety and grounding failures are never retried. */
 schemaRetries?:number;
}):Promise<CompanionAnswer>{
 const created_at=new Date().toISOString();
 const pre=preflight(args.question,args.profile,args.scenario);
 const scenario=pre.topic?scenarioName[pre.topic]:args.scenario?.title||'Monthly cash flow';
 const inputCheck:GateCheck={id:'input',label:'Input validation and pre-AI safety rules',status:pre.decision==='proceed'?'passed':'failed',detail:pre.decision==='proceed'?undefined:pre.reason};
 const calcCheck:GateCheck={id:'calculation',label:'Figures calculated by LifeFlow (not the AI)',status:pre.facts.length?'passed':'not_applicable'};
 const notRun=():GateCheck[]=>OUTPUT_STAGES.map(([id,label])=>({id,label,status:'not_run' as const}));
 if(pre.decision!=='proceed'){
  const kind:AnswerKind=pre.decision==='clarify'?'clarification':'safety-rule';
  return {kind,label:LABELS[kind],scenario,summary:pre.message,explanation:pre.detail,claims:[],...split(pre.facts),facts_used:[],assumptions:pre.assumptions,missing_information:pre.missing,sources:[],next_steps:[],uncertainty:'No bank or investment account has been accessed or verified.',requires_abstention:true,abstention_reason:pre.detail,clarifying_question:pre.decision==='clarify'?pre.message:'',safety_flags:[pre.reason],checks:[inputCheck,calcCheck,{id:'model',label:'AI generation',status:'not_run',detail:'Stopped before the AI by a LifeFlow rule.'}],topic:pre.topic,created_at,fallback_reason:pre.reason};
 }
 const sourceCheck:GateCheck={id:'sources',label:'Approved official sources retrieved',status:pre.sources.length?'passed':'not_applicable',detail:pre.sources.length?pre.sources.map(s=>s.id).join(', '):'No approved source covers this topic; none may be cited.'};
 const fallback=(reason:string,notice:string,checks:GateCheck[],extra:Partial<CompanionAnswer>={}):CompanionAnswer=>{
  const sim=offlineCompanion(args.question,args.profile,args.scenario);
  return {kind:'rule-based',label:LABELS['rule-based'],scenario,summary:sim.summary,explanation:sim.explanation,claims:[],...split(pre.facts),facts_used:[],assumptions:pre.assumptions,missing_information:uniq([...pre.missing,...sim.missing_information]),sources:sim.sources.length?sim.sources as Source[]:pre.sources,next_steps:sim.next_steps.length?sim.next_steps:['Verify account-specific information through your bank’s or fund house’s official channels.'],uncertainty:sim.uncertainty,requires_abstention:sim.requires_abstention,abstention_reason:'',clarifying_question:'',safety_flags:[reason],checks:[...checks,{id:'fallback',label:'Rule-based guide shown instead of AI text',status:'passed'}],notice,fallback_reason:reason,topic:pre.topic,created_at,...extra};
 };
 if(!args.generate||!args.model){
  const u=args.unavailable||{code:'model_not_loaded',message:'The AI is not available, so this is the rule-based guide. It is not an AI response.'};
  return fallback(u.code,u.message,[inputCheck,calcCheck,sourceCheck,{id:'model',label:'AI generation',status:'not_run',detail:u.code}]);
 }
 const messages:ChatMessage[]=[{role:'system',content:SYSTEM_PROMPT},{role:'user',content:buildUserMessage(pre.topic,pre.question,pre.facts,pre.assumptions,pre.missing,pre.sources)}];
 const schema=responseSchema(supportIds(pre.facts,pre.assumptions,pre.sources));
 const modelMeta={...args.model,prompt_version:PROMPT_VERSION,params:GENERATION};
 const started=Date.now();const maxAttempts=1+Math.max(0,Math.min(2,args.schemaRetries??0));
 let lastRaw='';let gate:ReturnType<typeof gateModelOutput>|null=null;let attempts=0;
 for(attempts=1;attempts<=maxAttempts;attempts++){
  const controller=new AbortController();const outer=args.signal;if(outer)outer.addEventListener('abort',()=>controller.abort(),{once:true});
  let timer:ReturnType<typeof setTimeout>|undefined;let stall:ReturnType<typeof setTimeout>|undefined;
  try{
   let rejectTimeout:(e:unknown)=>void=()=>{};const timedOut=new Promise<never>((_,reject)=>{rejectTimeout=reject});
   const expire=()=>{controller.abort();args.onTimeout?.();rejectTimeout(new Timeout())};
   const stallMs=args.stallMs??STALL_TIMEOUT_MS;stall=setTimeout(expire,stallMs);
   timer=setTimeout(expire,args.timeoutMs??DEFAULT_TIMEOUT_MS);
   lastRaw=await Promise.race([args.generate({messages,schema,signal:controller.signal,onProgress:n=>{clearTimeout(stall);stall=setTimeout(expire,stallMs);args.onProgress?.(n)}}),timedOut]);
  }catch(error){
   const timedOut=error instanceof Timeout;const pe=error instanceof ProviderError?error:null;
   const code=timedOut?'model_timeout':pe?.code||'model_error';
   const message=timedOut?'The AI did not respond in time, so the rule-based guide is shown instead. It is not an AI response.':pe?.userMessage||'The AI could not produce a response, so the rule-based guide is shown instead. It is not an AI response.';
   return fallback(code,message,[inputCheck,calcCheck,sourceCheck,{id:'model',label:'AI generation',status:'failed',detail:timedOut?'Timed out.':code},...notRun()],{model:modelMeta,latency_ms:Date.now()-started,attempts});
  }finally{clearTimeout(timer);clearTimeout(stall)}
  gate=gateModelOutput({raw:lastRaw,facts:pre.facts,assumptions:pre.assumptions,sources:pre.sources,topic:pre.topic,question:pre.question});
  if(gate.passed||gate.failedStage!=='schema')break;
 }
 attempts=Math.min(attempts,maxAttempts);
 const latency_ms=Date.now()-started;
 const modelCheck:GateCheck={id:'model',label:'AI generation',status:'passed',detail:`${args.model.name} · ${(latency_ms/1000).toFixed(1)} s${attempts>1?` · ${attempts} attempts`:''}`};
 if(!gate||!gate.passed){
  const stage=gate&&!gate.passed?gate.failedStage:'schema';const label=gate?.checks.find(c=>c.id===stage)?.label||'quality';
  return fallback(`gate_${stage}`,`The AI’s answer could not be verified (the “${label}” check failed), so it was not shown. The rule-based guide is shown instead; it is not an AI response.`,[inputCheck,calcCheck,sourceCheck,modelCheck,...(gate?.checks||notRun())],{model:modelMeta,raw_output:lastRaw,latency_ms,attempts});
 }
 const r=gate.rendered;
 return {kind:'model',label:r.requires_abstention?'AI declined to answer · passed every quality check':LABELS.model,scenario,summary:r.summary,explanation:r.explanation,claims:r.claims,...split(pre.facts),facts_used:r.facts_used,assumptions:pre.assumptions,missing_information:uniq([...pre.missing,...r.missing_information]),sources:r.sources,next_steps:r.next_steps,uncertainty:r.uncertainty,requires_abstention:r.requires_abstention,abstention_reason:r.abstention_reason,clarifying_question:'',safety_flags:[],checks:[inputCheck,calcCheck,sourceCheck,modelCheck,...gate.checks],topic:pre.topic,created_at,model:modelMeta,raw_output:lastRaw,latency_ms,attempts};
}
