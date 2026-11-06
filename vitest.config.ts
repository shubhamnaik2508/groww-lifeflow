import {resolve} from 'node:path';
import {defineConfig} from 'vitest/config';

export default defineConfig({resolve:{alias:{'server-only':resolve(__dirname,'test/server-only-stub.ts')}}});
