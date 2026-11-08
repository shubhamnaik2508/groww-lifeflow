import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {MemoryStore,KILL_SWITCH_KEY,LIMITS,istDay,geminiDailyBudgetMicros} from './ai/public-guard';
import {geminiCostMicros,geminiReserveMicros} from './ai/gemini';

const create=vi.fn();
vi.mock('groq-sdk',async importOriginal=>{const real=await importOriginal<typeof import('groq-sdk')>();class FakeGroq{chat={completions:{create}};constructor(public opts:unknown){}}return {...real,default:FakeGroq,Groq:FakeGroq}});
const {GET,POST}=await import('../app/api/lifeflow/companion/route');

const KEY='test-gemini-key-never-shown-0123456789';
const profile={salary:30000,expenses:18000,sip:3000,sipDate:'2026-12-05'};
const expense={type:'expense',inputs:{amount:'5000',category:'Health',frequency:'one-time'},profile};
const good={summary:'The one-time expense lowers your estimated remaining cash for this month.',points:[{text:'Before the expense, LifeFlow estimates {scenario_before} left after your recurring expenses and SIP.',supports:['scenario_before']},{text:'After the one-time expense of {one_time_expense}, the estimate becomes {scenario_after}.',supports:['one_time_expense','scenario_after']}],missing_information:[],next_steps:['Review the expenses you entered for this month.'],uncertainty:'This estimate may differ from your actual bank balance.',requires_abstention:false,abstention_reason:''};
const question={question:'How does this expense affect my cash?',profile,scenario:expense};

let store=new MemoryStore();
let gemini:(body:Record<string,unknown>,headers:Headers)=>Promise<Response>;
const geminiCalls:{url:string;body:Record<string,unknown>;headers:Headers}[]=[];
const ok=(text:string,usage={promptTokenCount:3000,candidatesTokenCount:600,thoughtsTokenCount:200},finishReason='STOP')=>new Response(JSON.stringify({candidates:[{content:{parts:[{text}]},finishReason}],usageMetadata:usage}),{status:200});
const fakeFetch=vi.fn(async(url:string|URL|Request,init?:RequestInit)=>{
 const u=String(url);
 if(u.startsWith('https://test-store.upstash.io/pipeline')){const cmds=JSON.parse(String(init?.body));return new Response(JSON.stringify((await store.pipeline(cmds)).map(result=>({result}))),{status:200})}
 if(u.startsWith('https://generativelanguage.googleapis.com/')){const body=JSON.parse(String(init?.body));const headers=new Headers(init?.headers);geminiCalls.push({url:u,body,headers});return gemini(body,headers)}
 throw new Error('unexpected fetch '+u);
});
let n=0;
const post=(body:unknown,headers:Record<string,string>={})=>POST(new Request('http://localhost/api/lifeflow/companion',{method:'POST',headers:{'x-vercel-forwarded-for':`198.51.100.${(n++%250)+1}`,...headers},body:JSON.stringify(body)}));
const spendKey=()=>`lifeflow:ai:spend:gemini:${istDay(Date.now())}`;

beforeEach(()=>{
 store=new MemoryStore();geminiCalls.length=0;create.mockReset();gemini=async()=>ok(JSON.stringify(good));
 vi.stubGlobal('fetch',fakeFetch);
 for(const [k,v] of Object.entries({VERCEL:'1',AI_DEMO_ENABLED:'true',KV_REST_API_URL:'https://test-store.upstash.io',KV_REST_API_TOKEN:'test-store-token',UPSTASH_REDIS_REST_URL:'',UPSTASH_REDIS_REST_TOKEN:'',GEMINI_API_KEY:KEY,GEMINI_MODEL:'',GROQ_API_KEY:'gsk_test_groq_key_0123456789',GROQ_MODEL:'',LIFEFLOW_AI_ENABLED:''}))vi.stubEnv(k,v);
});
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});

describe('Gemini is the default provider',()=>{
 it('status names Gemini as the default, reports both providers and never leaks keys',async()=>{
  const text=await (await GET()).text();const s=JSON.parse(text);
  expect(s.default_provider).toBe('gemini');expect(s.providers.gemini).toMatchObject({label:'Google Gemini',available:true,model:'gemini-3.5-flash-lite'});
  expect(s.providers.groq).toMatchObject({label:'Groq',available:true});expect(s.protection).toBe('shared');
  expect(text).not.toContain(KEY);expect(text).not.toContain('gsk_');expect(text).not.toContain('test-store-token');
 });
 it('answers through Gemini when no provider is given, with strict JSON output and capped tokens',async()=>{
  const res=await post(question);const text=await res.text();const body=JSON.parse(text);
  expect(res.status).toBe(200);expect(body.kind).toBe('model');expect(body.model).toMatchObject({provider:'gemini',id:'gemini-3.5-flash-lite'});
  expect(body.explanation).toContain('₹9,000.00');expect(body.explanation).toContain('₹4,000.00');
  expect(create).not.toHaveBeenCalled();expect(geminiCalls).toHaveLength(1);
  const call=geminiCalls[0];expect(call.url).toContain('/models/gemini-3.5-flash-lite:generateContent');expect(call.headers.get('x-goog-api-key')).toBe(KEY);
  const gc=call.body.generationConfig as Record<string,unknown>;expect(gc.responseMimeType).toBe('application/json');expect(gc.responseJsonSchema).toBeTypeOf('object');expect(gc.maxOutputTokens).toBe(2048);expect(gc.thinkingConfig).toEqual({thinkingLevel:'minimal'});
  expect(JSON.stringify(call.body)).not.toContain(KEY);expect(text).not.toContain(KEY);
 });
 it('uses Groq when the visitor chooses it, without calling Gemini',async()=>{
  create.mockResolvedValue({choices:[{message:{content:JSON.stringify(good)},finish_reason:'stop'}]});
  const body=await (await post({...question,provider:'groq'})).json();expect(body.model.provider).toBe('groq');expect(geminiCalls).toHaveLength(0);
 });
 it('never switches provider silently: a Gemini failure gives a labelled fallback that names Gemini',async()=>{
  gemini=async()=>new Response('{"error":{"message":"quota"}}',{status:429});
  const body=await (await post(question)).json();
  expect(body.kind).toBe('rule-based');expect(body.fallback_reason).toBe('provider_rate_limited');expect(body.notice).toMatch(/Gemini/);expect(body.notice).toMatch(/not an AI response/);expect(create).not.toHaveBeenCalled();
 });
 it.each([[404,'','provider_model_unavailable'],[400,'API key not valid','provider_auth'],[403,'','provider_forbidden'],[500,'','provider_unavailable']])('maps HTTP %s to %s',async(status,msg,code)=>{
  gemini=async()=>new Response(JSON.stringify({error:{message:msg}}),{status});
  const body=await (await post(question)).json();expect(body.fallback_reason).toBe(code);expect(JSON.stringify(body)).not.toContain(KEY);
 });
 it('treats a truncated answer as a failure',async()=>{gemini=async()=>ok('{"summary":"x"',undefined,'MAX_TOKENS');expect((await (await post(question)).json()).fallback_reason).toBe('provider_truncated')});
 it('reports a missing Gemini key honestly and suggests Groq',async()=>{vi.stubEnv('GEMINI_API_KEY','');const body=await (await post(question)).json();expect(body.kind).toBe('rule-based');expect(body.notice).toMatch(/try Groq/);expect(geminiCalls).toHaveLength(0)});
});

describe('Gemini spend ceiling',()=>{
 it('defaults to ₹100 a day (GST included) and can be set with GEMINI_DAILY_BUDGET_INR',()=>{
  expect(geminiDailyBudgetMicros({})).toBe(Math.floor(100/1.18/88*1e6));expect(LIMITS.geminiDailyBudgetMicros).toBe(geminiDailyBudgetMicros({}));
  expect(geminiDailyBudgetMicros({GEMINI_DAILY_BUDGET_INR:'50'})).toBe(Math.floor(50/1.18/88*1e6));
  for(const bad of ['0','-5','5000','abc',''])expect(geminiDailyBudgetMicros({GEMINI_DAILY_BUDGET_INR:bad})).toBe(geminiDailyBudgetMicros({}));
 });
 it('applies the ceiling set in the environment',async()=>{
  vi.stubEnv('GEMINI_DAILY_BUDGET_INR','10');
  await store.pipeline([['SET',spendKey(),String(geminiDailyBudgetMicros({GEMINI_DAILY_BUDGET_INR:'10'})-geminiReserveMicros('gemini-3.5-flash-lite')+1)]]);
  expect((await (await post(question)).json()).fallback_reason).toBe('demo_budget_exhausted');expect(geminiCalls).toHaveLength(0);
 });
 it('records the actual cost of each call from token usage',async()=>{
  await post(question);
  expect(Number((await store.pipeline([['GET',spendKey()]]))[0])).toBe(geminiCostMicros('gemini-3.5-flash-lite',{input:3000,output:800}));
 });
 it('refuses a call that would exceed the daily budget, without calling Gemini',async()=>{
  await store.pipeline([['SET',spendKey(),String(LIMITS.geminiDailyBudgetMicros-geminiReserveMicros('gemini-3.5-flash-lite')+1)]]);
  const body=await (await post(question)).json();
  expect(body.fallback_reason).toBe('demo_budget_exhausted');expect(body.notice).toMatch(/spending limit/);expect(geminiCalls).toHaveLength(0);
 });
 it('keeps the full reservation when Gemini reports no usage',async()=>{
  gemini=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{text:JSON.stringify(good)}]},finishReason:'STOP'}]}),{status:200});
  await post(question);expect(Number((await store.pipeline([['GET',spendKey()]]))[0])).toBe(geminiReserveMicros('gemini-3.5-flash-lite'));
 });
});

describe('public demo protection (applies to both providers)',()=>{
 it.each(['gemini','groq'])('the server kill switch AI_DEMO_ENABLED stops %s before any provider call',async provider=>{
  vi.stubEnv('AI_DEMO_ENABLED','');const r=await post({...question,provider});expect(r.status).toBe(503);expect((await r.json()).error).toBe('ai_paused');expect(geminiCalls).toHaveLength(0);expect(create).not.toHaveBeenCalled();
 });
 it('the instant kill switch in the shared store stops AI without a redeploy',async()=>{
  await store.pipeline([['SET',KILL_SWITCH_KEY,'1']]);const r=await post(question);expect(r.status).toBe(503);expect((await r.json()).error).toBe('ai_paused');expect(geminiCalls).toHaveLength(0);
 });
 it('safety rules still answer while AI is paused, because they never reach a model',async()=>{
  vi.stubEnv('AI_DEMO_ENABLED','');const r=await post({question:'Which mutual fund should I buy?',profile});expect(r.status).toBe(200);expect((await r.json()).kind).toBe('safety-rule');
 });
 it('fails closed when the shared store errors',async()=>{
  const original=fakeFetch.getMockImplementation()!;
  fakeFetch.mockImplementation(async(url,init)=>String(url).includes('upstash')?new Response('err',{status:500}):original(url,init));
  try{const r=await post(question);expect(r.status).toBe(503);expect((await r.json()).error).toBe('protection_unavailable');expect(geminiCalls).toHaveLength(0)}
  finally{fakeFetch.mockImplementation(original)}
 });
 it('allows one request at a time per visitor',async()=>{
  let finish:(r:Response)=>void=()=>{};gemini=()=>new Promise(r=>{finish=r});
  const h={'x-vercel-forwarded-for':'203.0.113.50'};
  const first=post(question,h);await vi.waitFor(()=>expect(geminiCalls).toHaveLength(1));
  const second=await post(question,h);expect(second.status).toBe(429);expect((await second.json()).error).toBe('busy');
  finish(ok(JSON.stringify(good)));expect((await first).status).toBe(200);
  gemini=async()=>ok(JSON.stringify(good));expect((await post(question,h)).status).toBe(200);
 });
 it('enforces the shared daily allowance per provider across all visitors',async()=>{
  await store.pipeline([['SET',`lifeflow:ai:g:gemini:${istDay(Date.now())}`,String(LIMITS.globalPerDay.gemini)]]);
  const r=await post(question);expect(r.status).toBe(429);expect((await r.json()).error).toBe('demo_allowance_exhausted');
  create.mockResolvedValue({choices:[{message:{content:JSON.stringify(good)},finish_reason:'stop'}]});
  expect((await post({...question,provider:'groq'})).status).toBe(200);
 });
 it('caps AI requests running at once across all visitors',async()=>{
  for(let i=0;i<LIMITS.globalConcurrent;i++)await store.pipeline([['ZADD','lifeflow:ai:inflight',Date.now()+60000,`held-${i}`]]);
  const r=await post(question);expect(r.status).toBe(429);expect((await r.json()).error).toBe('demo_busy');
 });
 it('releases the visitor lock and global slot after each request',async()=>{
  const h={'x-vercel-forwarded-for':'203.0.113.60'};await post(question,h);
  expect((await store.pipeline([['ZCARD','lifeflow:ai:inflight']]))[0]).toBe(0);expect((await post(question,h)).status).toBe(200);
 });
 it('rejects cross-site requests',async()=>{
  expect((await post(question,{origin:'https://evil.example'})).status).toBe(403);
  expect((await post(question,{'sec-fetch-site':'cross-site'})).status).toBe(403);
  expect((await post(question,{origin:'http://localhost'})).status).toBe(200);
 });
 it('stores visitor addresses only as keyed digests',async()=>{
  await post(question,{'x-vercel-forwarded-for':'203.0.113.99'});
  const keys=JSON.stringify([...(store as unknown as {kv:Map<string,unknown>}).kv.keys()]);expect(keys).not.toContain('203.0.113.99');
 });
});
