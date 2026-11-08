import {describe,expect,it} from 'vitest';
import {toMs} from '../app/motion';

// The production CSS minifier rewrites "150ms" as ".15s"; motion timers must read both.
describe('toMs',()=>{
 it('reads milliseconds',()=>{expect(toMs('150ms',0)).toBe(150);expect(toMs(' 80ms ',0)).toBe(80)});
 it('reads seconds as written by the minifier',()=>{expect(toMs('.15s',0)).toBe(150);expect(toMs('0.4s',0)).toBe(400)});
 it('falls back when the value is missing',()=>{expect(toMs('',150)).toBe(150)});
});
