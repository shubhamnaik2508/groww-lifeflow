import {NextResponse} from 'next/server';
import {z} from 'zod';
import type {Scenario} from '../../../../lib/calc';
import {calculateScenario} from '../../../../lib/calc';
import {preflight} from '../../../../lib/ai/context';
import {GEMINI_TIMEOUT_MS,GEMINI_UNAVAILABLE_MESSAGES,geminiConfig,geminiCostMicros,geminiGenerate,geminiModelInfo,geminiReserveMicros} from '../../../../lib/ai/gemini';
import {groqConfig,groqGenerate,groqModelInfo,GROQ_TIMEOUT_MS,UNAVAILABLE_MESSAGES} from '../../../../lib/ai/groq';
import {ProviderError,runCompanion,type Generate,type ModelInfo} from '../../../../lib/ai/pipeline';
import {PROMPT_VERSION} from '../../../../lib/ai/prompt';
import {admit,geminiDailyBudgetMicros,geminiSpend,LIMITS,protectionMode,SpendRefused,type Provider} from '../../../../lib/ai/public-guard';
import {clientIdentity,readBoundedBody,RequestTooLarge} from '../../../../lib/request-security';

export const maxDuration=60;
const MAX_BYTES=10000;
const amount=z.number().finite().nonnegative().max(1e8);
const profile=z.object({salary:amount,expenses:amount,sip:amount,sipDate:z.string().max(10)}).strict();
const input=z.object({
 question:z.string().trim().min(1).max(600),profile,
 scenario:z.object({type:z.enum(['expense','salary','rent','job','failure']),inputs:z.record(z.string().max(32),z.string().max(150)).refine(v=>Object.keys(v).length<=12),profile}).strict().nullable().optional(),
 provider:z.enum(['gemini','groq']).optional(),
}).strict();
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});
const DEFAULT_PROVIDER:Provider='gemini';

function providerStatus(env:Record<string,string|undefined>=process.env){
 const enabled=env.AI_DEMO_ENABLED==='true',protection=protectionMode(env);
 const g=geminiConfig(env),q=groqConfig(env);
 const state=(c:{configured:boolean;model:string;reason?:string})=>{
  const reason=!enabled?'paused':protection==='unavailable'?'protection_unavailable':c.configured?null:(c as {reason:string}).reason;
  return {available:reason===null,model:c.model,unavailable_reason:reason};
 };
 return {enabled,protection,providers:{gemini:{label:'Google Gemini',...state(g)},groq:{label:'Groq',...state(q)}}};
}

/** Public status: which providers can answer and which models are pinned. Never returns credentials or limits' internals. */
export async function GET(){
 const s=providerStatus();const d=s.providers[DEFAULT_PROVIDER];
 return json({
  default_provider:DEFAULT_PROVIDER,providers:s.providers,ai_enabled:s.enabled,protection:s.protection,prompt_version:PROMPT_VERSION,
  limits:{per_visitor:{minute:LIMITS.visitorPerMinute,hour:LIMITS.visitorPerHour,day:LIMITS.visitorPerDay},max_question_chars:600},
  // Kept for older clients: the default provider's status.
  provider:DEFAULT_PROVIDER,ai_available:d.available,model:d.model,unavailable_reason:d.unavailable_reason,
 });
}

/** Rejects cross-site posts; the companion is only meant to be called from this site's own pages. */
function crossSite(req:Request){
 if(req.headers.get('sec-fetch-site')==='cross-site')return true;
 const origin=req.headers.get('origin');if(!origin)return false;
 try{return new URL(origin).host!==new URL(req.url).host&&new URL(origin).host!==req.headers.get('host')}catch{return true}
}

export async function POST(req:Request){
 const declared=Number(req.headers.get('content-length')||0);
 if(declared>MAX_BYTES)return json({error:'too_large',message:'Request too large.'},413);
 const encoding=req.headers.get('content-encoding');
 if(encoding&&encoding.toLowerCase()!=='identity')return json({error:'unsupported_encoding',message:'Unsupported content encoding.'},415);
 if(crossSite(req))return json({error:'forbidden_origin',message:'This endpoint only accepts requests from the LifeFlow site.'},403);
 let payload:z.infer<typeof input>;
 try{payload=input.parse(JSON.parse(await readBoundedBody(req,MAX_BYTES)))}
 catch(error){return error instanceof RequestTooLarge?json({error:'too_large',message:'Request too large.'},413):json({error:'invalid_input',message:'Please check your question and financial inputs.'},400)}
 // Recompute the scenario on the server; client-supplied results are never trusted.
 let scenario:Scenario|null=null;
 if(payload.scenario){try{scenario={...calculateScenario(payload.scenario.type,payload.scenario.inputs,payload.scenario.profile),id:'request',createdAt:new Date().toISOString(),inputs:payload.scenario.inputs,profile:payload.scenario.profile}}catch{return json({error:'invalid_scenario',message:'The saved scenario could not be recalculated. Please run it again in the Scenario Lab.'},400)}}
 const provider:Provider=payload.provider??DEFAULT_PROVIDER;
 const base={question:payload.question,profile:payload.profile,scenario,signal:req.signal,schemaRetries:1};

 // Safety rules and clarifying questions never reach a model, so they do not use the AI allowance.
 if(preflight(payload.question,payload.profile,scenario).decision!=='proceed')return json(await runCompanion({...base,generate:null,model:null}));

 const gemini=geminiConfig(),groq=groqConfig();
 const configured=provider==='gemini'?gemini.configured:groq.configured;
 if(!configured){
  const reason=provider==='gemini'?(gemini as {reason:string}).reason:(groq as {reason:string}).reason;
  const message=(provider==='gemini'?GEMINI_UNAVAILABLE_MESSAGES:UNAVAILABLE_MESSAGES)[reason]??'The AI service is not available, so the rule-based guide is shown. It is not an AI response.';
  return json(await runCompanion({...base,generate:null,model:null,unavailable:{code:reason,message}}));
 }

 const admission=await admit({visitor:clientIdentity(req.headers),provider});
 if(!admission.ok)return json({error:admission.error,message:admission.message,provider},admission.status);
 const started=Date.now();
 try{
  let generate:Generate,model:ModelInfo,timeout:number;
  if(provider==='gemini'&&gemini.configured){
   const spend=geminiSpend(admission.store,admission.day,geminiReserveMicros(gemini.model),u=>geminiCostMicros(gemini.model,u),geminiDailyBudgetMicros());
   const budget={
    reserve:async()=>{try{await spend.reserve()}catch(e){throw e instanceof SpendRefused&&e.reason==='budget'?new ProviderError('demo_budget_exhausted','Today’s spending limit for Google Gemini on this demo is reached, so the rule-based guide is shown. It resets at midnight IST. You can try Groq.'):new ProviderError('protection_unavailable','The AI service is temporarily unavailable on this server, so the rule-based guide is shown. It is not an AI response.')}},
    settle:spend.settle,
   };
   generate=geminiGenerate(gemini,budget);model=geminiModelInfo(gemini.model);timeout=GEMINI_TIMEOUT_MS;
  }else if(groq.configured){
   generate=groqGenerate(groq);model=groqModelInfo(groq.model);timeout=GROQ_TIMEOUT_MS;
  }else return json({error:'unavailable',message:'The AI service is not available.'},503);
  const answer=await runCompanion({...base,generate,model,timeoutMs:timeout+2000,stallMs:timeout+2000});
  // Operational log only: no question text, figures, addresses or credentials.
  console.info(JSON.stringify({event:'lifeflow_ai',provider,model:model.id,kind:answer.kind,fallback:answer.fallback_reason??null,attempts:answer.attempts??null,ms:Date.now()-started}));
  return json(answer);
 }finally{await admission.release()}
}

