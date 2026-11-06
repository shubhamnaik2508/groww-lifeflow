import {describe,it,expect,vi} from 'vitest';
import {offlineCompanion} from './offline-companion';
import {calculateScenario,Profile,Scenario} from './calc';
const profile:Profile={salary:30000,expenses:18000,sip:3000,sipDate:'2026-12-05'};
const inputs={amount:'5000',category:'Health',frequency:'one-time'};
const scenario:Scenario={...calculateScenario('expense',inputs,profile),id:'example',createdAt:'2026-11-06T00:00:00Z',inputs,profile};
describe('offline simulation',()=>{
 it('gives the actual before-and-after values without contacting an AI service',()=>{const fetch=vi.spyOn(globalThis,'fetch');const result=offlineCompanion('How does this expense affect my cash?',profile,scenario);expect(result.response_kind).toBe('simulation');expect(result.known_facts.join(' ')).toContain('9,000');expect(result.known_facts.join(' ')).toContain('4,000');expect(fetch).not.toHaveBeenCalled();fetch.mockRestore()});
 it('does not claim delayed salary causes debit failure',()=>{const result=offlineCompanion('My salary is delayed; what should I check?',profile,null);expect(result.explanation).toContain('does not by itself');expect(result.missing_information.length).toBeGreaterThan(0)});
 it('does not confuse calculate with a late salary',()=>{const result=offlineCompanion('Calculate my expense impact',profile,scenario);expect(result.summary).toContain('cash-flow')});
 it.each(['Which mutual fund should I buy?','Should I stop my SIP?','Which fund should I switch to?'])('refuses investment advice: %s',q=>{const result=offlineCompanion(q,profile,scenario);expect(result.requires_abstention).toBe(true);expect(result.summary).toContain('cannot recommend')});
 it('abstains on unsupported bank-specific rules',()=>{const result=offlineCompanion('What penalty does my bank charge?',profile,null);expect(result.requires_abstention).toBe(true)});
 it('links an official source only for SIP basics',()=>{const result=offlineCompanion('What is an SIP?',profile,null);expect(result.sources[0].organisation).toBe('SEBI')});
 it('asks for clarification on unrelated questions',()=>{const result=offlineCompanion('What is the weather?',profile,scenario);expect(result.requires_abstention).toBe(true)});
 it('does not echo a sensitive question',()=>{const result=offlineCompanion('My account number is 123456789012',profile,null);expect(result.requires_abstention).toBe(true);expect(JSON.stringify(result)).not.toContain('123456789012')});
});
