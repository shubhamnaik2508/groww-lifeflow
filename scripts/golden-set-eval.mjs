// Runs an evaluation file through the SAME server pipeline the app uses (POST /api/lifeflow/companion)
// and stores every result. Usage:
//   node scripts/golden-set-eval.mjs <dataset.json> [--url http://localhost:3000] [--out evaluation/runs]
// The dataset can be a LifeFlow evaluation file (fixtures/README.md) or an Evidence Log export.
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {basename,join} from 'node:path';

const args=process.argv.slice(2);const file=args.find(a=>!a.startsWith('--'));
const opt=(k,d)=>{const i=args.indexOf(k);return i>=0?args[i+1]:d};
if(!file){console.error('Usage: node scripts/golden-set-eval.mjs <dataset.json> [--url URL] [--out DIR]');process.exit(2)}
const base=opt('--url',process.env.LIFEFLOW_TEST_URL||'http://localhost:3000');const outDir=opt('--out','evaluation/runs');
const raw=JSON.parse(readFileSync(file,'utf8'));
let dataset,cases;
if(raw.format==='lifeflow-evidence-log-v1'){
 const labelled=raw.records.filter(r=>r.golden_label).slice(0,50);
 dataset={kind:labelled.some(r=>r.is_synthetic)?'simulation':'human-labelled',name:`Evidence Log import (${labelled.length})`,created:raw.exported_at.slice(0,10),description:'Evidence-theme labels, not expected companion answers.'};
 cases=labelled.map(r=>({id:`evidence-${r.evidence_id}`,question:r.original_text.slice(0,600),expected:`Theme: ${r.golden_label.theme??'none'}`,rationale:r.golden_label.rationale||'',label_scope:'theme_only'}));
}else{dataset=raw.dataset;cases=raw.cases}
const DEFAULT_PROFILE={salary:30000,expenses:18000,sip:3000,sipDate:''};
const status=await fetch(`${base}/api/lifeflow/companion`).then(r=>r.json());
console.log(`Server ${base}: provider ${status.provider}, model ${status.model}, AI available: ${status.ai_available}, prompt ${status.prompt_version}`);
if(dataset.kind!=='human-labelled')console.log(`NOTE: dataset kind is "${dataset.kind}". Results are not evaluation evidence.`);
const observed=a=>a.kind==='clarification'?'clarify':a.kind==='safety-rule'||(a.kind==='model'&&a.requires_abstention)?'abstain':a.kind==='model'?'answer':'fallback';
const results=[];
for(const [i,c] of cases.entries()){
 const profile=c.profile||DEFAULT_PROFILE;
 const res=await fetch(`${base}/api/lifeflow/companion`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question:c.question,profile,scenario:c.scenario?{...c.scenario,profile}:null})});
 const body=await res.json();const answer=body.kind?body:null;
 const behaviour=answer?observed(answer):'request_error';
 results.push({case_id:c.id,question:c.question,scenario_context:{profile,scenario:c.scenario??null},human_expected:c.expected,expected_behaviour:c.expected_behaviour??null,rationale:c.rationale,provenance:c.provenance??null,
  actual_output:answer,http_status:res.status,request_error:answer?null:body,model_identifier:answer?.model?.id??null,prompt_version:answer?.model?.prompt_version??status.prompt_version,
  evaluation:{observed_behaviour:behaviour,behaviour_match:c.expected_behaviour?behaviour===c.expected_behaviour:null,gate_passed:answer?.kind==='model',checks:answer?.checks??[],
   human_review:{factual:null,grounding:null,context:null,safety:null,abstention:null,overall:null}},
  failure_category:answer?(answer.kind==='model'?'none':answer.fallback_reason||'pre_model_rule'):'request_error',timestamp:new Date().toISOString(),reviewer_correction:null});
 const r=results.at(-1);console.log(`${String(i+1).padStart(2)}/${cases.length} ${c.id}: ${behaviour}${r.evaluation.behaviour_match===null?'':r.evaluation.behaviour_match?' (matches label)':' (does NOT match label)'} · ${r.failure_category} · ${answer?.latency_ms??'-'} ms`);
 if(i<cases.length-1)await new Promise(r=>setTimeout(r,8000));
}
mkdirSync(outDir,{recursive:true});
const stamp=new Date().toISOString().replace(/[:.]/g,'-');const out=join(outDir,`${stamp}-${basename(file,'.json')}.json`);
const summary={cases:results.length,ai_answers_passed_gate:results.filter(r=>r.evaluation.gate_passed).length,ai_answers_blocked:results.filter(r=>r.actual_output?.model&&!r.evaluation.gate_passed).length,stopped_before_ai:results.filter(r=>['safety-rule','clarification'].includes(r.actual_output?.kind)).length,unavailable_or_error:results.filter(r=>['missing_key','disabled','invalid_model','request_error'].includes(r.failure_category)||String(r.failure_category).startsWith('provider_')).length,behaviour_compared:results.filter(r=>r.evaluation.behaviour_match!==null).length,behaviour_matched:results.filter(r=>r.evaluation.behaviour_match).length,genuine_human_labelled:dataset.kind==='human-labelled'};
writeFileSync(out,JSON.stringify({run:{started_by:'scripts/golden-set-eval.mjs',server:base,provider:status.provider,model:status.model,prompt_version:status.prompt_version,ai_available:status.ai_available,finished_at:new Date().toISOString()},dataset,summary,results},null,2));
console.log('\nSummary',summary,`\nSaved ${out}. Human review fields are empty until a reviewer completes them.`);
