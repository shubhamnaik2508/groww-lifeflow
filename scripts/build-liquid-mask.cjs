// Builds public/liquid-asterisk.png: the bevelled depth map the liquid-metal shader reads for LifeFlow's ✳ mark.
// Same method as liquid-logo's parseLogoImage (shape mask, then a Poisson solve with u = 0 on the edge, normalised and
// remapped), precomputed once so the browser does not run 300 iterations on the main thread.
// Adapted from paper-design/liquid-logo (PolyForm Shield 1.0.0, see third_party/liquid-logo/LICENSE).
// Usage: node scripts/build-liquid-mask.cjs
const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const N=360,C=0.01,ITER=300,ALPHA=2;
const cx=N/2,cy=N/2,R=N*0.36,HALF=N*0.085; // eight spokes like ✳: four bars through the centre
const angles=[0,45,90,135].map(a=>a*Math.PI/180);
function inShape(x,y){
 const px=x+0.5-cx,py=y+0.5-cy;
 for(const a of angles){const ux=Math.cos(a),uy=Math.sin(a);const t=Math.max(-R,Math.min(R,px*ux+py*uy));const dx=px-t*ux,dy=py-t*uy;if(dx*dx+dy*dy<=HALF*HALF)return true}
 return false;
}
const mask=new Uint8Array(N*N);for(let y=0;y<N;y++)for(let x=0;x<N;x++)mask[y*N+x]=inShape(x,y)?1:0;
const inside=(x,y)=>x>=0&&x<N&&y>=0&&y<N&&mask[y*N+x]===1;
const boundary=new Uint8Array(N*N);
for(let y=0;y<N;y++)for(let x=0;x<N;x++){if(!mask[y*N+x])continue;outer:for(let ny=y-1;ny<=y+1;ny++)for(let nx=x-1;nx<=x+1;nx++)if(!inside(nx,ny)){boundary[y*N+x]=1;break outer}}
let u=new Float32Array(N*N),next=new Float32Array(N*N);
const get=(x,y,a)=>x<0||x>=N||y<0||y>=N||!mask[y*N+x]?0:a[y*N+x];
for(let it=0;it<ITER;it++){
 for(let y=0;y<N;y++)for(let x=0;x<N;x++){const i=y*N+x;if(!mask[i]||boundary[i]){next[i]=0;continue}next[i]=(C+get(x+1,y,u)+get(x-1,y,u)+get(x,y+1,u)+get(x,y-1,u))/4}
 [u,next]=[next,u];
}
let max=0;for(const v of u)if(v>max)max=v;
const gray=new Uint8Array(N*N);for(let i=0;i<N*N;i++)gray[i]=mask[i]?Math.round(255*(1-Math.pow(u[i]/max,ALPHA))):255;
// Minimal 8-bit greyscale PNG encoder.
const crcTable=new Uint32Array(256).map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
const crc=b=>{let c=0xffffffff;for(const x of b)c=crcTable[(c^x)&255]^(c>>>8);return (c^0xffffffff)>>>0};
const chunk=(type,data)=>{const len=Buffer.alloc(4);len.writeUInt32BE(data.length);const td=Buffer.concat([Buffer.from(type),data]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([len,td,c])};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(N,0);ihdr.writeUInt32BE(N,4);ihdr[8]=8;ihdr[9]=0;ihdr[10]=0;ihdr[11]=0;ihdr[12]=0;
const raw=Buffer.alloc(N*(N+1));for(let y=0;y<N;y++){raw[y*(N+1)]=0;Buffer.from(gray.subarray(y*N,(y+1)*N)).copy(raw,y*(N+1)+1)}
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
const out=path.resolve(__dirname,'../public/liquid-asterisk.png');fs.writeFileSync(out,png);
console.log(`wrote ${path.relative(process.cwd(),out)} (${png.length} bytes, ${N}×${N})`);
