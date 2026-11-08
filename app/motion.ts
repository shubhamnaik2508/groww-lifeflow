// Orchestration for the transitions.dev snippets in transitions.css (texts reveal, panel reveal, dropdown).

/** A duration custom property in milliseconds. The production CSS minifier rewrites 150ms as .15s, so both units are read. */
export function toMs(value:string,fallback:number){
 const v=value.trim(),n=parseFloat(v);
 if(!Number.isFinite(n))return fallback;
 return /ms$/i.test(v)?n:/s$/i.test(v)?n*1000:n;
}
export function cssMs(name:string,fallback:number){
 return toMs(getComputedStyle(document.documentElement).getPropertyValue(name),fallback);
}

/** Texts reveal: replay the staggered entrance on every .t-stagger block (remove, force reflow, re-add). */
export function replayStagger(root:ParentNode=document){
 root.querySelectorAll<HTMLElement>('.t-stagger').forEach(block=>{
  block.classList.remove('is-hiding','is-shown');
  void block.offsetHeight;
  block.classList.add('is-shown');
 });
}

/** Panel reveal: open a panel rendered with data-open="false". The reflow paints the closed state first so it transitions. */
export function openPanel(el:HTMLElement|null){
 if(!el||el.dataset.open==='true')return;
 void el.offsetHeight;
 el.dataset.open='true';
}
