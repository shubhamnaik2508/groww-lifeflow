import 'server-only';
import {GENERATION} from './prompt';
import {ProviderError,type Generate,type ModelInfo} from './pipeline';

/**
 * Google Gemini adapter (REST generateContent, no SDK). Default LifeFlow AI provider.
 * Model checked against Google's model and pricing pages on 2026-11-08: gemini-3.5-flash-lite is a Stable Flash-Lite
 * model with structured output, `minimal` thinking and paid pricing of $0.30 input / $2.50 output per 1M tokens.
 */
export const DEFAULT_GEMINI_MODEL='gemini-3.5-flash-lite';
export const GEMINI_TIMEOUT_MS=25000;
/** Output cap, including thinking tokens (Gemini bills and counts thinking as output). */
export const GEMINI_MAX_OUTPUT_TOKENS=2048;
const API='https://generativelanguage.googleapis.com/v1beta/models';
const MODEL_ID=/^gemini-[a-z0-9.-]{1,60}$/i;

/** Paid-tier USD per 1M tokens. Unknown models are charged at the most expensive Flash rate so budgets stay conservative. */
const PRICES:Record<string,{input:number;output:number}>={
 'gemini-3.5-flash-lite':{input:0.30,output:2.50},
 'gemini-3.1-flash-lite':{input:0.25,output:1.50},
 'gemini-3.6-flash':{input:1.50,output:7.50},
 'gemini-3.8-flash':{input:1.50,output:7.50},
};
const WORST_PRICE={input:1.50,output:7.50};
export const geminiPrice=(model:string)=>PRICES[model]??WORST_PRICE;
/** Cost in micro-USD (integer) for a call's token usage. */
export function geminiCostMicros(model:string,usage:{input:number;output:number}){
 const p=geminiPrice(model);
 return Math.ceil(usage.input*p.input+usage.output*p.output);
}
/** Worst-case cost reserved before each call: the input-size ceiling plus the full output cap. */
export const geminiReserveMicros=(model:string)=>geminiCostMicros(model,{input:12000,output:GEMINI_MAX_OUTPUT_TOKENS});

export type GeminiConfig={configured:true;apiKey:string;model:string}|{configured:false;reason:'disabled'|'missing_key'|'invalid_model';model:string};

/** Reads server-only configuration. The key never leaves this module's adapter. */
export function geminiConfig(env:Record<string,string|undefined>=process.env):GeminiConfig{
 const model=(env.GEMINI_MODEL||DEFAULT_GEMINI_MODEL).trim();
 if(env.LIFEFLOW_AI_ENABLED==='false')return {configured:false,reason:'disabled',model};
 if(!MODEL_ID.test(model))return {configured:false,reason:'invalid_model',model};
 const apiKey=env.GEMINI_API_KEY?.trim();
 if(!apiKey)return {configured:false,reason:'missing_key',model};
 return {configured:true,apiKey,model};
}

export const GEMINI_UNAVAILABLE_MESSAGES:Record<string,string>={
 disabled:'The AI Companion is switched off on this server, so the rule-based guide is shown. It is not an AI response.',
 missing_key:'Google Gemini is not configured on this server, so the rule-based guide is shown. It is not an AI response. You can try Groq instead.',
 invalid_model:'The Gemini model setting on this server is invalid, so the rule-based guide is shown. It is not an AI response. You can try Groq instead.',
};

export function geminiModelInfo(model:string):ModelInfo{return {id:model,name:`Google Gemini · ${model}`,library:'Gemini API generateContent (REST)',provider:'gemini'}}

/** Maps HTTP failures to stable codes. Messages never include provider response bodies or credentials. */
export function geminiError(status:number,bodyText:string):ProviderError{
 const body=bodyText.toLowerCase();
 const tail=' The rule-based guide is shown; it is not an AI response.';
 if(status===400&&body.includes('api key'))return new ProviderError('provider_auth','Google Gemini rejected this server’s API key.'+tail);
 if(status===401||status===403)return new ProviderError('provider_forbidden','Google Gemini refused access for this server.'+tail);
 if(status===404)return new ProviderError('provider_model_unavailable','The configured Gemini model is not available.'+tail);
 if(status===429)return new ProviderError('provider_rate_limited','Google Gemini is busy or its quota is reached. Please try again shortly, or try Groq.'+tail,true);
 if(status===400)return new ProviderError('provider_bad_request','Google Gemini could not process this request.'+tail);
 if(status>=500)return new ProviderError('provider_unavailable','Google Gemini is temporarily unavailable. Please try again, or try Groq.'+tail,true);
 return new ProviderError('provider_error','Google Gemini returned an unexpected error.'+tail);
}

export type GeminiUsage={input:number;output:number};
/** Spend hooks: reserve the worst case before a call (may refuse), then settle with the real usage. */
export type GeminiBudget={reserve:()=>Promise<void>;settle:(usage:GeminiUsage|null)=>Promise<void>};
type Fetch=(url:string,init:RequestInit)=>Promise<Response>;

type GeminiResponse={candidates?:{content?:{parts?:{text?:string;thought?:boolean}[]};finishReason?:string}[];promptFeedback?:{blockReason?:string};usageMetadata?:{promptTokenCount?:number;candidatesTokenCount?:number;thoughtsTokenCount?:number}};

/** Creates the Generate function used by the shared pipeline. `fetchImpl` is injectable for tests. */
export function geminiGenerate(config:{apiKey:string;model:string},budget?:GeminiBudget,fetchImpl:Fetch=fetch):Generate{
 return async({messages,schema,signal})=>{
  const system=messages.filter(m=>m.role==='system').map(m=>m.content).join('\n\n');
  const contents=messages.filter(m=>m.role!=='system').map(m=>({role:'user',parts:[{text:m.content}]}));
  const body={
   ...(system?{systemInstruction:{parts:[{text:system}]}}:{}),
   contents,
   generationConfig:{
    responseMimeType:'application/json',responseJsonSchema:schema,maxOutputTokens:GEMINI_MAX_OUTPUT_TOKENS,
    temperature:GENERATION.temperature,topP:GENERATION.top_p,seed:GENERATION.seed,thinkingConfig:{thinkingLevel:'minimal'},
   },
  };
  if(budget)await budget.reserve();
  let usage:GeminiUsage|null=null;
  try{
   let res:Response;
   try{
    res=await fetchImpl(`${API}/${encodeURIComponent(config.model)}:generateContent`,{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':config.apiKey},body:JSON.stringify(body),signal:AbortSignal.any([signal,AbortSignal.timeout(GEMINI_TIMEOUT_MS)])});
   }catch(error){
    if(signal.aborted)throw new ProviderError('provider_aborted','The AI request was cancelled. The rule-based guide is shown; it is not an AI response.');
    if(error instanceof Error&&(error.name==='TimeoutError'||error.name==='AbortError'))throw new ProviderError('provider_timeout','Google Gemini did not respond in time. The rule-based guide is shown; it is not an AI response.',true);
    throw new ProviderError('provider_network','The server could not reach Google Gemini. The rule-based guide is shown; it is not an AI response.',true);
   }
   if(!res.ok)throw geminiError(res.status,await res.text().catch(()=>''));
   const data=await res.json() as GeminiResponse;
   const u=data.usageMetadata;
   if(u)usage={input:u.promptTokenCount??0,output:(u.candidatesTokenCount??0)+(u.thoughtsTokenCount??0)};
   if(data.promptFeedback?.blockReason)throw new ProviderError('provider_blocked','Google Gemini declined this request. The rule-based guide is shown; it is not an AI response.');
   const candidate=data.candidates?.[0];
   if(candidate?.finishReason==='MAX_TOKENS')throw new ProviderError('provider_truncated','The AI answer was cut off before it finished. The rule-based guide is shown; it is not an AI response.');
   if(candidate?.finishReason&&!['STOP','FINISH_REASON_UNSPECIFIED'].includes(candidate.finishReason))throw new ProviderError('provider_blocked','Google Gemini stopped without a usable answer. The rule-based guide is shown; it is not an AI response.');
   const text=(candidate?.content?.parts??[]).filter(p=>!p.thought&&typeof p.text==='string').map(p=>p.text).join('');
   if(!text.trim())throw new ProviderError('provider_empty','The AI returned an empty answer. The rule-based guide is shown; it is not an AI response.');
   return text;
  }finally{
   if(budget)await budget.settle(usage).catch(()=>{});
  }
 };
}
