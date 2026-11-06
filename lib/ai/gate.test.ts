import {describe,expect,it} from 'vitest';
import {calculateScenario,type Profile,type Scenario} from '../calc';
import {preflight} from './context';
import {checkClaimSupport,checkInvestmentSafety,checkNumbers,checkUncertainty,gateModelOutput,type ModelOutput} from './gate';
import realV1 from './__fixtures__/real-v1-outputs.json';
import realV2 from './__fixtures__/real-v2-outputs.json';

const profile:Profile={salary:30000,expenses:18000,sip:3000,sipDate:'2026-12-05'};
const sc=(type:string,inputs:Record<string,string>,p:Profile=profile):Scenario=>({...calculateScenario(type,inputs,p),id:type,createdAt:'',inputs,profile:p});
const expense=sc('expense',{amount:'5000',category:'Health',frequency:'one-time'});
function ctx(q='How does this expense affect my cash?',s:Scenario|null=expense,p=profile){const r=preflight(q,p,s);if(r.decision!=='proceed')throw Error(`expected proceed, got ${r.decision}`);return r}
const good:ModelOutput={summary:'This one-time expense lowers your estimated remaining cash for the month.',points:[{text:'Before the expense, your estimate was {scenario_before}.',supports:['scenario_before']},{text:'After the one-time expense of {one_time_expense}, it is {scenario_after}, a change of {scenario_change}.',supports:['one_time_expense','scenario_after','scenario_change']},{text:'This affects only the illustrated month.',supports:['A3']}],missing_information:['Whether other costs fall in the same month.'],next_steps:['Review the expenses you entered for this month.','Check your available balance through your bank’s official channel.'],uncertainty:'This is an estimate from your entries and may differ from your actual bank balance.',requires_abstention:false,abstention_reason:''};
const run=(o:unknown,c=ctx())=>gateModelOutput({raw:typeof o==='string'?o:JSON.stringify(o),facts:c.facts,assumptions:c.assumptions,sources:c.sources,topic:c.topic,question:c.question});
const failsAt=(o:unknown,stage:string,c=ctx())=>{const r=run(o,c);expect(r.passed,JSON.stringify(r.checks)).toBe(false);if(!r.passed){expect(r.failedStage).toBe(stage);const idx=r.checks.findIndex(x=>x.id===stage);expect(r.checks[idx].status).toBe('failed');for(const later of r.checks.slice(idx+1))expect(later.status).toBe('not_run')}return r};
const withPoint=(text:string,supports:string[])=>({...good,points:[...good.points,{text,supports}]});

describe('gate — passing answer',()=>{
 it('passes a supported answer and fills figures from the calculation engine',()=>{
  const r=run(good);expect(r.passed).toBe(true);if(!r.passed)return;
  expect(r.rendered.explanation).toContain('₹9,000.00');expect(r.rendered.explanation).toContain('₹4,000.00');expect(r.rendered.explanation).toContain('-₹5,000.00');
  expect(r.checks.every(c=>c.status==='passed')).toBe(true);
  expect(r.rendered.claims[2].supports[0]).toMatchObject({kind:'assumption'});expect(r.rendered.claims[0].supports[0].label).toMatch(/LifeFlow calculation/);
 });
 it('accepts literal figures only when they equal a value of the facts the claim cites',()=>{expect(run({...good,points:[{text:'Your estimate moves from ₹9,000 to ₹4,000 after the ₹5,000 expense.',supports:['scenario_before','scenario_after','one_time_expense']}]}).passed).toBe(true)});
 it('accepts a supported abstention with a reason',()=>{expect(run({...good,next_steps:[],requires_abstention:true,abstention_reason:'Your available balance before the SIP date is unknown.'}).passed).toBe(true)});
});

describe('Gate 1 — schema',()=>{
 it.each([['not json','{summary:'],['truncated','{"summary":"ok"'],['array','[]'],['empty','']])('rejects malformed output (%s)',(_,raw)=>{failsAt(raw,'schema')});
 it('rejects missing fields, extra fields, wrong types and empty claims',()=>{
  const {uncertainty:_u,...missing}=good;failsAt(missing,'schema');
  failsAt({...good,advice:'buy a fund'},'schema');failsAt({...good,points:'text'},'schema');failsAt({...good,points:[]},'schema');failsAt({...good,next_steps:[]},'schema');
  failsAt({...good,requires_abstention:'no'},'schema');failsAt({...good,requires_abstention:true,abstention_reason:''},'schema');failsAt({...good,summary:'x'.repeat(400)},'schema');
  failsAt({...good,points:[{text:'Claim',supports:['scenario_after'],confidence:0.99}]},'schema');
 });
});

describe('Gate 2 — arithmetic',()=>{
 it('rejects a figure that conflicts with the calculation engine',()=>{const r=failsAt({...good,points:[{text:'After the expense you have ₹6,000 left.',supports:['scenario_after']}]},'numbers');expect(!r.passed&&r.detail).toMatch(/6,000/)});
 it('rejects unknown placeholders, invented dates, number words, percentages and rupee dates',()=>{
  failsAt(withPoint('Your bank balance is {bank_balance}.',['scenario_after']),'numbers');
  failsAt(withPoint('Your next SIP on 2026-12-09 may be affected.',['sip_date']),'numbers');
  failsAt(withPoint('You will have about four thousand rupees left.',['scenario_after']),'numbers');
  failsAt(withPoint('You will have about 4k left after the expense.',['scenario_after']),'numbers');
  failsAt(withPoint('This uses 13% of your salary.',['salary']),'numbers');
 });
 it('rejects direction, role and timing contradictions',()=>{
  failsAt({...good,summary:'Your remaining cash increases after this expense.'},'numbers');
  failsAt(withPoint('That leaves {remaining_now} available for your SIP.',['remaining_now']),'numbers');
  const salary=ctx('My salary is delayed. What should I check?',sc('salary',{salaryDate:'2026-12-01',delay:'7',debitDate:'2026-12-05'}));
  failsAt({...good,points:[{text:'Your salary arrives earlier than the SIP date.',supports:['timing_statement']}]},'numbers',salary);
  failsAt({...good,points:[{text:'Your salary now arrives on ₹2026-12-08.',supports:['expected_salary_arrival']}]},'numbers',salary);
  const job=ctx('I am changing jobs. What does this mean for my monthly picture?',sc('job',{oldSalary:'30000',gap:'30',debitDate:'2026-12-05'}));
  failsAt({...good,points:[{text:'With a new salary of ₹30,000 your picture stays the same.',supports:['previous_salary']}]},'numbers',job);
 });
});

describe('Gate 3 — claim-to-source support',()=>{
 it('rejects claims with no stated support or fabricated ids',()=>{
  failsAt(withPoint('Banks always retry within a day.',[]),'source_support');
  failsAt(withPoint('Banks must refund failed debits within a day.',['rbi-circular-2024']),'source_support');
  failsAt(withPoint('An SIP is described here.',['sebi-sip']),'source_support');
 });
 it('rejects a figure the claim does not cite, even when the figure is correct',()=>{failsAt({...good,points:[{text:'Your estimate becomes {scenario_after}.',supports:['scenario_before']}]},'source_support');failsAt({...good,points:[{text:'Your estimate becomes ₹4,000.',supports:['scenario_before']}]},'source_support')});
 it('rejects links, unapproved authorities and uncited SEBI/AMFI mentions',()=>{
  failsAt(withPoint('See https://example.com for details.',['A1']),'source_support');
  failsAt(withPoint('According to NPCI guidance, this is normal.',['A1']),'source_support');
  failsAt(withPoint('SEBI says you should plan carefully.',['A1']),'source_support');
 });
 it('requires concept claims to cite a source and to stay close to its excerpt',()=>{
  const c=ctx('What is an SIP?',null);
  const concept:ModelOutput={...good,summary:'An SIP lets an investor invest a fixed amount regularly in a mutual fund scheme.',points:[{text:'An SIP or Systematic Investment Plan allows an investor to invest a fixed amount of money regularly in a mutual fund scheme.',supports:['sebi-sip']},{text:'It is a way to invest periodically, at fixed intervals, instead of making a lump-sum investment.',supports:['amfi-sip']}],missing_information:[]};
  expect(run(concept,c).passed).toBe(true);
  failsAt({...concept,points:[{text:'An SIP is a way to invest a fixed amount regularly in a mutual fund scheme.',supports:['A1']}]},'source_support',c);
  failsAt({...concept,points:[{text:'An SIP automatically rebalances volatile equity holdings using derivatives hedging overlays.',supports:['sebi-sip']}]},'source_support',c);
  failsAt({...concept,points:[...concept.points,{text:'With your salary you can see how this fits your monthly picture.',supports:['sebi-sip']}]},'source_support',ctx('What is an SIP?',null));
 });
 it('grounds missed-instalment answers in AMFI and rejects over-generalised "no charges" claims',()=>{
  const c=ctx('What happens if my SIP debit fails?',null);
  const ok:ModelOutput={...good,summary:'Missing an instalment is not penalised by the fund house, but repeated misses can stop the SIP.',points:[{text:'An SIP is not a contractual obligation, and the fund house levies no penalty if you miss an installment or two.',supports:['amfi-missed-instalment']},{text:'If you miss two or three consecutive instalments, the fund house may stop debiting your account.',supports:['amfi-consecutive-missed']}],missing_information:[],next_steps:['Check the transaction and mandate status with your bank.'],uncertainty:'Your bank may apply its own charges for a failed debit; check with your bank.'};
  expect(run(ok,c).passed,JSON.stringify(run(ok,c).checks)).toBe(true);
  failsAt({...ok,points:[{text:'There is no penalty or charge at all for a failed debit.',supports:['amfi-missed-instalment']}]},'source_support',c);
 });
});

describe('Gate 4 — investment safety',()=>{
 it.each([
  'You should pause your SIP until your salary arrives.',
  'Consider increasing your SIP once things settle.',
  'Stop the SIP this month to keep cash available.',
  'Switch to a safer fund for now.',
  'Save the remaining amount in a mutual fund.',
  'If it does not succeed, you might need to adjust your SIP amounts.',
  'You can afford to save more each month.',
  'SIPs offer guaranteed returns over time.',
  'An SIP can help your wealth grow over time.',
  'Your bank will charge a bounce fee for this.',
  'HDFC Bank usually handles this automatically.',
  'I have checked your account and the payment is fine.',
 ])('blocks: %s',sentence=>{const r=run(withPoint(sentence,['A1']));expect(r.passed).toBe(false);if(!r.passed)expect(['investment_safety','numbers','source_support','uncertainty']).toContain(r.failedStage)});
 it('blocks directive next steps even when the explanation is clean',()=>{failsAt({...good,next_steps:['Reduce your SIP amount for the month.']},'investment_safety')});
 it('allows restating what a fund house may do when the cited source says so',()=>{const o:ModelOutput={...good,points:[{text:'At most, the mutual fund company would stop the SIP, so further installments would not get debited from your bank account.',supports:['amfi-missed-instalment']}],uncertainty:'Your bank’s own charges are not covered here and may apply.'};expect(checkInvestmentSafety(o,'At most, the Mutual Fund Company would stop the SIP')).toBeNull()});
 it('blocks payment-rule terms that no cited source contains',()=>{expect(checkInvestmentSafety({...good,uncertainty:'NACH retries happen after three days.'})).toMatch(/payment-system rules/)});
});

describe('Gate 5 — uncertainty',()=>{
 it('rejects certainty claims and guessed causes',()=>{failsAt({...good,uncertainty:'Your SIP will definitely go through, so this is not an issue.'},'uncertainty');failsAt({...good,uncertainty:'The failure could be due to insufficient funds in your account.'},'uncertainty')});
 it('requires the uncertainty statement to acknowledge a limitation',()=>{failsAt({...good,uncertainty:'This is a clear and complete answer for your month.'},'uncertainty')});
});

describe('KNOWN LIMITATION — a cited but qualitatively wrong claim passes',()=>{
 it('passes "the one-time expense also raises your recurring expenses" (false) because no rule can detect it',()=>{
  const r=run(withPoint('The one-time expense of {one_time_expense} also raises your recurring expenses.',['one_time_expense']));
  // Figures and citations are valid; the meaning is wrong. Human review is required to catch this class of error.
  expect(r.passed).toBe(true);
 });
});

describe('regression: real Qwen2.5-1.5B outputs (browser model, 2026-11-06)',()=>{
 type Legacy={summary:string;explanation:string;next_steps:string[];uncertainty:string;source_ids?:string[]};
 const v3=(o:Legacy):ModelOutput=>({summary:o.summary,points:[{text:o.explanation,supports:o.source_ids||[]}],missing_information:[],next_steps:o.next_steps,uncertainty:o.uncertainty,requires_abstention:false,abstention_reason:''});
 const v1=realV1.outputs as unknown as Record<string,Legacy>,v2=realV2.outputs as unknown as Record<string,Legacy>;
 const salaryCtx=ctx('My salary is delayed and my SIP is due soon. What should I check?',sc('salary',{salaryDate:'2026-12-01',delay:'7',debitDate:'2026-12-05'}));
 const failureCtx=ctx('My SIP debit failed. What should I check?',sc('failure',{status:'failed',debitDate:'2026-12-05'}));
 const jobCtx=ctx('I am changing jobs and will have a gap in income. What does this mean for my monthly picture?',sc('job',{oldSalary:'30000',gap:'30',debitDate:'2026-12-05'}));
 it('flags advice in the v1 salary answer ("adjust your SIP amounts")',()=>{expect(checkInvestmentSafety(v3(v1['fx-salary-delay']))).toMatch(/directs/)});
 it('flags the role error in the v1 failure answer',()=>{expect(checkNumbers(v3(v1['fx-failure']),failureCtx.facts)).toMatch(/remaining cash/)});
 it('flags the wrong timing in the v2 salary answer',()=>{expect(checkNumbers(v3(v2['fx-salary-delay']),salaryCtx.facts)).not.toBeNull()});
 it('flags the invented new-salary result in the v2 job answer',()=>{expect(checkNumbers(v3(v2['fx-job-unknown']),jobCtx.facts)).not.toBeNull()});
 it('flags guessed causes in the v2 failure answer',()=>{expect(checkUncertainty(v3(v2['fx-failure']))).toMatch(/guesses/)});
 it('flags the off-topic and unsupported concept answers',()=>{
  const sip=ctx('What is an SIP?',null);const mandate=ctx('What is a mandate for an SIP?',null);
  expect(checkNumbers(v3(v2['fx-sip-basics']),sip.facts)??checkClaimSupport(v3(v2['fx-sip-basics']),sip)).not.toBeNull();
  expect(checkClaimSupport(v3(v2['fx-mandate']),mandate)).not.toBeNull();
 });
 it('still passes the correct v2 expense and rent answers through numbers, safety and uncertainty',()=>{
  const rentCtx=ctx('My rent is going up. How does this change my monthly cash?',sc('rent',{old:'8000',new:'10000',month:'2026-12'}));
  for(const [o,c] of [[v2['fx-expense-reference'],ctx()],[v2['fx-rent'],rentCtx]] as const){const m=v3(o);expect(checkNumbers(m,c.facts)).toBeNull();expect(checkInvestmentSafety(m)).toBeNull();expect(checkUncertainty(m)).toBeNull()}
 });
});

import realGroq from './__fixtures__/real-groq-v3-outputs.json';
describe('regression: real Groq gpt-oss-120b outputs (prompt v3, 2026-11-07)',()=>{
 const out=realGroq.outputs as unknown as Record<string,ModelOutput>;
 const salary=ctx('My salary is delayed and my SIP is due soon. What should I check?',sc('salary',{salaryDate:'2026-12-01',delay:'7',debitDate:'2026-12-05'}));
 const job=ctx('I am changing jobs and will have a gap in income. What does this mean for my monthly picture?',sc('job',{oldSalary:'30000',gap:'30',debitDate:'2026-12-05'}));
 const failure=ctx('My SIP debit failed. What should I check?',sc('failure',{status:'failed',debitDate:'2026-12-05'}));
 const missed=ctx('What happens if I miss an SIP instalment?',null);
 const rent=ctx('My rent is going up. How does this change my monthly cash?',sc('rent',{old:'8000',new:'10000',month:'2026-12'}));
 it('passes the correct rent answer',()=>{expect(run(out['fx-rent'],rent).passed).toBe(true)});
 it('passes the expense answer once source titles count as support (its mild "as recommended" wording is a known looseness)',()=>{expect(run(out['fx-expense-reference']).passed).toBe(true)});
 it('blocks the job answer that states ₹9,000 without citing the fact',()=>{failsAt(out['fx-job-unknown'],'source_support',job)});
 it('blocks the failure answer that presents guessed causes as sourced',()=>{expect(run(out['fx-failure'],failure).passed).toBe(false)});
 it('blocks the missed-instalment answer; its "no penalty" claim alone also fails without the bank-charges caveat',()=>{failsAt(out['fx-missed-instalment'],'source_support',missed);const o=out['fx-missed-instalment'];expect(checkClaimSupport({...o,points:[o.points[0]]},missed)).toMatch(/bank may apply its own charges/)});
 it('passes the v3 salary answer once plain process words are allowed (re-reviewed: correct)',()=>{expect(run(out['fx-salary-delay'],salary).passed).toBe(true)});
});

describe('hedged bank caveats',()=>{
 it('allows "your bank may apply its own charges; check with your bank" without a source, but not definite or numeric bank rules',()=>{
  expect(run(withPoint('Your bank may apply its own charges for a failed debit, so check your bank statement.',['A1'])).passed).toBe(true);
  expect(run(withPoint('Your bank will charge a fee after two failures, so check your statement.',['A1'])).passed).toBe(false);
  expect(run(withPoint('Your bank may charge ₹500, so check your statement.',['A1'])).passed).toBe(false);
 });
});

import realGroq32 from './__fixtures__/real-groq-v32-outputs.json';
describe('regression: real Groq gpt-oss-120b outputs (prompt v3.2, 2026-11-07)',()=>{
 const out=realGroq32.outputs as unknown as Record<string,ModelOutput>;
 const salary=ctx('My salary is delayed and my SIP is due soon. What should I check?',sc('salary',{salaryDate:'2026-12-01',delay:'7',debitDate:'2026-12-05'}));
 const job=ctx('I am changing jobs and will have a gap in income. What does this mean for my monthly picture?',sc('job',{oldSalary:'30000',gap:'30',debitDate:'2026-12-05'}));
 const failure=ctx('My SIP debit failed. What should I check?',sc('failure',{status:'failed',debitDate:'2026-12-05'}));
 const missed=ctx('What happens if I miss an SIP instalment?',null);const sip=ctx('What is an SIP?',null);const mandate=ctx('What is a mandate for an SIP?',null);
 const rent=ctx('My rent is going up. How does this change my monthly cash?',sc('rent',{old:'8000',new:'10000',month:'2026-12'}));
 it('passes the four answers reviewed as correct: expense, rent, job, mandate',()=>{for(const [id,c] of [['fx-expense-reference',ctx()],['fx-rent',rent],['fx-job-unknown',job],['fx-mandate',mandate]] as const){const r=run(out[id],c);expect(r.passed,`${id}: ${JSON.stringify(r.checks.find(x=>x.status==='failed'))}`).toBe(true)}});
 it('no longer misreads "verify the balance before the SIP date" as a timing claim; passes now that NACH (in a retrieved AMFI source) is allowed (re-reviewed: correct)',()=>{expect(run(out['fx-salary-delay'],salary).passed).toBe(true)});
 it('blocks the failure answer that guesses causes ("can be due to insufficient balance")',()=>{failsAt(out['fx-failure'],'uncertainty',failure)});
 it('blocks the SIP-basics answer that drifts into personal figures',()=>{failsAt(out['fx-sip-basics'],'source_support',sip)});
 it('passes the missed-instalment answer: AMFI wording ("return any unused cheques", fund-house "may stop") is not read as returns or certainty',()=>{expect(run(out['fx-missed-instalment'],missed).passed).toBe(true)});
});

import realWebllm from './__fixtures__/real-webllm-v3-outputs.json';
describe('regression: real on-device Qwen2.5-1.5B outputs (prompt v3.2, 2026-11-07)',()=>{
 const out=realWebllm.outputs as unknown as Record<string,ModelOutput>;
 const failure=ctx('My SIP debit failed. What should I check?',sc('failure',{status:'failed',debitDate:'2026-12-05'}));
 it('blocks the failure answer that invents "recorded as a failed transaction… negative entry" while citing only facts',()=>{const r=failsAt(out['fx-failure'],'source_support',failure);expect(!r.passed&&r.detail).toMatch(/goes beyond the facts it cites/)});
 it('still passes the correct expense answer',()=>{expect(run(out['fx-expense-reference']).passed).toBe(true)});
});

import realSalary from './__fixtures__/real-groq-salary-outputs.json';
describe('salary delay: real Groq outputs and date/timing handling (2026-11-07)',()=>{
 const salary=ctx('MY SALARY IS DELAYED what should i do',sc('salary',{salaryDate:'2026-12-01',delay:'7',debitDate:'2026-12-05'}));
 const outs=realSalary.outputs as unknown as Record<string,{raw:ModelOutput}>;
 // Engineering review: q1-1, q1-2, q2-2, q3-1 are correct; q2-1 and q3-2 say "no penalty" without the bank-charges caveat.
 it.each(['q1-1','q1-2','q2-2','q3-1'])('passes the reviewed-correct real answer %s',id=>{const r=run(outs[id].raw,salary);expect(r.passed,JSON.stringify(!r.passed&&r.detail)).toBe(true)});
 it.each(['q2-1','q3-2'])('blocks %s: "no penalty" without the bank-charges caveat',id=>{const r=run(outs[id].raw,salary);expect(r.passed).toBe(false);expect(!r.passed&&r.detail).toMatch(/bank may apply its own charges/)});
 it('still blocks real certainty claims but not negated ones',()=>{failsAt({...good,uncertainty:'Your SIP will definitely go through this month, so it may be fine.'},'uncertainty');expect(run({...good,uncertainty:'We cannot know whether the SIP debit will succeed without your balance.'}).passed).toBe(true)});
 it('accepts human-written dates that match LifeFlow dates, and rejects ones that do not',()=>{
  expect(run({...good,points:[{text:'Your salary is now expected on 8 December 2026, after the SIP date of Dec 5.',supports:['expected_salary_arrival','sip_debit_date']}]},salary).passed).toBe(true);
  failsAt({...good,points:[{text:'Your salary is now expected on 9 December 2026.',supports:['expected_salary_arrival']}]},'numbers',salary);
  failsAt({...good,points:[{text:'Your SIP is due on the 12th of December.',supports:['sip_debit_date']}]},'numbers',salary);
 });
 it('reads timing direction correctly',()=>{
  expect(run({...good,points:[{text:'The SIP is due before the delayed salary arrives.',supports:['timing_statement']}]},salary).passed).toBe(true);
  failsAt({...good,points:[{text:'Your salary arrives before the SIP debit date.',supports:['timing_statement']}]},'numbers',salary);
  failsAt({...good,points:[{text:'Your salary will come one day earlier than the debit.',supports:['timing_statement']}]},'numbers',salary);
 });
 it('allows numbers repeated from a cited LifeFlow sentence but not other numbers',()=>{
  expect(run({...good,points:[{text:'The delayed salary is expected 3 days after the SIP debit date.',supports:['timing_statement']}]},salary).passed).toBe(true);
  failsAt({...good,points:[{text:'The delayed salary is expected 4 days after the SIP debit date.',supports:['timing_statement']}]},'numbers',salary);
 });
});

import realSalary2 from './__fixtures__/real-groq-salary-outputs-2.json';
describe('salary delay: second batch of real Groq outputs (reviewed correct)',()=>{
 const salary=ctx('MY SALARY IS DELAYED what should i do',sc('salary',{salaryDate:'2026-12-01',delay:'7',debitDate:'2026-12-05'}));
 const outs=realSalary2.outputs as unknown as Record<string,{raw:ModelOutput}>;
 // q1-1 cites the bank-charges caveat; q1-5/q1-6 say "without a penalty" with only "bank-specific charges" in the uncertainty.
 it.each(Object.keys(outs))('%s passes',id=>{const r=run(outs[id].raw,salary);expect(r.passed,JSON.stringify(!r.passed&&r.detail)).toBe(true)});
 it('still treats "shift your SIP to another fund" as a directive',()=>{expect(checkInvestmentSafety({...good,next_steps:['Shift your SIP to another fund.']})).toMatch(/directs/)});
});

import batch5 from './__fixtures__/real-groq-batch5-outputs.json';
describe('real Groq batch 5 (reviewed)',()=>{
 const out=batch5.outputs as unknown as Record<string,ModelOutput>;
 const salary=ctx('My salary is delayed and my SIP is due soon. What should I check?',sc('salary',{salaryDate:'2026-12-01',delay:'7',debitDate:'2026-12-05'}));
 const rent=ctx('My rent is going up. How does this change my monthly cash?',sc('rent',{old:'8000',new:'10000',month:'2026-12'}));
 it('passes the salary answer with "your bank could apply its own charges" (a hedge)',()=>{const r=run(out['fx-salary-delay'],salary);expect(r.passed,JSON.stringify(!r.passed&&r.detail)).toBe(true)});
 it('passes the mandate answer that says "check with your bank how NACH debits are set up"',()=>{const r=run(out['fx-mandate'],ctx('What is a mandate for an SIP?',null));expect(r.passed,JSON.stringify(!r.passed&&r.detail)).toBe(true)});
 it('blocks the rent answer that prints assumption ids "(A1, A2, A3)" in the text',()=>{failsAt(out['fx-rent'],'numbers',rent)});
 it('blocks the SIP-basics answer that suggests "how much you could allocate to an SIP"',()=>{failsAt(out['fx-sip-basics'],'investment_safety',ctx('What is an SIP?',null))});
 it('still blocks NACH rule claims',()=>{expect(checkInvestmentSafety({...good,uncertainty:'NACH retries the debit after three days, which may vary.'},'NACH (National Automated Clearing House)')).toMatch(/payment-system rules/)});
});
