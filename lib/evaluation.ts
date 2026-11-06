import {z} from 'zod';
import type {CompanionAnswer} from './ai/pipeline';

/** Shared evaluation data model used by the Reliability panel and scripts/golden-set-eval.mjs. */
const short=(n:number)=>z.string().trim().min(1).max(n);
export const profileSchema=z.object({salary:z.number().finite().nonnegative().max(1e8),expenses:z.number().finite().nonnegative().max(1e8),sip:z.number().finite().nonnegative().max(1e8),sipDate:z.string().max(10).default('')}).strict();
export const caseSchema=z.object({
 id:short(80),question:short(600),expected:short(1500),expected_behaviour:z.enum(['answer','abstain','clarify']).optional(),rationale:short(1500),
 provenance:z.object({labeller:short(120),labelled_at:short(40),source:short(300),notes:z.string().max(500).optional()}).strict().optional(),
 profile:profileSchema.optional(),scenario:z.object({type:z.enum(['expense','salary','rent','job','failure']),inputs:z.record(z.string().max(32),z.string().max(150))}).strict().optional(),
 label_scope:z.enum(['answer','theme_only']).optional(),
}).strict();
export const datasetSchema=z.object({kind:z.enum(['human-labelled','engineering-fixture','simulation']),name:short(160),description:z.string().max(1500).optional(),created:short(40),labelled_by:z.string().max(200).optional(),consent_and_provenance:z.string().max(1000).optional()}).strict();
export const fileSchema=z.object({dataset:datasetSchema,cases:z.array(caseSchema).min(1).max(50),runs:z.record(z.string(),z.unknown()).optional(),reviews:z.record(z.string(),z.unknown()).optional(),exportedAt:z.string().optional()}).strict();
export type EvalCase=z.infer<typeof caseSchema>;export type Dataset=z.infer<typeof datasetSchema>;

/** Converts an Evidence Log export (scripts/export-evidence-log.mjs) into cases. Synthetic records never become human-labelled evidence. */
export const evidenceLogSchema=z.object({format:z.literal('lifeflow-evidence-log-v1'),exported_at:z.string(),source_database:z.string(),records:z.array(z.object({evidence_id:z.string(),original_text:z.string(),is_synthetic:z.boolean(),entry_method:z.string(),platform:z.string(),golden_label:z.object({theme:z.string().nullable(),special_label:z.string().nullable(),journey_stage:z.string().nullable(),observed_behaviour:z.string().nullable(),labeller:z.string(),labelled_at:z.string(),rationale:z.string().nullable()}).nullable()})).min(1).max(500)});
export function casesFromEvidenceLog(raw:unknown):{dataset:Dataset;cases:EvalCase[]}{
 const log=evidenceLogSchema.parse(raw);
 const labelled=log.records.filter(r=>r.golden_label).slice(0,50);
 const allSynthetic=labelled.every(r=>r.is_synthetic);const anySynthetic=labelled.some(r=>r.is_synthetic);
 return {
  dataset:{kind:anySynthetic?'simulation':'human-labelled',name:`Evidence Log import (${labelled.length} labelled records)`,created:log.exported_at.slice(0,10),labelled_by:[...new Set(labelled.map(r=>r.golden_label!.labeller))].join('; ').slice(0,200),description:`Imported from ${log.source_database}. Labels are evidence-theme labels for a discovery task, not expected companion answers; review them for context relevance only.${allSynthetic?' Every record is marked synthetic in the source database.':anySynthetic?' Some records are marked synthetic, so the whole import is treated as a simulation.':''}`},
  cases:labelled.map(r=>({id:`evidence-${r.evidence_id}`.slice(0,80),question:r.original_text.slice(0,600),expected:`Theme: ${r.golden_label!.theme??'none'}${r.golden_label!.special_label?` (${r.golden_label!.special_label})`:''}. Observed behaviour: ${r.golden_label!.observed_behaviour??'not recorded'}.`.slice(0,1500),rationale:(r.golden_label!.rationale||'No rationale recorded.').slice(0,1500),label_scope:'theme_only' as const,provenance:{labeller:r.golden_label!.labeller.slice(0,120),labelled_at:r.golden_label!.labelled_at.slice(0,40),source:`${log.source_database} · ${r.platform} · ${r.entry_method}${r.is_synthetic?' · synthetic':''}`.slice(0,300)}})),
 };
}

/** What the system actually did, in terms a human label can be compared with. */
export function observedBehaviour(a:Pick<CompanionAnswer,'kind'|'requires_abstention'>):'answer'|'abstain'|'clarify'|'fallback'{
 if(a.kind==='clarification')return 'clarify';
 if(a.kind==='safety-rule'||(a.kind==='model'&&a.requires_abstention))return 'abstain';
 if(a.kind==='model')return 'answer';
 return 'fallback';
}
/** Automatic failure category from the pipeline; reviewers can override it. */
export function failureCategory(a:Pick<CompanionAnswer,'kind'|'fallback_reason'>):string{
 if(a.kind==='model')return 'none';
 const r=a.fallback_reason||'';
 if(r.startsWith('gate_'))return {gate_schema:'malformed_output',gate_numbers:'arithmetic_inconsistency',gate_source_support:'unsupported_claim',gate_investment_safety:'unsafe_content',gate_uncertainty:'false_certainty'}[r]||r;
 if(r.startsWith('provider_')||r==='model_timeout'||r==='model_error'||r==='missing_key'||r==='disabled'||r==='rate_limited'||r==='network_error')return 'provider_unavailable';
 return 'pre_model_rule';
}
