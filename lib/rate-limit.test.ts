import {afterEach,describe,expect,it,vi} from 'vitest';
import {rateLimit} from './rate-limit';
afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});
describe('shared rate limit',()=>{
 it('fails closed on Vercel when configuration is absent',async()=>{vi.stubEnv('VERCEL','1');vi.stubEnv('UPSTASH_REDIS_REST_URL','');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','');vi.stubEnv('LIFEFLOW_RATE_LIMIT_SALT','');expect(await rateLimit('192.0.2.1')).toBe('unavailable')});
 it('uses a keyed IP digest and enforces the shared count',async()=>{vi.stubEnv('VERCEL','1');vi.stubEnv('UPSTASH_REDIS_REST_URL','https://example.upstash.io');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','example');vi.stubEnv('LIFEFLOW_RATE_LIMIT_SALT','a'.repeat(32));const mock=vi.fn().mockResolvedValue({ok:true,json:async()=>({result:21})});vi.stubGlobal('fetch',mock);expect(await rateLimit('192.0.2.1')).toBe('limit');const command=JSON.parse(mock.mock.calls[0][1].body);expect(command[0]).toBe('EVAL');expect(JSON.stringify(command)).not.toContain('192.0.2.1')});
 it('fails closed if the shared store fails',async()=>{vi.stubEnv('VERCEL','1');vi.stubEnv('UPSTASH_REDIS_REST_URL','https://example.upstash.io');vi.stubEnv('UPSTASH_REDIS_REST_TOKEN','example');vi.stubEnv('LIFEFLOW_RATE_LIMIT_SALT','a'.repeat(32));vi.stubGlobal('fetch',vi.fn().mockRejectedValue(Error('offline')));expect(await rateLimit('192.0.2.1')).toBe('unavailable')});
});
