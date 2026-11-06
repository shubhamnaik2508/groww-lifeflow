import {z} from 'zod';
import type {Evidence} from './evidence';

/**
 * Market Pulse evaluation gate. Separate from the AI Companion's gate (lib/ai/gate.ts), which is unchanged.
 * Fails closed: any failed check means the model's text is not shown and the deterministic brief is used.
 */

const claim=z.object({text:z.string().trim().min(8).max(420),supports:z.array(z.string().max(40)).max(6)}).strict();
export const analysisSchema=z.object({
 verdict_headline:z.string().trim().min(10).max(140),
 verdict_summary:claim,
 market_facts:z.array(claim).min(1).max(8),
 context:z.array(claim).max(6),
 history_context:z.array(claim).max(5),
 sip_education:z.array(claim).min(1).max(5),
 uncertainty:z.array(z.string().trim().min(10).max(300)).min(1).max(5),
}).strict();
export type Analysis=z.infer<typeof analysisSchema>;

/** JSON Schema for Groq strict structured output (mirrors analysisSchema). */
const claimJson={type:'object',additionalProperties:false,required:['text','supports'],properties:{text:{type:'string'},supports:{type:'array',items:{type:'string'}}}};
export const analysisJsonSchema={type:'object',additionalProperties:false,
 required:['verdict_headline','verdict_summary','market_facts','context','history_context','sip_education','uncertainty'],
 properties:{verdict_headline:{type:'string'},verdict_summary:claimJson,market_facts:{type:'array',items:claimJson},context:{type:'array',items:claimJson},
  history_context:{type:'array',items:claimJson},sip_education:{type:'array',items:claimJson},uncertainty:{type:'array',items:{type:'string'}}}};

export type GateCheck={id:string;label:string;passed:boolean;detail?:string};
export type GateResult={passed:boolean;checks:GateCheck[]};

// ---------- Patterns ----------
const ADVICE=/\b(you should|you must|we (?:recommend|suggest|advise)|i (?:recommend|suggest)|recommended|consider (?:buying|selling|investing|redeeming|stopping|pausing|continuing|increasing)|(?:buy|sell|redeem|exit|switch)\s+(?:now|your|these|this)\b|(?:^|[.!?]\s+)(?:buy|sell|redeem|invest|stop|pause|continue|reduce|switch)\b|(?:stop|pause|continue|increase|reduce|start|keep)\s+(?:your|investing|the)\s+sips?|keep investing|stay invested|don'?t (?:stop|panic|sell)|(?:good|right|great|ideal|best) time to (?:buy|invest|enter|sell)|buying opportunity|opportunity to (?:buy|invest|accumulate)|accumulate|safest|safe bet|should (?:continue|pause|stop|reduce|invest|buy|sell))\b/i;
const PREDICTION=/\b(will|is (?:set|poised|expected|likely) to|are (?:set|poised|expected|likely) to|likely to|expected to|bound to|going to|forecast|outlook (?:is|remains)|poised to|should (?:rise|fall|recover|rebound|bounce|gain|drop))\b[\s\S]{0,40}\b(rise|fall|recover|rebound|bounce|rally|gain|climb|drop|decline|crash|correct|surge|slump|reach|hit|cross|touch|return)\b|\b(recovery is (?:coming|likely|expected)|markets? will)\b/i;
const GUARANTEE=/\b(guarantee[sd]?|assured|risk[- ]free|certain(?:ly)? (?:to|that)|definitely|no doubt|sure to|always (?:recover|rise|go up)|never (?:fall|lose))\b/i;
const CAUSAL=/\b(due to|because|driven by|led by|dragged by|weighed (?:down )?by|on the back of|triggered by|caused by|fuelled by|fueled by|amid|after|following|as investors|on (?:concerns|worries|fears|hopes)|in response to|pressured by|boosted by|supported by)\b/i;
const UP=/\b(rose|rise[sn]?|rising|gain(?:ed|s)?|advanc(?:ed|es)|higher|climb(?:ed|s)?|up\b|jump(?:ed|s)?|surg(?:ed|es)|rall(?:ied|ies)|added|positive)\b/i;
const DOWN=/\b(fell|fall(?:s|en)?|falling|declin(?:ed|es|e)|lower|drop(?:ped|s)?|down\b|slipp?(?:ed|s)?|lost|los(?:es|ing)|shed|slid|slump(?:ed|s)?|tumbl(?:ed|es)|negative|weaker)\b/i;
const RELATIVE_DAY=/\b(today|yesterday|tomorrow|this (?:morning|afternoon|evening)|tonight|right now|currently trading|live)\b/i;
const NIFTY=/\bnifty\b/i,SENSEX=/\bsensex\b/i;
const STOP=new Set('the a an of and or to in on for with at by from as is are was were be been this that these those it its their there than then into over under about across market markets index indices indian india stock stocks share shares session sessions trading day week month year percent points point'.split(' '));

const words=(t:string)=>t.toLowerCase().replace(/[^a-z0-9 ]+/g,' ').split(/\s+/).filter(w=>w.length>3&&!STOP.has(w));

/** Numbers a claim may contain: fact values, date parts, and numbers printed in the news it cites. */
function allowedNumbers(e:Evidence,cited:string[]):number[]{
 const out:number[]=[1,3,6,12];
 const addDate=(d:string)=>{const [y,m,dd]=d.slice(0,10).split('-').map(Number);if(y)out.push(y,dd,m)};
 for(const f of e.facts){if(typeof f.value==='number'){const v=Math.abs(f.value);out.push(v,Math.round(v),Math.round(v*10)/10)}else addDate(f.value)
  // Every number printed in a verified fact's display (e.g. "1 of 261 sessions") is itself verified.
  for(const m of f.display.matchAll(/\d[\d,]*(?:\.\d+)?/g))out.push(Number(m[0].replace(/,/g,'')))
  for(const m of f.display.matchAll(/\b(\d{4})-(\d{2})-(\d{2})\b|\b(\d{1,2}) [A-Z][a-z]+ (\d{4})\b/g)){if(m[1])addDate(m[0]);else out.push(Number(m[4]),Number(m[5]))}
  for(const m of f.label.matchAll(/\b(\d{1,2}) [A-Z][a-z]+ (\d{4})\b/g))out.push(Number(m[1]),Number(m[2]))}
 for(const n of e.news){if(!cited.includes(n.id))continue;addDate(n.publishedAt);for(const m of `${n.title} ${n.summary}`.matchAll(/\d[\d,]*(?:\.\d+)?/g))out.push(Number(m[0].replace(/,/g,'')))}
 return out;
}
const numbersIn=(t:string)=>[...t.replace(/\bnifty\s*50\b/gi,'NIFTY').replace(/\b(?:1|3|6)M\b|\b1Y\b/g,'').matchAll(/\d[\d,]*(?:\.\d+)?/g)].map(m=>Number(m[0].replace(/,/g,'')));

export function evaluate(raw:unknown,e:Evidence):GateResult{
 const checks:GateCheck[]=[];
 const parsed=analysisSchema.safeParse(raw);
 checks.push({id:'schema',label:'Response matches the required structure',passed:parsed.success,detail:parsed.success?undefined:parsed.error.issues.slice(0,3).map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')});
 if(!parsed.success)return {passed:false,checks};
 const a=parsed.data;
 const factIds=new Set(e.facts.map(f=>f.id)),newsIds=new Set(e.news.map(n=>n.id));
 const claims=[{k:'verdict',c:a.verdict_summary},...a.market_facts.map(c=>({k:'fact',c})),...a.context.map(c=>({k:'context',c})),...a.history_context.map(c=>({k:'history',c})),...a.sip_education.map(c=>({k:'sip',c}))];
 const all=[a.verdict_headline,...claims.map(x=>x.c.text),...a.uncertainty];
 const fail=(id:string,label:string,detail?:string)=>checks.push({id,label,passed:!detail,detail});

 // Sources: every reference exists; facts cite facts; context cites news.
 const unknown=claims.flatMap(x=>x.c.supports).filter(s=>!factIds.has(s)&&!newsIds.has(s));
 const badKind=claims.find(x=>(x.k==='fact'||x.k==='history'||x.k==='verdict')&&!x.c.supports.some(s=>factIds.has(s)))??claims.find(x=>x.k==='context'&&!x.c.supports.some(s=>newsIds.has(s)));
 fail('sources','Every claim cites provided facts or news, and no source is invented',unknown.length?`Unknown references: ${[...new Set(unknown)].join(', ')}`:badKind?`A ${badKind.k} claim lacks the required citation: “${badKind.c.text.slice(0,80)}”`:undefined);

 // Numbers: every figure must come from the evidence the claim cites (plus fact values and dates).
 const numberProblem=[{text:a.verdict_headline,supports:a.verdict_summary.supports},...claims.map(x=>x.c),...a.uncertainty.map(t=>({text:t,supports:[] as string[]}))].map(c=>{
  const ok=allowedNumbers(e,c.supports);const bad=numbersIn(c.text).find(n=>!ok.some(v=>Math.abs(v-n)<=0.011));return bad===undefined?null:`${bad} in “${c.text.slice(0,80)}”`}).find(Boolean);
 fail('numbers','Every number matches a verified figure or cited source',numberProblem??undefined);

 // Direction: wording must agree with the verified sign of each index.
 const dir=Object.fromEntries(e.indices.map(i=>[i.id,i.session.direction]));
 const directionProblem=all.find(t=>t.split(/(?<=[.;])\s+/).some(s=>{
  const up=UP.test(s),down=DOWN.test(s);if(!up&&!down)return false;
  // Sentences about history or a period describe other timeframes; directions there are checked by numbers only.
  if(/\b(year|month|months|period|since|over the|1Y|6M|3M|1M|history|historically|past)\b/i.test(s))return false;
  // General or hypothetical explanations ("in a rising market…", "if prices fall…") are not claims about the session.
  if(/\b(if|when|whenever|whether|in a (?:rising|falling|volatile)|a (?:rising|falling) market|tends? to|can|may|could)\b/i.test(s))return false;
  // Only sentences that name an index, or the benchmarks/indices collectively, are checked against the verified sign.
  const targets=NIFTY.test(s)||SENSEX.test(s)?[NIFTY.test(s)&&'nifty50',SENSEX.test(s)&&'sensex'].filter(Boolean) as string[]:/\b(benchmarks?|indices)\b/i.test(s)?Object.keys(dir):[];
  return targets.some(t=>(up&&!down&&dir[t]!=='up')||(down&&!up&&dir[t]!=='down'));
 }));
 fail('direction','Up/down wording matches the verified change',directionProblem?`“${directionProblem.slice(0,100)}”`:undefined);

 // Dates: no relative-day words; the session is named by its actual date.
 const relative=all.find(t=>RELATIVE_DAY.test(t));
 fail('dates','Uses the actual session date, not “today” or “live”',relative?`“${relative.slice(0,80)}”`:undefined);

 // Causes: any causal wording must cite a news item that shares its key terms.
 const causal=claims.find(x=>{if(!CAUSAL.test(x.c.text))return false;const cited=e.news.filter(n=>x.c.supports.includes(n.id));if(!cited.length)return true;
  const w=new Set(words(x.c.text.replace(CAUSAL,' ')));return !cited.some(n=>words(`${n.title} ${n.summary}`).filter(t=>w.has(t)).length>=2)});
 fail('causes','Any cause is supported by a cited news item',causal?`Unsupported cause: “${causal.c.text.slice(0,100)}”`:undefined);
 const headlineCausal=CAUSAL.test(a.verdict_headline)&&!a.verdict_summary.supports.some(s=>newsIds.has(s));
 if(headlineCausal)checks[checks.length-1]={id:'causes',label:'Any cause is supported by a cited news item',passed:false,detail:'The headline states a cause without a cited news item'};

 // Investment safety.
 const advice=all.find(t=>ADVICE.test(t)),prediction=all.find(t=>PREDICTION.test(t)),guarantee=all.find(t=>GUARANTEE.test(t));
 fail('advice','No personalised recommendation to buy, sell, continue, pause or stop',advice?`“${advice.slice(0,100)}”`:undefined);
 fail('predictions','No forecast of market direction or returns',prediction?`“${prediction.slice(0,100)}”`:undefined);
 fail('guarantees','No guaranteed-return or certainty claims',guarantee?`“${guarantee.slice(0,100)}”`:undefined);

 // Uncertainty is disclosed.
 fail('uncertainty','States what remains uncertain',a.uncertainty.length?undefined:'No uncertainty given');
 return {passed:checks.every(c=>c.passed),checks};
}
