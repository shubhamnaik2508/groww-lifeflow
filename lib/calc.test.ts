import {describe,it,expect} from 'vitest';
import {cashFlow,daysBetween} from './calc';
describe('cash flow',()=>{it('separates commitments and one-time expenses',()=>expect(cashFlow(40000,18000,5000,3000)).toBe(14000));it('allows negative cash',()=>expect(cashFlow(1000,2000,500)).toBe(-1500));it('rejects missing and invalid amounts',()=>{expect(()=>cashFlow(NaN,0,0)).toThrow();expect(()=>cashFlow(1,-1,0)).toThrow()});it('does not duplicate expenses',()=>expect(cashFlow(10000,2500,1000)).toBe(6500));});
describe('dates',()=>{it('calculates across months',()=>expect(daysBetween('2026-01-30','2026-02-04')).toBe(5));it('rejects invalid dates',()=>expect(daysBetween('2026-02-30','2026-03-01')).toBeNull())});
