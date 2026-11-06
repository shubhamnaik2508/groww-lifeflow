'use client';
import {MODEL_OPTIONS,modelFor,type ModelSize} from '../lib/browser-companion';
import type {BrowserModel} from './useBrowserModel';

/** Explains, loads and manages the in-browser model. Shared by the Companion and Reliability pages. */
export default function ModelPanel({model,compact=false}:{model:BrowserModel;compact?:boolean}){
 const {device,status,size}=model;const option=MODEL_OPTIONS[size];const chosen=modelFor(size,device?.precision||'f16');
 const busy=status==='loading'||status==='ready';const pct=Math.round(model.progress*100);
 return <section className="browser-ai-load" aria-labelledby="browser-ai-title">
  <div className="model-head"><div><div className="eyebrow">BROWSER AI · NO ACCOUNT, NO API KEY</div><h4 id="browser-ai-title">{status==='ready'?`${model.info?.name} is ready on this device`:'Run a real language model in your browser'}</h4></div><span className={`model-state state-${status}`}>{{checking:'Checking device…',unsupported:'Not supported here',idle:'Not loaded',loading:'Loading…',ready:'Ready',error:'Load failed'}[status]}</span></div>
  {!compact&&<p>Pressing <b>Load browser AI</b> downloads open-weight model files (about {option.downloadMB} MB) from Hugging Face, plus a small runtime file from GitHub. It runs the model on this device’s graphics processor with WebLLM. Your questions and figures stay in this browser; they are not sent to a server. Files are cached, so later visits load faster. Nothing is downloaded until you choose to load.</p>}
  <fieldset className="model-choice" disabled={busy}><legend>Model</legend>{(Object.keys(MODEL_OPTIONS) as ModelSize[]).map(k=>{const o=MODEL_OPTIONS[k];return <label key={k} className={size===k?'selected':''}><input type="radio" name="model-size" value={k} checked={size===k} onChange={()=>model.setSize(k)}/><span><b>{o.name}{k==='standard'?' · Recommended':' · Lite'}</b><small>About {o.downloadMB} MB download · about {(o.gpuMB[device?.precision||'f16']/1024).toFixed(1)} GB graphics memory · {o.licence}</small><small>{o.note}</small></span></label>})}</fieldset>
  {device&&!device.supported&&<p className="model-error" role="alert">{device.reason}</p>}
  {device?.supported&&device.warnings.length>0&&status!=='ready'&&<ul className="model-warnings">{device.warnings.map(w=><li key={w}>{w}</li>)}</ul>}
  {device?.supported&&!compact&&<p className="muted model-device">WebGPU detected{device.gpu?` (${device.gpu})`:''} · build: {chosen.id} · these checks cannot guarantee the model fits in memory.</p>}
  <div className="model-actions">
   {status!=='ready'&&<button className="primary" type="button" onClick={()=>void model.load()} disabled={!device?.supported||status==='loading'||status==='checking'}>{status==='loading'?'Loading browser AI…':status==='error'?'Try loading again':'Load browser AI'} <span>↓</span></button>}
   {status==='loading'&&<button className="outline" type="button" onClick={model.cancel}>Cancel</button>}
   {status==='ready'&&<button className="outline" type="button" onClick={()=>void model.unload()}>Unload model</button>}
   {status!=='loading'&&device?.supported&&<button className="text-button" type="button" onClick={()=>{if(window.confirm(`Remove the cached ${option.name} files from this browser? You would need to download them again.`))void model.removeFiles()}}>Remove downloaded model files</button>}
  </div>
  {status==='loading'&&<div className="model-progress"><progress aria-label="Browser AI download and setup progress" max={100} value={pct}/><p role="status" aria-live="polite">{pct}% · {model.progressText.slice(0,160)}</p><small className="muted">First load can take several minutes. You can keep using the rest of LifeFlow.</small></div>}
  {status==='ready'&&<p role="status" className="model-ready">Model loaded on this device. Each answer passes LifeFlow’s quality checks before it is shown; otherwise the rule-based guide is shown and labelled.</p>}
  {status==='error'&&<p className="model-error" role="alert">{model.error}</p>}
  {model.notice&&<p role="status" className="muted">{model.notice}</p>}
 </section>;
}
