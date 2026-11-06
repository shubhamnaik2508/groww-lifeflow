import {describe,expect,it} from 'vitest';
import {DEMO_INPUTS,exploreSip,validateInputs} from './sip-explorer';

const ok=(r:ReturnType<typeof exploreSip>)=>{if(!r.ok)throw Error(r.errors.join('; '));return r};
const opt=(r:ReturnType<typeof ok>,id:string)=>r.options.find(o=>o.id===id)!;

describe('SIP Decision Explorer arithmetic',()=>{
 it('matches the brief reference: ₹9,000 now, ₹12,000 when paused, difference ₹3,000',()=>{
  const r=ok(exploreSip({salary:30000,essentials:18000,sip:3000}));
  expect(r.baseline.remaining).toBe(9000);
  expect(opt(r,'continue')).toMatchObject({contribution:3000,remaining:9000,difference:0});
  expect(opt(r,'pause')).toMatchObject({contribution:0,remaining:12000,difference:3000,notContributed:9000});
  expect(opt(r,'stop')).toMatchObject({contribution:0,remaining:12000,difference:3000,notContributed:null});
 });
 it('models a reduced SIP and an additional expense',()=>{
  const r=ok(exploreSip({...DEMO_INPUTS,reducedSip:1000,extraExpense:2500}));
  expect(opt(r,'continue').remaining).toBe(6500);
  expect(opt(r,'reduce')).toMatchObject({contribution:1000,remaining:8500,difference:2000,notContributed:2000});
 });
 it('handles decimals to the paisa',()=>{const r=ok(exploreSip({salary:30000.1,essentials:18000.2,sip:3000.05}));expect(r.baseline.remaining).toBe(8999.85)});
 it('reports negative remaining cash and how long savings would cover the shortfall',()=>{
  const r=ok(exploreSip({salary:20000,essentials:19000,sip:3000,emergency:10000}));
  expect(opt(r,'continue').remaining).toBe(-2000);expect(r.emergency.shortfallMonthsCovered).toBe(5);
  expect(r.emergency.monthsOfEssentials).toBeCloseTo(0.53,2);
  expect(opt(r,'continue').tradeOffs.join(' ')).toContain('exceed your income by ₹2,000');
 });
 it('notes expenses above income before any SIP',()=>{const r=ok(exploreSip({salary:10000,essentials:12000,sip:0}));expect(r.notes.join(' ')).toContain('exceed income by ₹2,000');expect(r.notes.join(' ')).toContain('current SIP is ₹0')});
 it('treats zero salary and zero expenses as valid',()=>{const r=ok(exploreSip({salary:0,essentials:0,sip:0}));expect(r.baseline.remaining).toBe(0);expect(r.emergency.monthsOfEssentials).toBeNull()});
 it('defaults missing optional inputs to zero and pause to 3 months',()=>{const r=ok(exploreSip({salary:30000,essentials:18000,sip:3000}));expect(r.inputs).toMatchObject({emergency:0,reducedSip:0,extraExpense:0,pauseMonths:3})});
});

describe('SIP Decision Explorer validation',()=>{
 it.each([[{salary:-1,essentials:0,sip:0}],[{salary:'abc',essentials:0,sip:0}],[{salary:1e9,essentials:0,sip:0}],[{salary:'',essentials:0,sip:0}],[{salary:NaN,essentials:0,sip:0}],[{essentials:0,sip:0}]])('rejects invalid required input %j',raw=>expect(validateInputs(raw).ok).toBe(false));
 it('rejects a reduced SIP above the current SIP',()=>{const r=validateInputs({salary:30000,essentials:18000,sip:3000,reducedSip:4000});expect(r).toEqual({ok:false,errors:['Proposed reduced SIP cannot be more than the current monthly SIP.']})});
 it.each([0,25,1.5,'x'])('rejects pause length %s',pm=>expect(validateInputs({salary:1,essentials:0,sip:0,pauseMonths:pm}).ok).toBe(false));
});

describe('neutral language',()=>{
 const text=JSON.stringify(ok(exploreSip(DEMO_INPUTS)));
 it('never recommends or ranks an option',()=>{for(const w of [/recommend/i,/safest/i,/\bbest\b/i,/you should/i,/\bbetter\b/i,/guarantee/i])expect(text).not.toMatch(w)});
 it('says pausing and stopping are not redemptions',()=>{expect(text).toContain('pausing is not a redemption');expect(text).toContain('Stopping a SIP is not a redemption')});
});
