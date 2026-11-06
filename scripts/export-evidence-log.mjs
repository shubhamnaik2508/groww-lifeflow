// Exports labelled records from the SIP Discovery Engine's Evidence Log (SQLite) for import into
// LifeFlow's AI Reliability panel. Opens the database READ-ONLY; it never modifies the Discovery Engine.
// Usage: node scripts/export-evidence-log.mjs "<path to groww_sip_lab.db>" [output.json]
import {DatabaseSync} from 'node:sqlite';
import {writeFileSync} from 'node:fs';
import {basename} from 'node:path';

const [dbPath,out='evaluation/evidence-log-export.json']=process.argv.slice(2);
if(!dbPath){console.error('Usage: node scripts/export-evidence-log.mjs <groww_sip_lab.db> [output.json]');process.exit(2)}
const db=new DatabaseSync(dbPath,{readOnly:true});
const rows=db.prepare(`select e.id evidence_id,e.original_text,e.is_synthetic,e.entry_method,e.platform,
 g.special_label,g.journey_stage,g.observed_behaviour,g.labeller,g.labelled_at,g.rationale,t.name theme
 from evidence_records e left join golden_labels g on g.evidence_id=e.id left join themes t on t.id=g.theme_id order by e.created_at`).all();
db.close();
const records=rows.map(r=>({evidence_id:String(r.evidence_id),original_text:String(r.original_text),is_synthetic:Boolean(r.is_synthetic),entry_method:String(r.entry_method),platform:String(r.platform),
 golden_label:r.labeller?{theme:r.theme??null,special_label:r.special_label??null,journey_stage:r.journey_stage??null,observed_behaviour:r.observed_behaviour??null,labeller:String(r.labeller),labelled_at:String(r.labelled_at),rationale:r.rationale??null}:null}));
writeFileSync(out,JSON.stringify({format:'lifeflow-evidence-log-v1',exported_at:new Date().toISOString(),source_database:basename(dbPath),records},null,2));
const synthetic=records.filter(r=>r.is_synthetic).length,labelled=records.filter(r=>r.golden_label).length;
console.log(`Exported ${records.length} records (${labelled} labelled, ${synthetic} marked synthetic) to ${out}.`);
if(synthetic)console.log('Synthetic records are imported as a simulation, never as human-labelled evaluation evidence.');
