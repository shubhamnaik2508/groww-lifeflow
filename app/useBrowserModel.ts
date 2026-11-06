'use client';
import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {checkDevice,deleteModelFiles,describeLoadError,engineGenerate,loadEngine,modelFor,type DeviceReport,type LoadedEngine,type ModelSize} from '../lib/browser-companion';
import type {Generate,ModelInfo} from '../lib/ai/pipeline';

export type ModelStatus='checking'|'unsupported'|'idle'|'loading'|'ready'|'error';
export type BrowserModel={
 size:ModelSize;setSize:(s:ModelSize)=>void;device:DeviceReport|null;status:ModelStatus;progress:number;progressText:string;error:string;notice:string;
 info:ModelInfo|null;generate:Generate|null;interrupt:()=>void;load:()=>Promise<void>;cancel:()=>void;unload:()=>Promise<void>;removeFiles:()=>Promise<void>;
};

/** Holds one in-browser model for the whole page. Nothing is downloaded until load() is called. */
export function useBrowserModel():BrowserModel{
 const [size,setSizeState]=useState<ModelSize>('standard'),[device,setDevice]=useState<DeviceReport|null>(null),[status,setStatus]=useState<ModelStatus>('checking');
 const [progress,setProgress]=useState(0),[progressText,setProgressText]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [loaded,setLoaded]=useState<LoadedEngine|null>(null);const loadedRef=useRef<LoadedEngine|null>(null);const abortRef=useRef<AbortController|null>(null);
 useEffect(()=>{let live=true;setStatus(s=>s==='ready'||s==='loading'?s:'checking');void checkDevice(size).then(r=>{if(!live)return;setDevice(r);setStatus(s=>s==='ready'||s==='loading'?s:r.supported?'idle':'unsupported')});return()=>{live=false}},[size]);
 useEffect(()=>()=>{abortRef.current?.abort();void loadedRef.current?.dispose()},[]);
 const setSize=useCallback((s:ModelSize)=>{if(status==='loading'||status==='ready')return;setError('');setSizeState(s)},[status]);
 const load=useCallback(async()=>{
  if(!device?.supported||status==='loading'||status==='ready')return;
  const model=modelFor(size,device.precision);const controller=new AbortController();abortRef.current=controller;
  setStatus('loading');setProgress(0);setProgressText('Starting…');setError('');setNotice('');
  try{const engine=await loadEngine(model.id,model.name,r=>{setProgress(r.progress);setProgressText(r.text)},controller.signal);loadedRef.current=engine;setLoaded(engine);setStatus('ready')}
  catch(e){setStatus('error');setError(describeLoadError(e))}
  finally{if(abortRef.current===controller)abortRef.current=null}
 },[device,size,status]);
 const cancel=useCallback(()=>{abortRef.current?.abort()},[]);
 const unload=useCallback(async()=>{const current=loadedRef.current;loadedRef.current=null;setLoaded(null);await current?.dispose();setStatus(device?.supported?'idle':'unsupported');setNotice('The model was unloaded from memory. Downloaded files remain cached until you remove them.')},[device]);
 const removeFiles=useCallback(async()=>{
  if(status==='loading')return;const precision=device?.precision||'f32';
  if(loadedRef.current){await loadedRef.current.dispose();loadedRef.current=null;setLoaded(null)}
  try{await deleteModelFiles(modelFor(size,precision).id);setNotice(`Cached files for ${modelFor(size,precision).name} were removed from this browser.`)}catch{setNotice('The cached model files could not be removed. You can clear this site’s data in your browser settings.')}
  setStatus(device?.supported?'idle':'unsupported');
 },[device,size,status]);
 const generate=useMemo(()=>loaded?engineGenerate(loaded.engine):null,[loaded]);
 const interrupt=useCallback(()=>{try{void loadedRef.current?.engine.interruptGenerate()}catch{}},[]);
 return {size,setSize,device,status,progress,progressText,error,notice,info:loaded?.info||null,generate,interrupt,load,cancel,unload,removeFiles};
}
