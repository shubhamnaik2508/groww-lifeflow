// Genuine Groq connectivity test (Test B). Never prints the API key.
// Usage: node --env-file=.env.local scripts/groq-connectivity.mjs [--url http://localhost:3000]
// 1) Direct: authentication, model availability, strict structured output.
// 2) End to end: the app's server route with the reference scenario and a changed scenario (Test C).
import Groq from 'groq-sdk';

const args=process.argv.slice(2);const i=args.indexOf('--url');const base=i>=0?args[i+1]:process.env.LIFEFLOW_TEST_URL||'http://localhost:3000';
const key=process.env.GROQ_API_KEY;const model=process.env.GROQ_MODEL||'openai/gpt-oss-120b';
const results=[];const record=(name,ok,detail)=>{results.push({name,ok,detail});console.log(`${ok?'PASS':'FAIL'} ${name}${detail?` — ${detail}`:''}`)};
if(!key){console.log('NOT VERIFIED: GROQ_API_KEY is not set in this process. Add it to .env.local and run with --env-file=.env.local.');process.exit(3)}
console.log(`Key present (value not shown). Model: ${model}. Server: ${base}`);
const groq=new Groq({apiKey:key,timeout:25000,maxRetries:0});
try{const list=await groq.models.list();const ids=list.data.map(m=>m.id);record('authentication',true,`${ids.length} models visible`);record('model availability',ids.includes(model),ids.includes(model)?`${model} is listed`:`${model} not in /models`)}
catch(e){record('authentication',false,`${e?.status??''} ${e?.name??'error'}`);process.exit(1)}
const STRICT=new Set(['openai/gpt-oss-20b','openai/gpt-oss-120b','qwen/qwen3.8-27b','meta-models/muse-spark-open']);const strict=STRICT.has(model);
console.log(`Structured output mode for ${model}: ${strict?'strict json_schema':'json_object (model not listed for strict structured outputs)'}`);
try{
 const t=Date.now();
 const r=await groq.chat.completions.create({model,messages:[{role:'system',content:'Reply with JSON only.'},{role:'user',content:'Return {"ok":true,"word":"lifeflow"}.'}],response_format:strict?{type:'json_schema',json_schema:{name:'probe',strict:true,schema:{type:'object',properties:{ok:{type:'boolean'},word:{type:'string'}},required:['ok','word'],additionalProperties:false}}}:{type:'json_object'},...(/gpt-oss/.test(model)?{reasoning_effort:'low',include_reasoning:false}:{})});
 const parsed=JSON.parse(r.choices[0].message.content);record(strict?'strict structured output':'JSON object output',parsed.ok===true&&typeof parsed.word==='string',`${Date.now()-t} ms`);
}catch(e){record('structured output',false,`${e?.status??''} ${e?.name??'error'}`)}
const ask=async(question,profile,scenario)=>{const t=Date.now();const r=await fetch(`${base}/api/lifeflow/companion`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,profile,scenario})});return {status:r.status,body:await r.json(),ms:Date.now()-t}};
try{
 const status=await fetch(`${base}/api/lifeflow/companion`).then(r=>r.json());record('server reports AI available',status.ai_available===true,`model ${status.model}`);
 const p1={salary:30000,expenses:18000,sip:3000,sipDate:'2026-12-05'};
 const a=await ask('How does this expense affect my cash?',p1,{type:'expense',inputs:{amount:'5000',category:'Health',frequency:'one-time'},profile:p1});
 record('end-to-end reference answer',a.status===200&&!!a.body.kind,`${a.body.label} · ${a.ms} ms${a.body.fallback_reason?` · ${a.body.fallback_reason}`:''}`);
 if(a.body.kind==='model')record('reference figures from LifeFlow',/9,000/.test(a.body.explanation)&&/4,000/.test(a.body.explanation),a.body.explanation.slice(0,240));
 const p2={salary:52000,expenses:30000,sip:6000,sipDate:'2026-12-05'};
 const b=await ask('How does this expense affect my cash?',p2,{type:'expense',inputs:{amount:'8000',category:'Repair',frequency:'one-time'},profile:p2});
 record('changed scenario answer',b.status===200&&!!b.body.kind,`${b.body.label} · ${b.ms} ms`);
 if(b.body.kind==='model')record('changed figures reflected (₹16,000 → ₹8,000)',/16,000/.test(b.body.explanation)&&/8,000/.test(b.body.explanation)&&!/9,000/.test(b.body.explanation),b.body.explanation.slice(0,240));
}catch(e){record('end-to-end',false,e instanceof Error?e.message:String(e))}
const failed=results.filter(r=>!r.ok).length;console.log(`\nRESULT ${results.length-failed}/${results.length} passed`);process.exitCode=failed?1:0;
