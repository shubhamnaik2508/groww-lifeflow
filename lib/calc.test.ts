import {describe,it,expect} from 'vitest';
import {cashFlow,daysBetween,calculateScenario} from './calc';
describe('cash flow',()=>{it('separates commitments and one-time expenses',()=>expect(cashFlow(40000,18000,5000,3000)).toBe(14000));it('allows negative cash',()=>expect(cashFlow(1000,2000,500)).toBe(-1500));it('rejects missing and invalid amounts',()=>{expect(()=>cashFlow(NaN,0,0)).toThrow();expect(()=>cashFlow(1,-1,0)).toThrow()});it('does not duplicate expenses',()=>expect(cashFlow(10000,2500,1000)).toBe(6500));});
it('matches the mentor reference cash-flow example',()=>{expect(cashFlow(30000,18000,3000)).toBe(9000);expect(cashFlow(30000,18000,3000,5000)).toBe(4000);expect(cashFlow(30000,18000,3000)-cashFlow(30000,18000,3000,5000)).toBe(5000)});
it('handles zero and decimal values and rejects enormous or missing values',()=>{expect(cashFlow(0,0,0)).toBe(0);expect(cashFlow(1000.5,100.25,0)).toBe(900.25);expect(()=>cashFlow(100000001,0,0)).toThrow();expect(()=>cashFlow(undefined as unknown as number,0,0)).toThrow()});
describe('dates',()=>{it('calculates across months',()=>expect(daysBetween('2026-01-30','2026-02-04')).toBe(5));it('rejects invalid dates',()=>expect(daysBetween('2026-02-30','2026-03-01')).toBeNull())});
const profile={salary:40000,expenses:20000,sip:5000,sipDate:'2026-03-05'};
describe('life scenarios',()=>{
 it('calculates one-time and recurring costs without double counting',()=>{for(const frequency of ['one-time','recurring'])expect(calculateScenario('expense',{amount:'2000',category:'Health',frequency},profile).after).toBe(13000)});
 it('uses the rent delta and rejects rent not included in expenses',()=>{expect(calculateScenario('rent',{old:'8000',new:'10000',month:'2026-04'},profile).after).toBe(13000);expect(()=>calculateScenario('rent',{old:'30000',new:'31000',month:'2026-04'},profile)).toThrow()});
 it('reports salary timing without asserting failure',()=>{const s=calculateScenario('salary',{salaryDate:'2026-03-01',delay:'5'},profile);expect(s.detail).toContain('1 day(s) after');expect(s.detail).toContain('does not establish');expect(s.after).toBe(15000)});
 it('does not treat an unknown future salary as an estimate',()=>expect(calculateScenario('job',{oldSalary:'40000',gap:'30'},profile).estimateKnown).toBe(false));
 it('calculates a known new salary',()=>expect(calculateScenario('job',{oldSalary:'40000',newSalary:'35000',gap:'10'},profile).after).toBe(10000));
 it('does not infer the reason for failure',()=>expect(calculateScenario('failure',{status:'failed'},profile).detail).toContain('reason and applicable rules are unknown'));
 it.each([['expense',{}],['salary',{salaryDate:'2026-03-01',delay:'-1'}],['rent',{old:'8000',new:'9000'}],['job',{oldSalary:'40000',gap:'-1'}],['failure',{}]])('rejects incomplete or invalid %s input',(type,inputs)=>{expect(()=>calculateScenario(type,inputs,profile)).toThrow()});
 it('handles leap-day salary timing',()=>{const s=calculateScenario('salary',{salaryDate:'2028-02-28',delay:'2',debitDate:'2028-03-01'},profile);expect(s.detail).toContain('0 day(s) on')});
});
