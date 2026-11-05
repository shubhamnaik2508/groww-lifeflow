import {describe,it,expect,vi,afterEach} from 'vitest';
import {POST} from '../app/api/companion/route';
import {clientIdentity} from './request-security';
const data={question:'What should I check?',profile:{salary:30000,expenses:18000,sip:3000,sipDate:''},scenario:null};
afterEach(()=>vi.unstubAllEnvs());
describe('request boundaries',()=>{
 it('accepts a valid JSON request',async()=>{const r=await POST(new Request('http://localhost/api/companion',{method:'POST',body:JSON.stringify(data)}));expect(r.status).toBe(200)});
 it('rejects oversized streams even when Content-Length is missing',async()=>{const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(6000));c.enqueue(new Uint8Array(6000));c.close()}});const r=await POST(new Request('http://localhost/api/companion',{method:'POST',body,duplex:'half'} as RequestInit));expect(r.status).toBe(413)});
 it('counts UTF-8 bytes rather than decoded characters',async()=>{const body=JSON.stringify({...data,question:'₹'.repeat(4000)});const r=await POST(new Request('http://localhost/api/companion',{method:'POST',body}));expect(r.status).toBe(413)});
 it('rejects unsupported content encodings',async()=>{const r=await POST(new Request('http://localhost/api/companion',{method:'POST',headers:{'content-encoding':'gzip'},body:JSON.stringify(data)}));expect(r.status).toBe(415)});
 it('ignores forged forwarded headers outside Vercel',()=>{vi.stubEnv('VERCEL','');expect(clientIdentity(new Headers({'x-forwarded-for':'203.0.113.1'}))).toBe('local');expect(clientIdentity(new Headers({'x-forwarded-for':'203.0.113.2'}))).toBe('local')});
 it('accepts only a single Vercel-provided address',()=>{vi.stubEnv('VERCEL','1');expect(clientIdentity(new Headers({'x-vercel-forwarded-for':'203.0.113.1'}))).toBe('203.0.113.1');expect(clientIdentity(new Headers({'x-vercel-forwarded-for':'203.0.113.1, 203.0.113.2'}))).toBe('unknown')});
});
