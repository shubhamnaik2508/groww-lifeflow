import {isIP} from 'node:net';

export class RequestTooLarge extends Error {}

/** Vercel supplies this header at its edge. Other deployments share one safe bucket. */
export function clientIdentity(headers:Headers):string {
 if(process.env.VERCEL!=='1')return 'local';
 const value=headers.get('x-vercel-forwarded-for')?.trim()||'';
 return isIP(value)?value:'unknown';
}

/** Enforce a byte limit while reading, even without a trustworthy Content-Length. */
export async function readBoundedBody(request:Request,maxBytes:number):Promise<string> {
 if(!request.body)return '';
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>maxBytes){void reader.cancel().catch(()=>{});throw new RequestTooLarge();}chunks.push(value);}}
 finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
