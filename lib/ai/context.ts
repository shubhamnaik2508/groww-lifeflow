import {cashFlow,calculateScenario,daysBetween,money,validAmount,Profile,Scenario} from '../calc';
import {sourcesFor,Source,SourceTopic} from '../sources';

/** Every figure shown beside an AI answer comes from this sheet, never from the model. */
export type Fact={id:string;label:string;value:number|string;unit:'INR'|'days'|'date'|'month'|'text';origin:'user'|'calculated';display:string;formula?:string};
export type Topic='cash_flow'|'unexpected_expense'|'rent_increase'|'salary_delay'|'job_transition'|'debit_failure'|'sip_basics'|'mandate_basics';
export type Preflight=
 |{decision:'proceed';topic:Topic;facts:Fact[];assumptions:string[];missing:string[];sources:Source[];question:string}
 |{decision:'abstain'|'clarify';reason:string;message:string;detail:string;facts:Fact[];assumptions:string[];missing:string[];topic:Topic|null};

export const MAX_QUESTION=600;
const fmt=(unit:Fact['unit'],v:number|string)=>unit==='INR'?money(v as number):unit==='days'?`${v} day${v===1?'':'s'}`:String(v);
const fact=(id:string,label:string,value:number|string,unit:Fact['unit'],origin:Fact['origin']):Fact=>({id,label,value,unit,origin,display:fmt(unit,value)});

// Deterministic pre-model rules. These are defence in depth, not a guarantee.
export const SENSITIVE=/\b[A-Z]{5}[0-9]{4}[A-Z]\b|\b\d{4}\s?\d{4}\s?\d{4}\b|\b\d{9,}\b|\b(password|passcode|pin\b|otp|cvv|aadhaa?r|pan (?:no|number|card)|account (?:no|number)|card number|ifsc|upi pin|net ?banking id)\b/i;
export const INJECTION=/\b(ignore|disregard|forget|override|bypass|disable)\b[\s\S]{0,60}\b(instructions?|rules?|prompt|safety|checks?|guardrails?|policy|above|previous)\b|\b(system prompt|developer mode|jailbreak|you are now|act as|pretend to be|new instructions|reveal (?:your|the) (?:prompt|instructions))\b|\b(invent|fabricate|make up)\b[\s\S]{0,40}\b(sources?|citations?|numbers?|figures?)\b|<\/?(system|assistant|instructions?)>/i;
const ACT='buy|sell|switch|redeem|pause|stop|cancel|skip|increase|decrease|reduce|lower|raise|top ?up|step ?up|withdraw|exit|start|invest|move';
const OBJ='funds?|schemes?|sips?|investments?|stocks?|shares?|units|portfolios?|mandates?|equity|elss|index funds?';
export const ADVICE=new RegExp(`\\b(recommend|suggest|best|safest|top|good|better|choose|pick)\\b[\\s\\S]{0,40}\\b(${OBJ})\\b|\\b(should|shall|can|could|must|do) i\\b[\\s\\S]{0,40}\\b(${ACT})\\b|\\b(${ACT})\\s+(?:(?:my|the|a|an|this|that|all|some|more|less|in|into)\\s+){0,2}(${OBJ})\\b|\\bwhich\\s+(${OBJ}|amc)\\b|\\b(where|what) should i invest\\b|\\bis (?:it|this|now) a good (?:fund|investment|time to invest)\\b|\\bguarantee\\w*\\b`,'i');
// Bank- or scheme-specific rules no approved source covers. General "what happens if I miss an SIP" is answerable from AMFI.
export const ACCOUNT_RULES=/\b(?:my|the|your)\s+bank\b[\s\S]{0,40}\b(?:penalt(?:y|ies)|fees?|charges?|fine)\b|\b(?:penalt(?:y|ies)|fees?|charges?)\b[\s\S]{0,40}\b(?:my|the|your)\s+bank\b|\b(fees?|charges?|bounce charges?|retr(?:y|ies|ied)|re-?attempt|reprocess|grace period|how many (?:days|hours)|nav|tax\w*|returns?|interest rate|cut-?off|exit load|lock-?in)\b|\bwill (?:my|the) (?:bank|amc|fund house|mandate)\b/i;

function detectTopic(q:string,scenario:Scenario|null):Topic|null{
 const s=q.toLowerCase();
 if(/\b(fail(?:ed|ure|s)?|bounced?|declined|unsuccessful|not debited|didn'?t go through|penalt(?:y|ies))\b|\bmiss(?:ed|ing)?\b[\s\S]{0,30}\b(?:sips?|instal+ments?|payments?|debits?)\b/.test(s))return 'debit_failure';
 if(/\b(salary|pay(?:check|day)?)\b[\s\S]{0,40}\b(late|delay(?:ed)?|not (?:yet )?(?:come|arrived|credited))\b|\b(late|delayed)\b[\s\S]{0,20}\bsalary\b/.test(s))return 'salary_delay';
 if(/\b(jobs?|employer|laid off|layoff|resign\w*|notice period|unemploy\w*|income (?:gap|interruption|stops?)|gap in (?:my )?income|new role|lost my (?:job|income))\b/.test(s))return 'job_transition';
 if(/\brent\b/.test(s))return 'rent_increase';
 if(/\b(mandate|auto-?debit|standing instruction|ecs|nach|how (?:is|does) (?:the |my )?sip (?:get )?(?:paid|debited|deducted))\b/.test(s))return 'mandate_basics';
 if(/\b(what is|what's|what are|meaning of|explain|define|how does)\b[\s\S]{0,30}\b(sips?|systematic investment plan)\b/.test(s))return 'sip_basics';
 if(/\b(unexpected|surprise|emergency|medical|hospital|repair|one-?time|expense|bill|cost)\b/.test(s))return 'unexpected_expense';
 if(/\b(cash|budget|remaining|left over|leftover|spend|afford|month|this scenario|my situation|affect|impact|what should i check)\b/.test(s)){
  const map:Record<string,Topic>={expense:'unexpected_expense',salary:'salary_delay',rent:'rent_increase',job:'job_transition',failure:'debit_failure'};
  return scenario?map[scenario.type]||'cash_flow':'cash_flow';
 }
 return null;
}

const topicSources:Record<Topic,SourceTopic[]>={cash_flow:['cash_flow'],unexpected_expense:['cash_flow','emergency'],rent_increase:['cash_flow'],salary_delay:['sip_mandate','cash_flow'],job_transition:['cash_flow','emergency'],debit_failure:['sip_missed'],sip_basics:['sip_basics'],mandate_basics:['sip_mandate']};

const FORMULAS:Record<string,string>={remaining_now:'salary − recurring_expenses − sip_amount (money left after expenses AND the SIP)',scenario_before:'salary − recurring_expenses − sip_amount, before the life event (already after the SIP)',scenario_change:'scenario_after − scenario_before',rent_change:'revised_rent − previous_rent',salary_change:'new_salary − previous_salary',expected_salary_arrival:'expected_salary_date + salary_delay_days',days_salary_after_debit:'days between sip_debit_date and expected_salary_arrival'};

/** Builds facts from the current monthly picture and the saved scenario (recomputed here, not trusted from storage). */
export function buildFacts(profile:Profile,scenario:Scenario|null){
 const facts:Fact[]=[];const assumptions=['Figures are illustrative entries, not a verified bank balance.','The estimate is take-home salary minus recurring expenses, SIP commitment and any applicable one-time expense.'];
 const missing:string[]=[];
 const profileValid=[profile.salary,profile.expenses,profile.sip].every(validAmount);
 if(profileValid){
  facts.push(fact('salary','Monthly take-home salary',profile.salary,'INR','user'),fact('recurring_expenses','Recurring monthly expenses',profile.expenses,'INR','user'),fact('sip_amount','Monthly SIP commitment',profile.sip,'INR','user'));
  if(profile.sipDate&&daysBetween(profile.sipDate,profile.sipDate)!==null)facts.push(fact('sip_date','Upcoming SIP date',profile.sipDate,'date','user'));
  facts.push(fact('remaining_now','Estimated remaining cash (current monthly picture)',cashFlow(profile.salary,profile.expenses,profile.sip),'INR','calculated'));
 }
 for(const f of facts)if(FORMULAS[f.id])f.formula=FORMULAS[f.id];
 if(!scenario?.inputs||!scenario.profile)return {facts,assumptions,missing,profileValid,scenarioValid:false};
 let calc:ReturnType<typeof calculateScenario>;
 try{calc=calculateScenario(scenario.type,scenario.inputs,scenario.profile)}catch{missing.push('The saved scenario could not be recalculated. Please run it again in the Scenario Lab.');return {facts,assumptions,missing,profileValid,scenarioValid:false}}
 const v=scenario.inputs,p=scenario.profile;
 const same=p.salary===profile.salary&&p.expenses===profile.expenses&&p.sip===profile.sip;
 if(!same)missing.push('Your monthly picture changed after this scenario was saved. Re-run the scenario to use your current figures.');
 facts.push(fact('scenario_before','Estimated remaining cash before the life event',calc.before,'INR','calculated'));
 if(scenario.type==='expense'){
  const recurring=v.frequency==='recurring';
  facts.push(fact(recurring?'recurring_expense_added':'one_time_expense',recurring?'New recurring monthly expense':'One-time expense',Number(v.amount),'INR','user'),fact('expense_category','Expense category',String(v.category||'').slice(0,60),'text','user'));
  assumptions.push(recurring?'The new expense is treated as an additional cost in every month it applies.':'The one-time expense affects only the illustrated month.');
 }
 if(scenario.type==='rent'){
  facts.push(fact('previous_rent','Previous monthly rent',Number(v.old),'INR','user'),fact('revised_rent','Revised monthly rent',Number(v.new),'INR','user'),fact('rent_effective_month','Rent change effective from',String(v.month),'month','user'),fact('rent_change','Monthly rent change',Number(v.new)-Number(v.old),'INR','calculated'));
  assumptions.push('Your recurring expenses already include the previous rent once.');
 }
 if(scenario.type==='salary'){
  const sipDate=v.debitDate||p.sipDate;const delay=Number(v.delay);
  const arrival=new Date(`${v.salaryDate}T00:00:00Z`);arrival.setUTCDate(arrival.getUTCDate()+delay);const arr=arrival.toISOString().slice(0,10);const gap=daysBetween(sipDate,arr)!;
  facts.push(fact('expected_salary_date','Originally expected salary date',String(v.salaryDate),'date','user'),fact('salary_delay_days','Expected salary delay',delay,'days','user'),fact('sip_debit_date','SIP debit date',sipDate,'date','user'),fact('expected_salary_arrival','Expected salary arrival after the delay',arr,'date','calculated'),fact('days_salary_after_debit',gap>=0?'Days the salary arrives after the SIP date':'Days the salary arrives before the SIP date',Math.abs(gap),'days','calculated'));
  facts.push(fact('timing_statement','Timing in plain words (written by LifeFlow)',gap>0?`The delayed salary is expected ${gap} day${gap===1?'':'s'} after the SIP debit date.`:gap<0?`The delayed salary is still expected ${-gap} day${gap===-1?'':'s'} before the SIP debit date.`:'The delayed salary is expected on the SIP debit date.','text','calculated'));
  if(v.balance?.trim())facts.push(fact('available_balance','Available balance you entered',Number(v.balance),'INR','user'));else missing.push('Your available balance before the SIP date was not entered.');
  assumptions.push('A salary delay changes timing, not the monthly amounts. Timing alone does not show whether a debit will succeed.');
 }
 if(scenario.type==='job'){
  facts.push(fact('previous_salary','Previous monthly salary',Number(v.oldSalary),'INR','user'),fact('income_gap_days','Expected income gap',Number(v.gap),'days','user'));
  if(v.newSalary?.trim())facts.push(fact('new_salary','Expected new monthly salary',Number(v.newSalary),'INR','user'),fact('salary_change','Change in monthly salary',Number(v.newSalary)-Number(v.oldSalary),'INR','calculated'));
  else missing.push('The expected new salary is unknown, so no post-transition monthly estimate is available.');
  missing.push('Savings available to cover the income gap were not entered.');
 }
 if(scenario.type==='failure'){
  facts.push(fact('reported_status','Payment status you reported',String(v.status||'').slice(0,60),'text','user'),fact('sip_debit_date','SIP debit date',v.debitDate||p.sipDate,'date','user'));
  if(v.mandate?.trim())facts.push(fact('mandate_status','Bank or mandate status you reported',String(v.mandate).slice(0,60),'text','user'));
  missing.push('The reason for the reported failure is unknown.','The bank and mandate status have not been verified by LifeFlow.');
 }
 if(calc.estimateKnown&&calc.after!==calc.before){facts.push(fact('scenario_after','Estimated remaining cash after the life event',calc.after,'INR','calculated'),fact('scenario_change','Change in estimated remaining cash',calc.change,'INR','calculated'))}
 const after:Record<string,string>={expense:v.frequency==='recurring'?'scenario_before − recurring_expense_added':'scenario_before − one_time_expense',rent:'scenario_before − rent_change',job:'new_salary − recurring_expenses − sip_amount'};
 for(const f of facts){const formula=f.id==='scenario_after'?after[scenario.type]:FORMULAS[f.id];if(formula)f.formula=formula}
 return {facts,assumptions,missing,profileValid,scenarioValid:true};
}

export function preflight(question:string,profile:Profile,scenario:Scenario|null):Preflight{
 const q=question.trim();const built=buildFacts(profile,scenario);const base={facts:built.facts,assumptions:built.assumptions,missing:built.missing};
 const stop=(decision:'abstain'|'clarify',reason:string,message:string,detail:string,topic:Topic|null=null):Preflight=>({decision,reason,message,detail,topic,...base});
 if(!q)return stop('clarify','empty_question','What would you like to understand?','Ask about salary timing, an unexpected expense, a rent change, a job transition, a reported SIP debit failure or SIP basics.');
 if(q.length>MAX_QUESTION)return stop('clarify','question_too_long','Please shorten your question.',`Questions are limited to ${MAX_QUESTION} characters.`);
 const userText=[q,...Object.values(scenario?.inputs||{})].join(' \n ');
 if(SENSITIVE.test(userText))return stop('abstain','sensitive_input','Please remove sensitive information and ask again.','Do not enter passwords, OTPs, PAN, Aadhaar, account or card numbers. LifeFlow never needs them.');
 if(INJECTION.test(userText))return stop('abstain','prompt_injection','I can’t change my instructions or invent sources.','The question contained text that tries to change how the companion behaves, so it was not sent to the model. Please ask a financial education question.');
 if(ADVICE.test(q))return stop('abstain','investment_advice_request','I can’t recommend investments or tell you to change an SIP.','LifeFlow explains cash flow and general SIP concepts. Decisions about buying, selling, switching, pausing or changing investments are yours; consider a SEBI-registered investment adviser for personal advice.');
 if(ACCOUNT_RULES.test(q))return stop('abstain','account_specific_rule','I can’t verify bank or fund-house rules, charges, returns or tax.','These depend on your bank, mandate and scheme documents. Check them through your bank’s or fund house’s official channels.');
 const topic=detectTopic(q,scenario);
 if(!topic)return stop('clarify','unclear_topic','Which situation would you like to explore?','I can help with a salary delay, an unexpected expense, a rent increase, a job transition, a reported SIP debit failure, or what an SIP or mandate is. Saving a scenario in the Scenario Lab gives me your figures.');
 const needsFigures=!['sip_basics','mandate_basics'].includes(topic);
 if(needsFigures&&!built.profileValid)return stop('clarify','missing_profile','Please complete your monthly picture first.','Enter valid, non-negative salary, expense and SIP amounts on Home so the figures can be calculated.',topic);
 if(needsFigures&&built.profileValid&&profile.salary===0&&profile.expenses===0&&profile.sip===0)return stop('clarify','missing_profile','Please add your monthly figures first.','Your monthly picture is empty. Add illustrative salary, expenses and SIP on Home, then ask again.',topic);
 return {decision:'proceed',topic,question:q,sources:sourcesFor(topicSources[topic]),...base};
}
