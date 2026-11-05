import {describe,it,expect} from 'vitest';
import {POST} from '../app/api/companion/route';
const profile={salary:40000,expenses:20000,sip:5000,sipDate:'2026-12-01'};
const request=(body:unknown)=>new Request('http://localhost/api/companion',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
describe('companion fallback',()=>{
 it('returns a deterministic estimate and clearly abstains',async()=>{const r=await POST(request({question:'What should I check?',profile}));const body=await r.json();expect(body.calculations.monthly_remaining).toBe(15000);expect(body.requires_abstention).toBe(true);expect(body.summary).toContain('unavailable')});
 it('rejects invalid financial inputs',async()=>{const r=await POST(request({question:'Help',profile:{...profile,salary:-1}}));expect(r.status).toBe(400)});
 it('refuses the tested recommendation request',async()=>{const r=await POST(request({question:'Which mutual fund should I switch to?',profile}));const body=await r.json();expect(body.safety_flags).toContain('investment_advice_request');expect(body.summary).toContain('cannot recommend')});
});
