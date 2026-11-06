import {z} from 'zod';
import type {Fact,Topic} from './context';
import type {Source} from '../sources';
import {assumptionId} from './prompt';

/**
 * Fail-closed checks applied to model output before anything is displayed.
 * Checks run in order and stop at the first failure; later checks are reported as
 * "not_run", never as passed. They are rule-based: they reject known failure patterns
 * but cannot prove an answer is true or complete. A matching citation id is never
 * treated as proof on its own: each claim is also checked against what it cites.
 */
export type CheckStatus='passed'|'failed'|'not_run'|'not_applicable';
export type GateCheck={id:string;label:string;status:CheckStatus;detail?:string};
export const OUTPUT_STAGES=[
 ['schema','Structured-output validation'],
 ['numbers','Arithmetic consistency with LifeFlow calculations'],
 ['source_support','Claim-to-source support'],
 ['investment_safety','Investment-safety screening'],
 ['uncertainty','Uncertainty and missing-context check'],
] as const;
export type OutputStage=(typeof OUTPUT_STAGES)[number][0];

const text=(min:number,max:number)=>z.string().trim().min(min).max(max);
export const outputSchema=z.object({
 summary:text(8,280),
 points:z.array(z.object({text:text(5,420),supports:z.array(z.string().max(60)).max(8)}).strict()).min(1).max(6),
 missing_information:z.array(text(3,220)).max(4),
 next_steps:z.array(text(3,220)).max(4),
 uncertainty:text(10,320),
 requires_abstention:z.boolean(),
 abstention_reason:z.string().trim().max(320),
}).strict().superRefine((o,ctx)=>{
 if(!o.requires_abstention&&o.next_steps.length===0)ctx.addIssue({code:'custom',path:['next_steps'],message:'At least one next step is required unless abstaining'});
 if(o.requires_abstention&&o.abstention_reason.length<10)ctx.addIssue({code:'custom',path:['abstention_reason'],message:'An abstention needs a reason'});
});
export type ModelOutput=z.infer<typeof outputSchema>;

// Verb stems; any inflection matches ("increasing", "paused").
const ACT='(?:buy|sell|switch|redeem|paus|stop|cancel|skip|increas|decreas|reduc|lower|rais|top ?up|step ?up|withdraw|exit|start|discontinu|halt|adjust|modif|revis|invest more|invest less)\\w*';
// Verbs that are directive only when an investment object follows closely ("save ₹9,000 for an SIP").
const ACT_OBJ=`${ACT}|(?:chang|alter|allocat|put|sav|set aside|mov|shift)\\w*`;
// "funds" as money ("arrival of funds", "insufficient funds") is not an investment object.
const OBJ='mutual funds?|(?<!(?:emergency|insufficient|sufficient|available|enough|of|own|your) )funds?|schemes?|sips?|investments?|stocks?|shares?|units|portfolios?|mandates?|equity|instalments?|installments?|contributions?';
// Stricter than the input rule: any directive verb within five words of an investment object fails closed.
const DIRECTIVE=new RegExp(`\\b(${ACT_OBJ})\\b(?:\\s+[^\\s.!?]+){0,5}?\\s+(${OBJ})\\b|\\bafford to (?:save|invest|put|allocate|pay for)\\b|\\b(?:you )?(?:can|could|should|will be able to|are able to)\\s+(?:save|invest)\\b|\\b(you should|you must|you need to|consider|it is better to|it's better to|you could|you may want to|i recommend|i suggest|we recommend|try to)\\b[^.]{0,60}\\b(${ACT}|invest)\\b`,'i');
// A restated source sentence about what a fund house may do is not a directive to the user.
const THIRD_PARTY=/\b(fund house|mutual fund company|the mutual fund|amc)\b[^.]{0,25}\b(may|would|can|will|might)\b|\b(?:lead|cause|prompt)\w*\s+the\s+(?:fund house|mutual fund company|amc)\s+to\b/i;
// "returns" as investment returns, not the verb in "return any unused cheques" (AMFI's own wording).
const RETURNS=/\b(returns\b(?!\s+(?:any|all|the|unused))|return (?:on|of)\b|rate of return|expected return|guarantee\w*\b[^.]{0,30}\b(?:returns?|profits?|gains?|growth|income|money|interest)\b|guaranteed\s+(?:returns?|income|profits?|gains?)|assured|risk-?free|sure-?shot|profits?|compound\w*|appreciat\w*|beat inflation|grow(?:s|th|ing)?|wealth|interest|total value|value over time|high[- ]yield|outperform\w*|market (?:gains?|performance))\b|\d\s?%|\bper ?cent\b/i;
const ACCOUNT_RULE=/\b(penalt(?:y|ies)|fees?|charges?|fined|bounce charges?|retr(?:y|ies|ied)|re-?attempt\w*|re-?process\w*|grace period|consecutive|nach|npci|rbi|tax(?:es|ed)?|nav|exit load|lock-?in|cut-?off|expir\w*|forfeiture)\b/gi;
const INSTITUTION=/\b(hdfc|icici|sbi|axis|kotak|yes bank|pnb|bank of baroda|canara|idfc|indusind|groww|zerodha|paytm|phonepe|nippon|mirae|parag parikh|uti|aditya birla|motilal|quant mutual)\b/i;
const ACCESS_CLAIM=/\b(i|we)\s+(?:have\s+)?(?:checked|accessed|verified|looked at|reviewed|confirmed)\s+(?:your|the)\s+(?:account|bank|mandate|transaction|portfolio|payment)|\b(i|we)\s+(?:will|can|have|just)\s+(?:pay|paid|debit|transfer|execute|place|cancel|pause|stop|process|retry)\b|\byour (?:account|bank statement|portfolio|mandate) (?:shows|says|indicates)\b/i;
const ECHO=/system prompt|ignore (?:all|previous|the above)|developer mode|as an ai language model|<\/?[a-z]+>|```/i;
const LINK=/https?:\/\/|www\.|\b[a-z0-9-]+\.(?:com|in|org|gov|net|co)\b/i;
const OTHER_AUTHORITY=/\b(according to|as per|as stated by|provided by|published by)\s+(?!sebi\b|amfi\b|the (?:sebi|amfi)\b|your\b|the figures\b|lifeflow\b)[a-z]/i;
const CERTAINTY=/\b(will|won'?t|will not|definitely|certainly|surely|guaranteed to|is going to)\b[^.]{0,30}\b(fail|bounce|succeed|go through|be debited|be deducted|be paid|be fine|be safe|be okay|be ok|be rejected|be declined)\b|\bno need to (?:worry|check|verify)\b|\bnothing to worry\b|\bdon'?t worry\b/i;
const SPECULATION=/\b(can|could|may|might|is likely to|probably|possibly|often|usually|commonly)\b[^.]{0,25}\b(?:be )?(?:due to|because of|caused by)\b|\b(?:the )?(?:reason|cause)\b[^.]{0,20}\b(?:is|was|could be|may be|might be)\b(?! unknown| not known)/i;
// The real browser-model run twice described post-SIP remaining cash as money "available for" the SIP.
const ROLE_ERROR=/\b(?:available|left|remaining|goes?|going)\b[^.]{0,25}\b(?:for|towards|to)\b(?:\s+(?:the|your|a|an|monthly))*\s+sips?\b|\bsips?\b[^.]{0,40}\bdebit(?:ed)?\s+from\s+(?:this|the)\s+remaining\b/i;
// "No penalty" is only true of the fund house (AMFI); banks may charge for a failed debit.
const NO_PENALTY=/\b(?:no|without)\s+(?:any\s+|a\s+)?(?:penalt(?:y|ies)|charges?|fees?)\b|\b(?:not|never)\s+(?:incur|attract|levy|charge|result in)\w*\s+(?:a |any )?(?:penalt(?:y|ies)|charges?|fees?)\b|\bpenalty-free\b/i;
const BANK_CAVEAT=/\bbank\b[^.]{0,60}\b(?:charges?|fees?|penalt(?:y|ies))\b|\b(?:charges?|fees?)\b[^.]{0,60}\bbank\b/i;
const HEDGE=/\b(not|unknown|may|might|could|depend\w*|verify|unclear|cannot|can't|uncertain|estimate\w*|illustrat\w*|unable|without|more information|missing)\b/i;
const CONCEPT=/\b(sips?|systematic investment|mutual funds?|mandates?|standing instructions?|auto-?debit\w*|ecs|nach|clearing|schemes?|post-dated|instal+ments?|fund house)\b/i;
const DEFINITIONAL=/\b(is|are|means|refers? to|allows?|lets|enables?|involves?|works?|would|may|happens?)\b/i;
const NUMBER_WORDS=/\b(thousand|lakhs?|crores?|hundred|million|billion)\b|\b\d+(?:\.\d+)?\s?k\b/i;

// Words a claim may use without appearing in its cited excerpt: plain explanation and the user's situation.
// Light normalisation so "missed"/"miss" and British "instalment"/"installment" compare equal. No synonyms are added.
const stem=(w:string)=>w.replace(/'s$/,'').replace(/^instal(?!l)/,'install').replace(/ly$/,'').replace(/ied$/,'y').replace(/(ing|(?<!e)ed|es)$/,'').replace(/([^s])s$/,'$1');
const SITUATION=new Set('this that these those your you yours with from have has will would could should what when where which while about into over also only just than then them they their there here been being does doing done more most some such very each every other both before after during between because since until whether means mean meaning used using uses help helps helpful simply plain idea basic basically general generally usually often regular regularly fixed amount amounts money month monthly date dates time timing salary delay delayed expense expenses rent income job transition balance available commitments commitment cash remaining estimate estimated figures figure entered calculation calculated payment payments debit debited debits status reported failed failure reason unknown check checking verify confirm official channel channels bank fund house account details information issue issues question situation plan planning picture life event scenario arrive arrives arrival affect affects impact change changes changed scheduled due upcoming next current like works work happen happens happened need needs make makes keep set sets same different instead lifeflow companion educational explanation explains explain says source according'.split(' ').map(stem));
// Plain connective and process words that add no financial claim of their own (added after real salary-delay answers
// were blocked for "cash flow", "the chosen date", "typically processed", "independent of when your salary lands").
// Financial content words (returns, NAV, retries, penalties, fees…) are deliberately NOT here.
for(const w of 'flow inflow outflow independent independently regardless chosen choose choice typical typically normal normally usual process processed processing executed execute describe described determine determines determined require requires required sufficient insufficient enough attempt attempted shift shifts shifted land lands landed credit credited crediting overall remain remains instruction itself whether actual actually without though although however further alone depend depends succeed success successful specific present lack lacks still guarantee budget specify specified specifies agree agreed'.split(' '))SITUATION.add(stem(w));
const STOP=new Set('the and for are but not you all any can her was one our out day get has him his how man new now old see two way who boy did its let put say she too use a an of to in on at by is it be as or if so do no up we my me am'.split(' '));
// Hyphens of every kind (the model often writes "auto‑debited" with U+2011) split words, on both sides of the comparison.
const words=(s:string)=>s.toLowerCase().replace(/\{[a-z_]+\}/g,' ').replace(/[‐-―−-]/g,' ').match(/[a-z][a-z']*/g)?.map(stem).filter(w=>w.length>=4&&!STOP.has(w))||[];

export type GateInput={raw:string;facts:Fact[];assumptions:string[];sources:Source[];topic:Topic;question:string};
export type ClaimSupport={id:string;kind:'fact'|'assumption'|'source';label:string};
export type Rendered={summary:string;explanation:string;claims:{text:string;supports:ClaimSupport[]}[];missing_information:string[];next_steps:string[];uncertainty:string;requires_abstention:boolean;abstention_reason:string;sources:Source[];facts_used:string[]};
export type GateResult={passed:true;checks:GateCheck[];output:ModelOutput;rendered:Rendered}|{passed:false;checks:GateCheck[];failedStage:OutputStage;detail:string};

const allTexts=(o:ModelOutput)=>[o.summary,...o.points.map(p=>p.text),o.uncertainty,o.abstention_reason,...o.missing_information,...o.next_steps];
const sentences=(o:ModelOutput)=>allTexts(o).flatMap(t=>t.split(/(?<=[.!?])\s+/));
const normaliseNumber=(s:string)=>Number(s.replace(/[₹,\s]|rs\.?|inr/gi,''));
const NUM=/(₹\s?|\brs\.?\s?|\binr\s?)?-?\d[\d,]*(?:\.\d+)?/gi;
const DATE=/\b\d{4}-\d{2}(?:-\d{2})?\b/g;
const MONTHS=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
const MON='(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
// Human-written dates: "8 December 2026", "December 8, 2026", "Dec 8", "5th Dec".
const HUMAN_DATE=new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MON}\\b(?:,?\\s+(\\d{4}))?|\\b${MON}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,?\\s+(\\d{4}))?`,'gi');
/** Checks every human-written date against LifeFlow's dates; returns the text with valid dates removed, or an error. */
function stripHumanDates(text:string,isoDates:Set<string>):{rest:string;error?:string}{
 let error:string|undefined;
 const rest=text.replace(HUMAN_DATE,(m,d1,mon1,y1,mon2,d2,y2)=>{
  const day=Number(d1??d2),month=MONTHS.indexOf(String(mon1??mon2).slice(0,3).toLowerCase())+1,year=y1??y2;
  const ok=[...isoDates].some(iso=>{const [y,mm,dd]=iso.split('-').map(Number);return mm===month&&(dd===undefined||dd===day)&&(!year||Number(year)===y)});
  if(!ok&&!error)error=`Date "${m.trim()}" does not match any entered or calculated date.`;
  return ' ';
 });
 return {rest,error};
}

/** Gate 2: every figure must equal a deterministic value, in the right role and direction. */
export function checkNumbers(o:ModelOutput,facts:Fact[]):string|null{
 const ids=new Set(facts.map(f=>f.id));
 const dateValues=new Set(facts.filter(f=>f.unit==='date'||f.unit==='month').map(f=>String(f.value)));
 const numeric=facts.filter(f=>typeof f.value==='number');
 const allowedAny=new Set(numeric.flatMap(f=>[f.value as number,Math.abs(f.value as number)]));
 const allowedMoney=new Set(numeric.filter(f=>f.unit==='INR').flatMap(f=>[f.value as number,Math.abs(f.value as number)]));
 for(const t of allTexts(o)){
  for(const m of t.matchAll(/\{([^{}\s]{1,40})\}/g))if(!ids.has(m[1]))return `Unknown placeholder {${m[1]}}.`;
  let rest=t.replace(/\{[a-z_]+\}/g,' ');
  for(const m of rest.matchAll(DATE))if(!dateValues.has(m[0]))return `Date ${m[0]} does not match any entered or calculated date.`;
  rest=rest.replace(DATE,' ');
  const human=stripHumanDates(rest,dateValues);if(human.error)return human.error;rest=human.rest;
  if(NUMBER_WORDS.test(rest))return 'Amount written in words; figures must come from LifeFlow placeholders.';
  for(const m of rest.matchAll(NUM)){
   const value=normaliseNumber(m[0]);if(!Number.isFinite(value))return `Unreadable figure "${m[0]}".`;
   const allowed=m[1]?allowedMoney:allowedAny;
   if(!allowed.has(Math.abs(value))&&!allowed.has(value))return `Figure "${m[0].trim()}" does not match any LifeFlow calculation or entered value.`;
  }
 }
 const joined=allTexts(o).join(' \n ');
 if(/(₹|\brs\.?|\binr)\s?\d{4}-\d{2}/i.test(joined))return 'A date is written as a rupee amount.';
 const remainingIds=['remaining_now','scenario_before','scenario_after'];
 const remainingValues=facts.filter(f=>remainingIds.includes(f.id)).map(f=>Math.abs(f.value as number));
 for(const s of sentences(o)){
  const mentions=remainingIds.some(id=>s.includes(`{${id}}`))||[...s.matchAll(/(?:₹\s?)?\d[\d,]*(?:\.\d+)?/g)].some(m=>remainingValues.includes(Math.abs(normaliseNumber(m[0]))));
  if(mentions&&ROLE_ERROR.test(s))return 'Text describes remaining cash (already after the SIP) as money available for the SIP.';
 }
 const timing=facts.find(f=>f.id==='timing_statement')?.value;
 if(typeof timing==='string'){
  const after=/ after the SIP/.test(timing),before=/ before the SIP/.test(timing);
  for(const s of sentences(o)){
   if(!/\bsalary\b/i.test(s))continue;
   // Only claims about when the salary arrives count; "check your balance before the SIP date" is not a timing claim.
   // Wrong only when the SALARY is said to come first ("salary arrives before the SIP", "salary… earlier than…").
   // "The SIP is due before the salary arrives" is correct and must not match.
   if(after&&(/\bsalary\b[^.]{0,40}\b(?:arriv\w*|credit\w*|com(?:e|es|ing)|receiv\w*|paid|land\w*|reach\w*)\b\s+(?:\w+\s+){0,2}?(?:earlier|sooner|before)\b[^.]{0,20}\b(?:sip|debit|due)\b/i.test(s)||/\bsalary\b[^.]{0,80}\b(?:earlier|sooner) than\b/i.test(s)))return 'Text says the salary arrives earlier than LifeFlow calculated.';
   if(before&&/\b(after|later)\b[^.]{0,30}\b(sip|debit)\b/i.test(s))return 'Text says the salary arrives after the SIP date, but LifeFlow calculated it arrives before.';
  }
  if(/\b(remaining cash|cash|estimate|balance)\b[^.]{0,40}\b(higher|increases?|more|rises?)\b/i.test(joined))return 'A salary delay changes timing, not amounts, but the text says cash increases.';
 }
 if(!facts.some(f=>f.id==='new_salary')&&facts.some(f=>f.id==='previous_salary')&&/\bnew (?:monthly )?salary\b[^.]{0,30}(₹|\d|\{)/i.test(joined))return 'Text states a new salary figure, but the new salary is unknown.';
 const change=facts.find(f=>f.id==='scenario_change')?.value;
 if(typeof change==='number'){
  const body=`${o.summary} ${o.points.map(p=>p.text).join(' ')}`.toLowerCase();
  const up=/\b(remaining cash|cash|estimate|money left)\b[^.]{0,40}\b(increases?|rises?|goes up|grows?|higher)\b/.test(body);
  const down=/\b(remaining cash|cash|estimate|money left)\b[^.]{0,40}\b(decreases?|falls?|drops?|goes down|reduces?|lower)\b/.test(body);
  if(change<0&&up&&!down)return 'Text says remaining cash increases, but the calculated change is negative.';
  if(change>0&&down&&!up)return 'Text says remaining cash decreases, but the calculated change is positive.';
 }
 return null;
}

/** Gate 3: each claim must declare support, and what it says must be consistent with what it cites. */
export function checkClaimSupport(o:ModelOutput,ctx:{facts:Fact[];assumptions:string[];sources:Source[];topic:Topic;question:string}):string|null{
 const factById=new Map(ctx.facts.map(f=>[f.id,f]));
 const assumptionById=new Map(ctx.assumptions.map((a,i)=>[assumptionId(i),a]));
 const sourceById=new Map(ctx.sources.map(s=>[s.id,s]));
 const joined=allTexts(o).join(' \n ');
 if(LINK.test(joined))return 'The answer contains a link or web address; only approved LifeFlow sources may be cited.';
 if(OTHER_AUTHORITY.test(joined))return 'The answer attributes a claim to an authority that is not an approved source.';
 const conceptTopic=ctx.topic==='sip_basics'||ctx.topic==='mandate_basics';
 const questionWords=new Set(words(ctx.question));
 const citedSources=new Set<string>();
 for(const [i,p] of o.points.entries()){
  const n=`Claim ${i+1}`;
  if(!p.supports.length)return `${n} states something without citing any fact, assumption or source.`;
  const unknown=p.supports.find(id=>!factById.has(id)&&!assumptionById.has(id)&&!sourceById.has(id));
  if(unknown)return `${n} cites "${unknown}", which is not one of the approved facts or sources for this question.`;
  const facts=p.supports.flatMap(id=>factById.get(id)??[]);const srcs=p.supports.flatMap(id=>sourceById.get(id)??[]);const asm=p.supports.flatMap(id=>assumptionById.get(id)??[]);
  srcs.forEach(s=>citedSources.add(s.id));
  for(const m of p.text.matchAll(/\{([a-z_]+)\}/g))if(!p.supports.includes(m[1]))return `${n} uses the figure {${m[1]}} without citing it.`;
  // A claim may repeat numbers from the facts it cites, including numbers inside a cited LifeFlow sentence ("3 days after…").
  const own=new Set([...facts.filter(f=>typeof f.value==='number').flatMap(f=>[f.value as number,Math.abs(f.value as number)]),...facts.filter(f=>f.unit==='text').flatMap(f=>(String(f.value).match(/\d+(?:\.\d+)?/g)||[]).map(Number))]);
  const citedDates=new Set(facts.filter(f=>f.unit==='date'||f.unit==='month').map(f=>String(f.value)));
  for(const m of stripHumanDates(p.text.replace(/\{[a-z_]+\}/g,' ').replace(DATE,' '),citedDates.size?citedDates:new Set(['0000-00-00'])).rest.matchAll(NUM)){const v=normaliseNumber(m[0]);if(!own.has(v)&&!own.has(Math.abs(v)))return `${n} states "${m[0].trim()}", which is not a value of the facts it cites.`}
  const hasFigure=/\{[a-z_]+\}|\d/.test(p.text);
  // A hedged pointer to the user's bank asserts no rule; it only says what to verify. Figures and rule terms still face gates 2 and 4.
  const bankCaveat=BANK_CAVEAT.test(p.text)&&/\b(may|might|can vary|varies)\b/i.test(p.text)&&/\b(check|verify|confirm|review|ask)\b/i.test(p.text)&&!hasFigure&&!NUMBER_WORDS.test(p.text)&&!/\b(one|two|three|four|five|several|after|within|retr\w*)\b/i.test(p.text);
  if(bankCaveat)continue;
  // A trailing bank-charges caveat ("…though your bank could apply its own charges") is not part of the sourced claim.
  const claimText=p.text.replace(/[,;]?\s*\b(?:though|but|although|however|and)?\s*your bank\b[^.;]*\b(?:charges?|fees?)\b[^.;]*/i,' ');
  const content=words(claimText).filter(w=>!SITUATION.has(w)&&!questionWords.has(w));
  if(srcs.length){
   const support=new Set([...srcs.flatMap(s=>words(`${s.excerpt} ${s.title} ${s.organisation}`)),...facts.flatMap(f=>words(`${f.label} ${typeof f.value==='string'?f.value:''}`)),...asm.flatMap(words)]);
   const unsupported=content.filter(w=>!support.has(w));
   if(content.length&&unsupported.length/content.length>0.34)return `${n} is not supported by the source it cites (unsupported terms: ${unsupported.slice(0,4).join(', ')}).`;
  }else if(/^(?:check|verify|confirm|review|look|contact|ask|log)\b/i.test(p.text.trim())){
   // An instruction to check something asserts no fact; gates 4 and 5 still screen it.
  }else if(CONCEPT.test(p.text)&&DEFINITIONAL.test(p.text)&&!hasFigure&&!facts.length){
   return `${n} explains a concept without citing an approved source.`;
  }else if(facts.length&&!hasFigure){
   // A claim citing facts but stating no figure must still stay close to what those facts (and any cited assumptions) say.
   const support=new Set([...facts.flatMap(f=>words(`${f.label} ${typeof f.value==='string'?f.value:''} ${f.formula??''}`)),...asm.flatMap(words)]);
   const unsupported=content.filter(w=>!support.has(w));
   if(content.length&&unsupported.length/content.length>0.5)return `${n} goes beyond the facts it cites (unsupported terms: ${unsupported.slice(0,4).join(', ')}).`;
  }else if(!facts.length&&asm.length){
   const support=new Set(asm.flatMap(words));const unsupported=content.filter(w=>!support.has(w));
   if(content.length&&unsupported.length/content.length>0.5)return `${n} goes beyond the assumption it cites (unsupported terms: ${unsupported.slice(0,4).join(', ')}).`;
  }
 }
 const cited=[...citedSources].map(id=>sourceById.get(id)!);
 for(const org of ['SEBI','AMFI'] as const)if(new RegExp(`\\b${org}\\b`).test(joined)&&!cited.some(s=>s.organisation===org))return `The answer mentions ${org} without citing an approved ${org} source.`;
 if(conceptTopic&&!cited.length)return 'A concept explanation must cite an approved source.';
 if(conceptTopic)for(const t of [o.summary,...o.points.map(p=>p.text)])if(/\{[a-z_]+\}|\d|\b(calculat\w*|subtract\w*|deduct\w*|remaining cash|one-time expense|recurring (?:monthly )?expenses?|salary|bank balance)\b/i.test(t))return 'A concept answer drifted into personal figures or cash-flow calculations the question did not ask about.';
 if(NO_PENALTY.test(joined)&&!BANK_CAVEAT.test(joined))return 'The answer says there is no penalty without noting that a bank may apply its own charges; approved sources only cover the fund house.';
 return null;
}

/** Gate 4: critical safety failures block regardless of anything else. */
export function checkInvestmentSafety(o:ModelOutput,citedExcerpts=''):string|null{
 const t=allTexts(o).join(' \n ');
 for(const s of sentences(o))if(DIRECTIVE.test(s)&&!THIRD_PARTY.test(s))return 'The answer directs an investment or SIP action.';
 if(RETURNS.test(t))return 'The answer mentions returns, growth, interest, guarantees or percentages.';
 const allowedTerms=new Set((citedExcerpts.match(ACCOUNT_RULE)||[]).map(x=>x.toLowerCase()));
 // A hedged pointer to the bank ("your bank may apply its own charges; check with your bank") is a caveat, not a stated rule.
 const caveat=(s:string)=>(/\b(may|might|could|vary|varies|depend\w*|not covered|cannot|can't|unknown|not known|does not reflect|possible|possibly|check with|verify with|confirm with|ask your bank)\b/i.test(s)||/\b(?:contact|ask|call|speak to|check with)\s+your bank\b/i.test(s)||/^\s*(?:contact|ask|check|verify|confirm|review|inquire|log)\b/i.test(s))&&(!/\b(will|must|always)\b/i.test(s)||/\b(?:cannot|can't|not)\s+(?:\w+\s+){0,2}(?:know|tell|say|predict|determine)\b|\bwhether\b/i.test(s));
 // Missing-information items name what is unknown ("bank charge details"); they may mention fees or charges.
 const missing=new Set(o.missing_information.flatMap(t=>t.split(/(?<=[.!?])\s+/)));
 const ruleTerms=sentences(o).flatMap(s=>(s.match(ACCOUNT_RULE)||[]).map(x=>x.toLowerCase()).filter(x=>!allowedTerms.has(x)&&!((caveat(s)||missing.has(s))&&/^(fees?|charges?)$/.test(x))));
 if(ruleTerms.length)return `The answer states payment-system rules (${ruleTerms[0]}) that no cited source supports.`;
 if(INSTITUTION.test(t))return 'The answer names a specific bank, broker or fund house.';
 if(ACCESS_CLAIM.test(t))return 'The answer claims account access or a transaction.';
 if(ECHO.test(t))return 'The answer contains instruction or markup content.';
 return null;
}

/** Gate 5: no false certainty, no guessed causes, and limits acknowledged. */
export function checkUncertainty(o:ModelOutput):string|null{
 const t=allTexts(o).join(' \n ');
 // Certainty inside a sentence about what a fund house *may* do is conditional ("…may stop the SIP, so later instalments will not be debited").
 // "We cannot know whether the debit will succeed" states uncertainty, not certainty.
 const negated=(s:string)=>/\b(cannot|can't|can not|unable to|don't|do not|not)\s+(?:\w+\s+){0,2}(?:know|tell|say|confirm|predict|determine|guarantee)\b|\bwhether\b|\bif\b[^.]{0,40}\bwill\b|\bunknown\b|\bnot certain\b/i.test(s);
 for(const s of sentences(o))if(CERTAINTY.test(s)&&!THIRD_PARTY.test(s)&&!negated(s))return 'The answer makes a certainty claim about a payment outcome.';
 if(SPECULATION.test(t))return 'The answer guesses the cause of a payment issue, which LifeFlow cannot know.';
 if(!HEDGE.test(o.uncertainty))return 'The uncertainty statement does not acknowledge any limitation.';
 return null;
}

export function gateModelOutput(input:GateInput):GateResult{
 const checks:GateCheck[]=OUTPUT_STAGES.map(([id,label])=>({id,label,status:'not_run'}));
 const fail=(stage:OutputStage,detail:string):GateResult=>{const c=checks.find(x=>x.id===stage)!;c.status='failed';c.detail=detail;return {passed:false,checks,failedStage:stage,detail}};
 const pass=(stage:OutputStage)=>{checks.find(x=>x.id===stage)!.status='passed'};
 let parsed:unknown;
 if(typeof input.raw!=='string'||input.raw.length>12000)return fail('schema','The AI output was missing or too long.');
 try{parsed=JSON.parse(input.raw)}catch{return fail('schema','The AI output was not valid JSON.')}
 const r=outputSchema.safeParse(parsed);
 if(!r.success)return fail('schema',`The AI output did not match the required structure (${r.error.issues[0]?.path.join('.')||'root'}: ${r.error.issues[0]?.message}).`);
 const o=r.data;o.points=o.points.map(p=>({...p,supports:[...new Set(p.supports)]}));
 pass('schema');
 const n=checkNumbers(o,input.facts);if(n)return fail('numbers',n);pass('numbers');
 const s=checkClaimSupport(o,input);if(s)return fail('source_support',s);pass('source_support');
 const sourceById=new Map(input.sources.map(x=>[x.id,x]));
 const citedIds=[...new Set(o.points.flatMap(p=>p.supports.filter(id=>sourceById.has(id))))];
 // Terms such as NACH may be used when an approved source retrieved for this question contains them; rule claims (retries, fees…) still fail.
 const i=checkInvestmentSafety(o,input.sources.map(s=>s.excerpt).join(' '));if(i)return fail('investment_safety',i);pass('investment_safety');
 const u=checkUncertainty(o);if(u)return fail('uncertainty',u);pass('uncertainty');
 const factById=new Map(input.facts.map(f=>[f.id,f]));const assumptionById=new Map(input.assumptions.map((a,i)=>[assumptionId(i),a]));
 const fill=(t:string)=>t.replace(/\{([a-z_]+)\}/g,(_,id:string)=>factById.get(id)?.display??'');
 const describe=(id:string):ClaimSupport=>factById.has(id)?{id,kind:'fact',label:`${factById.get(id)!.origin==='user'?'Your entry':'LifeFlow calculation'}: ${factById.get(id)!.label}`}:sourceById.has(id)?{id,kind:'source',label:`${sourceById.get(id)!.organisation}: ${sourceById.get(id)!.title}`}:{id,kind:'assumption',label:`Assumption: ${assumptionById.get(id)}`};
 const claims=o.points.map(p=>({text:fill(p.text),supports:p.supports.map(describe)}));
 return {passed:true,checks,output:o,rendered:{summary:fill(o.summary),explanation:claims.map(c=>c.text).join(' '),claims,missing_information:o.missing_information.map(fill),next_steps:o.next_steps.map(fill),uncertainty:fill(o.uncertainty),requires_abstention:o.requires_abstention,abstention_reason:fill(o.abstention_reason),sources:citedIds.map(id=>sourceById.get(id)!),facts_used:[...new Set(o.points.flatMap(p=>p.supports.filter(id=>factById.has(id))))]}};
}
