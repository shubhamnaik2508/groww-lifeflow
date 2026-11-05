import {NextResponse} from 'next/server';
import {z} from 'zod';
import {answerCompanion} from '../../../lib/companion';
import {rateLimit} from '../../../lib/rate-limit';
import {clientIdentity,readBoundedBody,RequestTooLarge} from '../../../lib/request-security';
const profile=z.object({salary:z.number().finite().nonnegative().max(1e8),expenses:z.number().finite().nonnegative().max(1e8),sip:z.number().finite().nonnegative().max(1e8),sipDate:z.string().max(10)}).strict();
const input=z.object({question:z.string().trim().min(1).max(1000),profile,scenario:z.object({type:z.enum(['expense','salary','rent','job','failure']),inputs:z.record(z.string().max(32),z.string().max(150)),profile}).nullable().optional()}).strict();
export async function POST(req:Request){
 const size=Number(req.headers.get('content-length')||0);if(size>10000)return NextResponse.json({summary:'Request too large.',checks:[]},{status:413});
 const encoding=req.headers.get('content-encoding');if(encoding&&encoding.toLowerCase()!=='identity')return NextResponse.json({summary:'Unsupported content encoding.',checks:[]},{status:415});
 const limited=await rateLimit(clientIdentity(req.headers));if(limited!=='allow')return NextResponse.json({summary:limited==='limit'?'Please try again in a minute.':'The companion is temporarily unavailable. Your scenario calculations still work.',checks:[limited==='limit'?'Request limit applied':'Request protection unavailable']},{status:limited==='limit'?429:503,headers:{'Cache-Control':'no-store'}});
 let payload;try{const raw=await readBoundedBody(req,10000);payload=input.parse(JSON.parse(raw))}catch(error){if(error instanceof RequestTooLarge)return NextResponse.json({summary:'Request too large.',checks:[]},{status:413});return NextResponse.json({summary:'Please check your question and financial inputs.',checks:['Input validation ran']},{status:400})}
 return NextResponse.json(await answerCompanion(payload),{headers:{'Cache-Control':'no-store'}});
}
