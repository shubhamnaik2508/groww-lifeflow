import type {MLCEngineInterface,InitProgressReport} from '@mlc-ai/web-llm';
import {GENERATION} from './ai/prompt';
import type {Generate,ModelInfo} from './ai/pipeline';

/** Must equal the installed @mlc-ai/web-llm version (checked by a unit test). */
export const WEBLLM_VERSION='0.2.87';
export type ModelSize='standard'|'lite';
export type Precision='f16'|'f32';
type Option={name:string;base:string;baseUrl:string;licence:string;ids:Record<Precision,string>;downloadMB:number;gpuMB:Record<Precision,number>;note:string};

/** Sizes are the Hugging Face repository totals and WebLLM's vram_required_MB, checked 2026-11-06. */
export const MODEL_OPTIONS:Record<ModelSize,Option>={
 standard:{name:'Qwen2.5 1.5B Instruct',base:'Qwen/Qwen2.5-1.5B-Instruct',baseUrl:'https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct',licence:'Apache-2.0',ids:{f16:'Qwen2.5-1.5B-Instruct-q4f16_1-MLC',f32:'Qwen2.5-1.5B-Instruct-q4f32_1-MLC'},downloadMB:880,gpuMB:{f16:1630,f32:1889},note:'Recommended. Better explanations; needs a laptop or desktop GPU.'},
 lite:{name:'Qwen2.5 0.5B Instruct',base:'Qwen/Qwen2.5-0.5B-Instruct',baseUrl:'https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct',licence:'Apache-2.0',ids:{f16:'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',f32:'Qwen2.5-0.5B-Instruct-q4f32_1-MLC'},downloadMB:290,gpuMB:{f16:945,f32:1060},note:'Smaller download. Answers are more often blocked by the quality checks.'},
};

export type DeviceReport={supported:boolean;reason?:string;precision:Precision;gpu?:string;maxBufferMB?:number;deviceMemoryGB?:number;storageFreeMB?:number;mobile:boolean;warnings:string[]};
type GPUAdapterLike={features:{has(name:string):boolean};limits:{maxBufferSize:number;maxStorageBufferBindingSize:number};info?:{vendor?:string;architecture?:string}};
type NavigatorLike={gpu?:{requestAdapter(o?:object):Promise<GPUAdapterLike|null>};deviceMemory?:number;userAgent:string;userAgentData?:{mobile?:boolean};storage?:{estimate?():Promise<{quota?:number;usage?:number}>}};

/** Feature detection only; it cannot prove a model will fit in memory. */
export async function checkDevice(size:ModelSize,nav:NavigatorLike=globalThis.navigator as unknown as NavigatorLike,secure=globalThis.isSecureContext):Promise<DeviceReport>{
 const mobile=Boolean(nav?.userAgentData?.mobile)||/Android|iPhone|iPad|Mobile/i.test(nav?.userAgent||'');
 const base={precision:'f32' as Precision,mobile,warnings:[] as string[]};
 if(!secure)return {...base,supported:false,reason:'Browser AI needs a secure (HTTPS) page.'};
 if(!nav?.gpu)return {...base,supported:false,reason:'This browser does not provide WebGPU, which the browser model needs. A recent Chrome or Edge on a laptop or desktop is most likely to work. You can use the rule-based guide instead.'};
 let adapter:GPUAdapterLike|null=null;
 try{adapter=await nav.gpu.requestAdapter({powerPreference:'high-performance'})}catch{adapter=null}
 if(!adapter)return {...base,supported:false,reason:'WebGPU is present but no compatible graphics adapter is available (it may be disabled or blocklisted). You can use the rule-based guide instead.'};
 const precision:Precision=adapter.features.has('shader-f16')?'f16':'f32';
 const option=MODEL_OPTIONS[size];const warnings:string[]=[];
 const maxBufferMB=Math.round(Math.min(adapter.limits.maxBufferSize,adapter.limits.maxStorageBufferBindingSize)/1048576);
 if(maxBufferMB<256)warnings.push(`This graphics adapter reports small buffer limits (${maxBufferMB} MB). Loading may fail.`);
 const deviceMemoryGB=typeof nav.deviceMemory==='number'?nav.deviceMemory:undefined;
 if(deviceMemoryGB!==undefined&&deviceMemoryGB<4)warnings.push(`This device reports about ${deviceMemoryGB} GB of memory. The ${option.name} model needs about ${(option.gpuMB[precision]/1024).toFixed(1)} GB of graphics memory and may fail to load${size==='standard'?'; the Lite model is smaller':''}.`);
 let storageFreeMB:number|undefined;
 try{const e=await nav.storage?.estimate?.();if(e?.quota!==undefined)storageFreeMB=Math.round((e.quota-(e.usage||0))/1048576)}catch{}
 if(storageFreeMB!==undefined&&storageFreeMB<option.downloadMB*1.1)warnings.push(`The browser reports about ${storageFreeMB} MB of free storage; about ${option.downloadMB} MB is needed to cache the model.`);
 if(mobile)warnings.push(`On a phone, the ${option.downloadMB} MB download may use mobile data, and many phones cannot run the model.${size==='standard'?' Consider the Lite model.':''}`);
 return {supported:true,precision,gpu:[adapter.info?.vendor,adapter.info?.architecture].filter(Boolean).join(' ')||undefined,maxBufferMB,deviceMemoryGB,storageFreeMB,mobile,warnings};
}

export function modelFor(size:ModelSize,precision:Precision){const o=MODEL_OPTIONS[size];return {id:o.ids[precision],name:o.name,downloadMB:o.downloadMB,gpuMB:o.gpuMB[precision]}}

export async function isModelCached(modelId:string):Promise<boolean>{try{const {hasModelInCache}=await import('@mlc-ai/web-llm');return await hasModelInCache(modelId)}catch{return false}}
export async function deleteModelFiles(modelId:string):Promise<void>{const {deleteModelAllInfoInCache}=await import('@mlc-ai/web-llm');await deleteModelAllInfoInCache(modelId)}

export type LoadedEngine={engine:MLCEngineInterface;info:ModelInfo;dispose:()=>Promise<void>};

/** Starts a dedicated worker and downloads/compiles the model. Nothing is fetched before this is called. */
export async function loadEngine(modelId:string,name:string,onProgress:(r:{progress:number;text:string})=>void,signal?:AbortSignal):Promise<LoadedEngine>{
 const {CreateWebWorkerMLCEngine}=await import('@mlc-ai/web-llm');
 const worker=new Worker(new URL('./llm-worker.ts',import.meta.url),{type:'module'});
 // Terminating the worker does not settle WebLLM's pending promise, so cancellation races it explicitly.
 let rejectAbort:(e:unknown)=>void=()=>{};const aborted=new Promise<never>((_,reject)=>{rejectAbort=reject});aborted.catch(()=>{});
 const abort=()=>{worker.terminate();rejectAbort(new DOMException('Loading cancelled','AbortError'))};
 if(signal?.aborted)abort();signal?.addEventListener('abort',abort,{once:true});
 try{
  const engine=await Promise.race([CreateWebWorkerMLCEngine(worker,modelId,{initProgressCallback:(r:InitProgressReport)=>onProgress({progress:Math.max(0,Math.min(1,r.progress)),text:r.text})}),aborted]);
  if(signal?.aborted)throw new DOMException('Loading cancelled','AbortError');
  return {engine,info:{id:modelId,name:`${name} (on this device, experimental)`,library:`@mlc-ai/web-llm ${WEBLLM_VERSION}`,provider:'webllm'},dispose:async()=>{try{await engine.unload()}catch{}worker.terminate()}};
 }catch(error){worker.terminate();throw signal?.aborted?new DOMException('Loading cancelled','AbortError'):error}
 finally{signal?.removeEventListener('abort',abort)}
}

export function engineGenerate(engine:Pick<MLCEngineInterface,'chatCompletion'|'interruptGenerate'>):Generate{
 return async({messages,schema,signal,onProgress})=>{
  const stop=()=>{try{void engine.interruptGenerate()}catch{}};signal.addEventListener('abort',stop,{once:true});
  try{
   // Streamed so the UI can show progress; the text itself is never displayed until the gate passes.
   const chunks=await engine.chatCompletion({messages,response_format:{type:'json_object',schema:JSON.stringify(schema)},stream:true,...GENERATION});
   let content='',finish:string|null|undefined,count=0;
   for await(const chunk of chunks){if(signal.aborted)break;const c=chunk.choices?.[0];content+=c?.delta?.content||'';if(c?.finish_reason)finish=c.finish_reason;count++;onProgress?.(count)}
   if(signal.aborted)throw new Error('Generation was interrupted.');
   if(finish==='length')throw new Error('The model reached its output limit before finishing.');
   if(!content)throw new Error('The model returned no text.');
   return content;
  }finally{signal.removeEventListener('abort',stop)}
 };
}

/** Plain-language explanations for load failures. */
export function describeLoadError(error:unknown):string{
 const name=error instanceof Error?error.name:'';const message=(error instanceof Error?error.message:String(error)).toLowerCase();
 if(name==='AbortError')return 'Loading was cancelled. Nothing else was downloaded.';
 if(name==='ShaderF16SupportError')return 'This graphics adapter lacks a feature the selected model needs. Reload the page to try the compatible (f32) build.';
 if(name==='WebGPUNotAvailableError'||name==='WebGPUNotFoundError')return 'WebGPU is not available in this browser. Use a recent Chrome or Edge on a laptop or desktop, or use the rule-based guide.';
 if(name==='DeviceLostError'||message.includes('device was lost')||message.includes('device lost'))return 'The graphics device stopped responding, often because it ran out of memory. Close other tabs, try the Lite model, or use the rule-based guide.';
 if(name==='QuotaExceededError'||message.includes('quota'))return 'The browser does not have enough storage to cache the model. Free some space or use the rule-based guide.';
 if(message.includes('out of memory')||message.includes('oom')||message.includes('allocation'))return 'This device does not have enough graphics memory for the model. Try the Lite model or use the rule-based guide.';
 if(message.includes('fetch')||message.includes('network')||message.includes('load failed'))return 'The model files could not be downloaded. Check your connection (Hugging Face and GitHub must be reachable) and try again.';
 return 'The browser model could not be loaded on this device. You can try again, try the Lite model, or use the rule-based guide.';
}
