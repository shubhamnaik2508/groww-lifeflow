import {describe,expect,it} from 'vitest';
import {calculateScenario,cashFlow,inputWarnings,type Profile} from './calc';

// Life-to-SIP Scenario Simulator regression suite (deterministic; no AI involved).
const p:Profile={salary:30000,expenses:18000,sip:3000,sipDate:'2026-12-05'};
const run=(type:string,vals:Record<string,string>,profile:Profile=p)=>calculateScenario(type,vals,profile);

describe('mandatory reference calculation',()=>{
 it('₹30,000 − ₹18,000 − ₹3,000 = ₹9,000; with a ₹5,000 one-time expense = ₹4,000; reduction ₹5,000',()=>{
  const r=run('expense',{amount:'5000',category:'Health',frequency:'one-time'});
  expect(r.before).toBe(9000);expect(r.after).toBe(4000);expect(r.change).toBe(-5000);expect(r.before-r.after).toBe(5000);
  expect(r.title).toBe('Unexpected expense');expect(r.detail).toMatch(/one-time expense\. This affects the illustrated month only/);
 });
});

describe('1. unexpected expense',()=>{
 it('labels recurring costs as monthly and one-time costs as this month only',()=>{
  const once=run('expense',{amount:'2000',category:'Repair',frequency:'one-time'});const rec=run('expense',{amount:'2000',category:'Gym',frequency:'recurring'});
  expect(once.after).toBe(7000);expect(rec.after).toBe(7000);
  expect(once.detail).toMatch(/one-time/);expect(rec.detail).toMatch(/recurring monthly.*additional monthly expense/);
 });
 it('rejects missing, zero, negative and non-numeric amounts and a missing category',()=>{
  expect(()=>run('expense',{amount:'',category:'Health'})).toThrow(/required/);
  expect(()=>run('expense',{amount:'0',category:'Health'})).toThrow(/above ₹0/);
  expect(()=>run('expense',{amount:'-100',category:'Health'})).toThrow(/non-negative/);
  expect(()=>run('expense',{amount:'abc',category:'Health'})).toThrow(/non-negative/);
  expect(()=>run('expense',{amount:'500',category:'  '})).toThrow(/category/);
 });
 it('allows an expense larger than the remaining cash and shows a negative estimate',()=>{expect(run('expense',{amount:'12000',category:'Hospital',frequency:'one-time'}).after).toBe(-3000)});
 it('rejects amounts above ₹10 crore',()=>{expect(()=>run('expense',{amount:'100000001',category:'X'})).toThrow()});
 it('handles decimals without floating-point noise',()=>{expect(run('expense',{amount:'0.1',category:'X'},{...p,salary:0.3,expenses:0,sip:0}).after).toBe(0.2)});
});

describe('2. salary delay',()=>{
 it('changes timing, not the monthly amount, and never predicts a failed debit',()=>{
  const r=run('salary',{salaryDate:'2026-12-01',delay:'7',debitDate:'2026-12-05'});
  expect(r.after).toBe(r.before);expect(r.change).toBe(0);
  expect(r.detail).toMatch(/Expected salary: 2026-12-08, 3 day\(s\) after the SIP date/);expect(r.detail).toMatch(/does not establish a failed debit/);
 });
 it('reports when the delayed salary still arrives before or on the SIP date',()=>{
  expect(run('salary',{salaryDate:'2026-11-25',delay:'3',debitDate:'2026-12-05'}).detail).toMatch(/7 day\(s\) before the SIP date/);
  expect(run('salary',{salaryDate:'2026-12-01',delay:'4',debitDate:'2026-12-05'}).detail).toMatch(/0 day\(s\) on the SIP date/);
 });
 it('crosses month and year boundaries correctly',()=>{expect(run('salary',{salaryDate:'2026-12-30',delay:'5',debitDate:'2027-01-05'}).detail).toMatch(/2027-01-04, 1 day\(s\) before/)});
 it('uses the profile SIP date when the debit date is left blank',()=>{expect(run('salary',{salaryDate:'2026-12-01',delay:'7'}).detail).toMatch(/3 day\(s\) after/)});
 it('rejects fractional, negative or excessive delays and invalid dates',()=>{
  expect(()=>run('salary',{salaryDate:'2026-12-01',delay:'2.5'})).toThrow(/whole-number/);
  expect(()=>run('salary',{salaryDate:'2026-12-01',delay:'-1'})).toThrow(/non-negative/);
  expect(()=>run('salary',{salaryDate:'2026-12-01',delay:'400'})).toThrow(/365/);
  expect(()=>run('salary',{salaryDate:'2026-02-30',delay:'3'})).toThrow(/salary date/);
  expect(()=>run('salary',{salaryDate:'2026-12-01',delay:'3'},{...p,sipDate:''})).toThrow(/SIP date/);
 });
 it('validates an optional balance only when supplied',()=>{expect(run('salary',{salaryDate:'2026-12-01',delay:'7',balance:'2500'}).detail).toMatch(/₹2,500/);expect(()=>run('salary',{salaryDate:'2026-12-01',delay:'7',balance:'-5'})).toThrow()});
});

describe('3. rent increase',()=>{
 it('applies the monthly rent change once, assuming the old rent is already in expenses',()=>{
  const r=run('rent',{old:'8000',new:'10000',month:'2026-12'});expect(r.after).toBe(7000);expect(r.change).toBe(-2000);expect(r.detail).toMatch(/₹2,000.*per month from 2026-12/);
 });
 it('handles a rent decrease and decimal rents exactly',()=>{expect(run('rent',{old:'8000',new:'7500',month:'2026-12'}).after).toBe(9500);expect(run('rent',{old:'8000.1',new:'8000.4',month:'2026-12'}).after).toBe(8999.7)});
 it('rejects a previous rent larger than recurring expenses, a missing month and invalid amounts',()=>{
  expect(()=>run('rent',{old:'19000',new:'20000',month:'2026-12'})).toThrow(/cannot exceed/);
  expect(()=>run('rent',{old:'8000',new:'10000',month:''})).toThrow(/month/);
  expect(()=>run('rent',{old:'8000',new:'10000',month:'2026-13'})).toThrow(/month/);
  expect(()=>run('rent',{old:'8000',new:'',month:'2026-12'})).toThrow(/required/);
 });
});

describe('4. job transition or income interruption',()=>{
 it('keeps an unknown new salary unknown and names the commitments that continue during the gap',()=>{
  const r=run('job',{oldSalary:'30000',gap:'30'});expect(r.estimateKnown).toBe(false);expect(r.after).toBe(r.before);
  expect(r.detail).toMatch(/new salary is unknown/);expect(r.detail).toMatch(/recurring expenses and SIP \(₹21,000\.00 a month\) continue/);
 });
 it('illustrates a known new salary against the same commitments',()=>{const r=run('job',{oldSalary:'30000',newSalary:'35000',gap:'15'});expect(r.estimateKnown).toBe(true);expect(r.after).toBe(14000);expect(r.change).toBe(5000);expect(r.detail).toMatch(/change from previous salary is ₹5,000/)});
 it('omits the gap sentence when there is no gap and rejects invalid gaps',()=>{
  expect(run('job',{oldSalary:'30000',newSalary:'30000',gap:'0'}).detail).not.toMatch(/During the gap/);
  expect(()=>run('job',{oldSalary:'30000',gap:'1.5'})).toThrow(/whole-number/);expect(()=>run('job',{oldSalary:'30000',gap:'4000'})).toThrow(/whole-number/);
 });
});

describe('5. SIP debit failure',()=>{
 it('records the reported status without inventing a reason or changing the monthly estimate',()=>{
  const r=run('failure',{status:'failed',mandate:'active'});expect(r.after).toBe(r.before);
  expect(r.detail).toMatch(/Reported status: failed; debit date: 2026-12-05/);expect(r.detail).toMatch(/Bank or mandate status: active/);expect(r.detail).toMatch(/reason and applicable rules are unknown/);
 });
 it('requires a status and truncates very long text',()=>{expect(()=>run('failure',{status:' '})).toThrow(/status/);expect(run('failure',{status:'x'.repeat(500)}).detail.length).toBeLessThan(400)});
});

describe('profile validation and warnings',()=>{
 it('allows zero values and a negative estimate',()=>{expect(cashFlow(0,0,0)).toBe(0);expect(cashFlow(10000,9000,3000)).toBe(-2000)});
 it('rejects missing (NaN), negative and infinite values',()=>{for(const bad of [NaN,-1,Infinity])expect(()=>cashFlow(bad,0,0)).toThrow()});
 it('warns on unusual but valid inputs without changing arithmetic',()=>{expect(inputWarnings({...p,salary:20000})).toEqual(['Recurring expenses and SIP together exceed the entered take-home salary.']);expect(inputWarnings({...p,salary:0})).toHaveLength(1)});
 it('rejects an unsupported scenario type',()=>{expect(()=>run('lottery',{})).toThrow(/supported scenario/)});
});

describe('scenario comparison arithmetic',()=>{
 it('compares results that each use their own baseline',()=>{
  const a=run('expense',{amount:'5000',category:'Health'}),b=run('rent',{old:'8000',new:'10000',month:'2026-12'});
  expect(a.after-b.after).toBe(-3000);expect([a.change,b.change]).toEqual([-5000,-2000]);
 });
});
