import {readFileSync} from 'node:fs';
import {describe,expect,it,vi} from 'vitest';
import {checkDevice,describeLoadError,engineGenerate,MODEL_OPTIONS,modelFor,WEBLLM_VERSION} from './browser-companion';

const adapter=(f16:boolean,maxBuffer=2**31)=>({features:{has:(n:string)=>f16&&n==='shader-f16'},limits:{maxBufferSize:maxBuffer,maxStorageBufferBindingSize:maxBuffer},info:{vendor:'test',architecture:'gpu'}});
const nav=(over:Record<string,unknown>={})=>({userAgent:'Mozilla/5.0 (Windows NT 10.0)',gpu:{requestAdapter:async()=>adapter(true)},deviceMemory:16,storage:{estimate:async()=>({quota:10e9,usage:0})},...over});

describe('model registry',()=>{
 it('pins the WebLLM version actually installed',()=>{expect(JSON.parse(readFileSync('node_modules/@mlc-ai/web-llm/package.json','utf8')).version).toBe(WEBLLM_VERSION)});
 it('uses model ids present in the installed WebLLM prebuilt list',()=>{const lib=readFileSync('node_modules/@mlc-ai/web-llm/lib/index.js','utf8');for(const o of Object.values(MODEL_OPTIONS))for(const id of Object.values(o.ids))expect(lib).toContain(`model_id: "${id}"`)});
 it('selects the f32 build when shader-f16 is missing',()=>{expect(modelFor('standard','f32').id).toBe('Qwen2.5-1.5B-Instruct-q4f32_1-MLC');expect(modelFor('lite','f16').id).toBe('Qwen2.5-0.5B-Instruct-q4f16_1-MLC')});
});

describe('device detection',()=>{
 it('requires a secure context',async()=>{expect((await checkDevice('standard',nav() as never,false)).supported).toBe(false)});
 it('reports missing WebGPU',async()=>{const r=await checkDevice('standard',nav({gpu:undefined}) as never,true);expect(r.supported).toBe(false);expect(r.reason).toMatch(/WebGPU/)});
 it('reports a missing adapter',async()=>{const r=await checkDevice('standard',nav({gpu:{requestAdapter:async()=>null}}) as never,true);expect(r.supported).toBe(false);expect(r.reason).toMatch(/adapter/)});
 it('detects f16 support and falls back to f32',async()=>{expect((await checkDevice('standard',nav() as never,true)).precision).toBe('f16');expect((await checkDevice('standard',nav({gpu:{requestAdapter:async()=>adapter(false)}}) as never,true)).precision).toBe('f32')});
 it('warns about low memory, small buffers, low storage and phones without blocking',async()=>{
  const r=await checkDevice('standard',nav({deviceMemory:2,userAgent:'Mozilla/5.0 (Linux; Android 14) Mobile',storage:{estimate:async()=>({quota:500e6,usage:0})},gpu:{requestAdapter:async()=>adapter(true,128*1048576)}}) as never,true);
  expect(r.supported).toBe(true);expect(r.mobile).toBe(true);expect(r.warnings.join(' ')).toMatch(/2 GB/);expect(r.warnings.join(' ')).toMatch(/buffer/);expect(r.warnings.join(' ')).toMatch(/storage/);expect(r.warnings.join(' ')).toMatch(/mobile data/);
 });
});

async function* stream(parts:string[],finish:string,delay=0){for(const [i,p] of parts.entries()){if(delay)await new Promise(r=>setTimeout(r,delay));yield {choices:[{delta:{content:p},finish_reason:i===parts.length-1?finish:null}]}}}
describe('WebLLM adapter',()=>{
 it('streams schema-constrained JSON, reports progress and returns the text',async()=>{const engine={chatCompletion:vi.fn().mockResolvedValue(stream(['{"a"',':1}'],'stop')),interruptGenerate:vi.fn()};const progress=vi.fn();const out=await engineGenerate(engine as never)({messages:[{role:'user',content:'hi'}],schema:{type:'object'},signal:new AbortController().signal,onProgress:progress});expect(out).toBe('{"a":1}');expect(progress).toHaveBeenLastCalledWith(2);expect(engine.chatCompletion.mock.calls[0][0].response_format).toEqual({type:'json_object',schema:'{"type":"object"}'});expect(engine.chatCompletion.mock.calls[0][0].stream).toBe(true)});
 it('rejects truncated output',async()=>{const engine={chatCompletion:vi.fn().mockResolvedValue(stream(['{"a":'],'length')),interruptGenerate:vi.fn()};await expect(engineGenerate(engine as never)({messages:[],schema:{},signal:new AbortController().signal})).rejects.toThrow(/output limit/)});
 it('interrupts generation on abort',async()=>{const c=new AbortController();const engine={chatCompletion:vi.fn(async()=>stream(['{','}'],'stop',20)),interruptGenerate:vi.fn()};const p=engineGenerate(engine as never)({messages:[],schema:{},signal:c.signal});c.abort();await expect(p).rejects.toThrow(/interrupted/);expect(engine.interruptGenerate).toHaveBeenCalled()});
 it('explains load failures in plain language',()=>{
  const named=(name:string,msg='x')=>Object.assign(new Error(msg),{name});
  expect(describeLoadError(named('AbortError'))).toMatch(/cancelled/);expect(describeLoadError(named('WebGPUNotAvailableError'))).toMatch(/WebGPU/);expect(describeLoadError(new Error('Failed to fetch'))).toMatch(/downloaded/);expect(describeLoadError(named('QuotaExceededError'))).toMatch(/storage/);expect(describeLoadError(new Error('Device was lost'))).toMatch(/memory/);expect(describeLoadError('weird')).toMatch(/rule-based guide/);
 });
});
