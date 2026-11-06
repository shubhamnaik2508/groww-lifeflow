import 'server-only';
import Groq,{APIConnectionError,APIConnectionTimeoutError,APIError,APIUserAbortError,AuthenticationError,BadRequestError,NotFoundError,PermissionDeniedError,RateLimitError} from 'groq-sdk';
import {GENERATION} from './prompt';
import {ProviderError,type Generate,type ModelInfo} from './pipeline';

/** Production Groq model with strict JSON-schema structured outputs (checked against Groq docs on 2026-11-07). */
export const DEFAULT_GROQ_MODEL='openai/gpt-oss-120b';
export const GROQ_TIMEOUT_MS=25000;
/** Models Groq documents as supporting strict JSON-schema structured outputs (docs checked 2026-11-07). */
export const STRICT_SCHEMA_MODELS=new Set(['openai/gpt-oss-20b','openai/gpt-oss-120b','qwen/qwen3.8-27b','meta-models/muse-spark-open']);
export const structuredMode=(model:string)=>STRICT_SCHEMA_MODELS.has(model)?'json_schema_strict':'json_object';
const MODEL_ID=/^[a-z0-9][a-z0-9._/-]{1,80}$/i;

export type GroqConfig={configured:true;apiKey:string;model:string}|{configured:false;reason:'disabled'|'missing_key'|'invalid_model';model:string};

/** Reads server-only configuration. The key is never returned to callers outside this module's adapter. */
export function groqConfig(env:Record<string,string|undefined>=process.env):GroqConfig{
 const model=(env.GROQ_MODEL||DEFAULT_GROQ_MODEL).trim();
 if(env.LIFEFLOW_AI_ENABLED==='false')return {configured:false,reason:'disabled',model};
 if(!MODEL_ID.test(model))return {configured:false,reason:'invalid_model',model};
 const apiKey=env.GROQ_API_KEY?.trim();
 if(!apiKey)return {configured:false,reason:'missing_key',model};
 return {configured:true,apiKey,model};
}

export const UNAVAILABLE_MESSAGES:Record<string,string>={
 disabled:'The AI Companion is switched off on this server, so the rule-based guide is shown. It is not an AI response.',
 missing_key:'The AI service is not configured on this server (no Groq API key), so the rule-based guide is shown. It is not an AI response.',
 invalid_model:'The AI model setting on this server is invalid, so the rule-based guide is shown. It is not an AI response.',
};

/** Maps SDK errors to stable codes. Messages never include provider response bodies. */
export function toProviderError(error:unknown):ProviderError{
 if(error instanceof ProviderError)return error;
 if(error instanceof APIUserAbortError)return new ProviderError('provider_aborted','The AI request was cancelled. The rule-based guide is shown; it is not an AI response.');
 if(error instanceof APIConnectionTimeoutError)return new ProviderError('provider_timeout','The AI service did not respond in time. The rule-based guide is shown; it is not an AI response.',true);
 if(error instanceof APIConnectionError)return new ProviderError('provider_network','The server could not reach the AI service. The rule-based guide is shown; it is not an AI response.',true);
 if(error instanceof AuthenticationError)return new ProviderError('provider_auth','The AI service rejected this server’s API key. The rule-based guide is shown; it is not an AI response.');
 if(error instanceof PermissionDeniedError)return new ProviderError('provider_forbidden','The AI service refused access for this server. The rule-based guide is shown; it is not an AI response.');
 if(error instanceof NotFoundError)return new ProviderError('provider_model_unavailable','The configured AI model is not available. The rule-based guide is shown; it is not an AI response.');
 if(error instanceof RateLimitError)return new ProviderError('provider_rate_limited','The AI service is busy (rate limit reached). Please try again shortly. The rule-based guide is shown; it is not an AI response.',true);
 if(error instanceof BadRequestError){
  // Groq returns 400 when strict structured output could not be produced; treat it as malformed output.
  const body=JSON.stringify((error as APIError).error??'').toLowerCase();
  if(body.includes('json')||body.includes('schema')||body.includes('validate'))return new ProviderError('provider_schema_rejected','The AI could not produce an answer in the required structure. The rule-based guide is shown; it is not an AI response.',true);
  return new ProviderError('provider_bad_request','The AI service could not process this request. The rule-based guide is shown; it is not an AI response.');
 }
 if(error instanceof APIError&&typeof error.status==='number'&&error.status>=500)return new ProviderError('provider_unavailable','The AI service is temporarily unavailable. The rule-based guide is shown; it is not an AI response.',true);
 return new ProviderError('provider_error','The AI service returned an unexpected error. The rule-based guide is shown; it is not an AI response.');
}

type ChatClient={chat:{completions:{create:(body:Record<string,unknown>,options?:{signal?:AbortSignal;timeout?:number})=>Promise<{choices?:{message?:{content?:string|null};finish_reason?:string|null}[]}>}}};

export function groqModelInfo(model:string):ModelInfo{return {id:model,name:`Groq · ${model}`,library:'groq-sdk 1.6.0',provider:'groq'}}

/** Creates the Generate function used by the shared pipeline. `client` is injectable for tests. */
export function groqGenerate(config:{apiKey:string;model:string},client?:ChatClient):Generate{
 const groq:ChatClient=client??(new Groq({apiKey:config.apiKey,timeout:GROQ_TIMEOUT_MS,maxRetries:1}) as unknown as ChatClient);
 const strict=structuredMode(config.model)==='json_schema_strict';
 return async({messages,schema,signal})=>{
  // Models without strict structured outputs use JSON object mode with the schema in the prompt; the gate validates either way.
  const sent=strict?messages:messages.map((m,i)=>i===0?{...m,content:`${m.content}\nThe JSON object must match this JSON Schema exactly:\n${JSON.stringify(schema)}`}:m);
  let reply;
  try{
   reply=await groq.chat.completions.create({
    model:config.model,messages:sent,temperature:GENERATION.temperature,top_p:GENERATION.top_p,max_completion_tokens:4096,seed:GENERATION.seed,
    response_format:strict?{type:'json_schema',json_schema:{name:'lifeflow_companion_answer',strict:true,schema}}:{type:'json_object'},
    ...(/gpt-oss/.test(config.model)?{reasoning_effort:'low',include_reasoning:false}:{}),
   },{signal,timeout:GROQ_TIMEOUT_MS});
  }catch(error){throw toProviderError(error)}
  const choice=reply.choices?.[0];
  if(choice?.finish_reason==='length')throw new ProviderError('provider_truncated','The AI answer was cut off before it finished. The rule-based guide is shown; it is not an AI response.');
  const content=choice?.message?.content;
  if(typeof content!=='string'||!content.trim())throw new ProviderError('provider_empty','The AI returned an empty answer. The rule-based guide is shown; it is not an AI response.');
  return content;
 };
}
