import {NextResponse} from 'next/server';
import {z} from 'zod';
import type {Scenario} from '../../../../lib/calc';
import {calculateScenario} from '../../../../lib/calc';
import {groqConfig,groqGenerate,groqModelInfo,GROQ_TIMEOUT_MS,UNAVAILABLE_MESSAGES} from '../../../../lib/ai/groq';
import {runCompanion} from '../../../../lib/ai/pipeline';
import {PROMPT_VERSION} from '../../../../lib/ai/prompt';
import {rateLimit,rateLimitMode} from '../../../../lib/rate-limit';
import {clientIdentity,readBoundedBody,RequestTooLarge} from '../../../../lib/request-security';

export const maxDuration=30;
const MAX_BYTES=10000;
const amount=z.number().finite().nonnegative().max(1e8);
const profile=z.object({salary:amount,expenses:amount,sip:amount,sipDate:z.string().max(10)}).strict();
const input=z.object({
 question:z.string().trim().min(1).max(600),profile,
 scenario:z.object({type:z.enum(['expense','salary','rent','job','failure']),inputs:z.record(z.string().max(32),z.string().max(150)).refine(v=>Object.keys(v).length<=12),profile}).strict().nullable().optional(),
}).strict();
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}});

/** Public status: whether AI is available and which model is pinned. Never returns credentials. */
export async function GET(){
 const c=groqConfig();
 return json({provider:'groq',ai_available:c.configured,model:c.model,prompt_version:PROMPT_VERSION,unavailable_reason:c.configured?null:c.reason,rate_limit:rateLimitMode()});
}

export async function POST(req:Request){
 const declared=Number(req.headers.get('content-length')||0);
 if(declared>MAX_BYTES)return json({error:'too_large',message:'Request too large.'},413);
 const encoding=req.headers.get('content-encoding');
 if(encoding&&encoding.toLowerCase()!=='identity')return json({error:'unsupported_encoding',message:'Unsupported content encoding.'},415);
 const limited=await rateLimit(clientIdentity(req.headers));
 if(limited!=='allow')return json({error:limited==='limit'?'rate_limited':'protection_unavailable',message:limited==='limit'?'Too many questions in a minute. Please wait a moment and try again.':'The AI service is temporarily unavailable on this server. Your scenario calculations still work.'},limited==='limit'?429:503);
 let payload:z.infer<typeof input>;
 try{payload=input.parse(JSON.parse(await readBoundedBody(req,MAX_BYTES)))}
 catch(error){return error instanceof RequestTooLarge?json({error:'too_large',message:'Request too large.'},413):json({error:'invalid_input',message:'Please check your question and financial inputs.'},400)}
 // Recompute the scenario on the server; client-supplied results are never trusted.
 let scenario:Scenario|null=null;
 if(payload.scenario){try{scenario={...calculateScenario(payload.scenario.type,payload.scenario.inputs,payload.scenario.profile),id:'request',createdAt:new Date().toISOString(),inputs:payload.scenario.inputs,profile:payload.scenario.profile}}catch{return json({error:'invalid_scenario',message:'The saved scenario could not be recalculated. Please run it again in the Scenario Lab.'},400)}}
 const config=groqConfig();
 const generate=config.configured?groqGenerate(config):null;
 const answer=await runCompanion({question:payload.question,profile:payload.profile,scenario,generate,model:generate?groqModelInfo(config.model):null,unavailable:config.configured?null:{code:config.reason,message:UNAVAILABLE_MESSAGES[config.reason]},timeoutMs:GROQ_TIMEOUT_MS+2000,stallMs:GROQ_TIMEOUT_MS+2000,schemaRetries:1,signal:req.signal});
 // No question text or figures are logged.
 return json(answer);
}
