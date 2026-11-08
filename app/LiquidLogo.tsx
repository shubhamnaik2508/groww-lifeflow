'use client';
import {useEffect,useRef,useState} from 'react';
import './liquid-logo.css';

/**
 * Liquid-metal ✳ for the Home hero. Shader adapted from paper-design/liquid-logo (PolyForm Shield 1.0.0; licence in
 * third_party/liquid-logo/LICENSE). Changes for LifeFlow: theme-tinted metal (two colour uniforms instead of fixed
 * silver), a precomputed depth map (public/liquid-asterisk.png, scripts/build-liquid-mask.cjs) instead of a 300-pass
 * solve in the browser, rendering at the element's own size, pausing off-screen or in a hidden tab, one still frame
 * for reduced motion, and the plain ✳ glyph as the fallback when WebGL2 is unavailable.
 */
const VERT=`#version 300 es
precision mediump float;
in vec2 a_position;out vec2 vUv;
void main(){vUv=.5*(a_position+1.);gl_Position=vec4(a_position,0.,1.);}`;
const FRAG=`#version 300 es
precision mediump float;
in vec2 vUv;out vec4 fragColor;
uniform sampler2D u_image_texture;uniform float u_time;uniform float u_patternScale;uniform float u_refraction;uniform float u_edge;uniform float u_patternBlur;uniform float u_liquid;uniform vec3 u_light;uniform vec3 u_dark;
#define PI 3.14159265358979323846
vec3 mod289(vec3 x){return x-floor(x*(1./289.))*289.;}vec2 mod289(vec2 x){return x-floor(x*(1./289.))*289.;}vec3 permute(vec3 x){return mod289(((x*34.)+1.)*x);}
float snoise(vec2 v){const vec4 C=vec4(0.211324865405187,0.366025403784439,-0.577350269189626,0.024390243902439);vec2 i=floor(v+dot(v,C.yy));vec2 x0=v-i+dot(i,C.xx);vec2 i1=(x0.x>x0.y)?vec2(1.,0.):vec2(0.,1.);vec4 x12=x0.xyxy+C.xxzz;x12.xy-=i1;i=mod289(i);vec3 p=permute(permute(i.y+vec3(0.,i1.y,1.))+i.x+vec3(0.,i1.x,1.));vec3 m=max(0.5-vec3(dot(x0,x0),dot(x12.xy,x12.xy),dot(x12.zw,x12.zw)),0.);m=m*m;m=m*m;vec3 x=2.*fract(p*C.www)-1.;vec3 h=abs(x)-0.5;vec3 ox=floor(x+0.5);vec3 a0=x-ox;m*=1.79284291400159-0.85373472095314*(a0*a0+h*h);vec3 g;g.x=a0.x*x0.x+h.x*x0.y;g.yz=a0.yz*x12.xz+h.yz*x12.yw;return 130.*dot(m,g);}
vec2 rotate(vec2 uv,float th){return mat2(cos(th),sin(th),-sin(th),cos(th))*uv;}
float channel(float c1,float c2,float s,vec3 w,float extra,float b){float ch=c2;float blur=u_patternBlur+extra;ch=mix(ch,c1,smoothstep(.0,blur,s));float border=w[0];ch=mix(ch,c2,smoothstep(border-blur,border+blur,s));b=smoothstep(.2,.8,b);border=w[0]+.4*(1.-b)*w[1];ch=mix(ch,c1,smoothstep(border-blur,border+blur,s));border=w[0]+.5*(1.-b)*w[1];ch=mix(ch,c2,smoothstep(border-blur,border+blur,s));border=w[0]+w[1];ch=mix(ch,c1,smoothstep(border-blur,border+blur,s));float gt=(s-w[0]-w[1])/w[2];float gr=mix(c1,c2,smoothstep(0.,1.,gt));return mix(ch,gr,smoothstep(border-blur,border+blur,s));}
float frameAlpha(vec2 uv,float f){return smoothstep(0.,f,uv.x)*smoothstep(1.,1.-f,uv.x)*smoothstep(0.,f,uv.y)*smoothstep(1.,1.-f,uv.y);}
void main(){
 vec2 uv=vUv;uv.y=1.-uv.y;float diagonal=uv.x-uv.y;float t=.001*u_time;
 vec2 img_uv=vUv;img_uv.y=1.-img_uv.y;vec4 img=texture(u_image_texture,img_uv);
 vec3 color1=u_light;vec3 color2=u_dark+vec3(.0,.0,.06*smoothstep(.7,1.3,uv.x+uv.y));
 float edge=img.r;vec2 g_uv=uv-.5;float dist=length(g_uv+vec2(0.,.2*diagonal));g_uv=rotate(g_uv,(.25-.2*diagonal)*PI);
 float bulge=1.-pow(1.8*dist,1.2);bulge*=pow(uv.y,.3);
 float cw=u_patternScale;float t1=.12/cw*(1.-.4*bulge);float t2=.07/cw*(1.+.4*bulge);float wide=1.-t1-t2;
 float opacity=1.-smoothstep(.9-.5*u_edge,1.-.5*u_edge,edge);opacity*=frameAlpha(img_uv,.01);
 float noise=snoise(uv-t);edge+=(1.-edge)*u_liquid*noise;
 float refr=clamp(1.-bulge,0.,1.);float dir=g_uv.x+diagonal;
 dir-=2.*noise*diagonal*(smoothstep(0.,1.,edge)*smoothstep(1.,0.,edge));
 bulge*=clamp(pow(uv.y,.1),.3,1.);dir*=(.1+(1.1-edge)*bulge);dir*=smoothstep(1.,.7,edge);
 dir+=.18*(smoothstep(.1,.2,uv.y)*smoothstep(.4,.2,uv.y));dir+=.03*(smoothstep(.1,.2,1.-uv.y)*smoothstep(.4,.2,1.-uv.y));
 dir*=(.5+.5*pow(uv.y,2.));dir*=cw;dir-=t;
 float rr=refr+.03*bulge*noise;float rb=1.3*refr;
 rr+=5.*(smoothstep(-.1,.2,uv.y)*smoothstep(.5,.1,uv.y))*(smoothstep(.4,.6,bulge)*smoothstep(1.,.4,bulge));rr-=diagonal;
 rb+=(smoothstep(0.,.4,uv.y)*smoothstep(.8,.1,uv.y))*(smoothstep(.4,.6,bulge)*smoothstep(.8,.4,bulge));rb-=.2*edge;
 rr*=u_refraction;rb*=u_refraction;
 vec3 w=vec3(t1*cw,t2*cw,wide);w[1]-=.02*smoothstep(.0,1.,edge+bulge);
 float r=channel(color1.r,color2.r,mod(dir+rr,1.),w,.02+.03*u_refraction*bulge,bulge);
 float gg=channel(color1.g,color2.g,mod(dir,1.),w,.01/(1.-diagonal),bulge);
 float b=channel(color1.b,color2.b,mod(dir-rb,1.),w,.01,bulge);
 fragColor=vec4(vec3(r,gg,b)*opacity,opacity);
}`;
/** liquid-logo's default parameters. */
const PARAMS={patternScale:2,refraction:0.015,edge:0.4,patternBlur:0.005,liquid:0.07,speed:0.3};
const hex=(h:string)=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16)/255);
/** Light and dark tones of the metal, per LifeFlow theme. */
// Light tones stay clearly darker than the light hero backgrounds so the bright bands never vanish into them.
const TINTS:Record<string,[string,string]>={lifeflow:['#7fd6ad','#08301f'],'blue-oceanic':['#86d3e4','#082f40'],'dark-warm':['#ffe2c2','#4a240e']};

export default function LiquidLogo({theme}:{theme:string}){
 const canvas=useRef<HTMLCanvasElement>(null);
 const [ready,setReady]=useState(false);
 const colours=useRef(TINTS[theme]??TINTS.lifeflow);colours.current=TINTS[theme]??TINTS.lifeflow;
 const redraw=useRef<()=>void>(()=>{});
 useEffect(()=>{redraw.current()},[theme]);

 useEffect(()=>{
  const el=canvas.current;if(!el)return;
  const gl=el.getContext('webgl2',{antialias:true,alpha:true,premultipliedAlpha:true});
  if(!gl)return; // fallback: the ✳ glyph stays visible
  let raf=0,disposed=false,visible=true,time=0,last=performance.now();
  const reduce=window.matchMedia('(prefers-reduced-motion: reduce)');
  const compile=(type:number,src:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,src);gl.compileShader(s);return gl.getShaderParameter(s,gl.COMPILE_STATUS)?s:null};
  const vs=compile(gl.VERTEX_SHADER,VERT),fs=compile(gl.FRAGMENT_SHADER,FRAG);if(!vs||!fs)return;
  const prog=gl.createProgram()!;gl.attachShader(prog,vs);gl.attachShader(prog,fs);gl.linkProgram(prog);if(!gl.getProgramParameter(prog,gl.LINK_STATUS))return;
  gl.useProgram(prog);
  const u=(n:string)=>gl.getUniformLocation(prog,n);
  const buf=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buf);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,1,1]),gl.STATIC_DRAW);
  const pos=gl.getAttribLocation(prog,'a_position');gl.enableVertexAttribArray(pos);gl.vertexAttribPointer(pos,2,gl.FLOAT,false,0,0);
  gl.uniform1f(u('u_patternScale'),PARAMS.patternScale);gl.uniform1f(u('u_refraction'),PARAMS.refraction);gl.uniform1f(u('u_edge'),PARAMS.edge);gl.uniform1f(u('u_patternBlur'),PARAMS.patternBlur);gl.uniform1f(u('u_liquid'),PARAMS.liquid);
  const size=()=>{const r=el.getBoundingClientRect();const d=Math.min(2,window.devicePixelRatio||1);el.width=Math.max(1,Math.round(r.width*d));el.height=Math.max(1,Math.round(r.height*d));gl.viewport(0,0,el.width,el.height)};
  const draw=()=>{const [l,k]=colours.current;gl.uniform3fv(u('u_light'),hex(l));gl.uniform3fv(u('u_dark'),hex(k));gl.uniform1f(u('u_time'),time);gl.drawArrays(gl.TRIANGLE_STRIP,0,4)};
  redraw.current=()=>{if(!disposed)draw()};
  const loop=(now:number)=>{if(disposed)return;const dt=now-last;last=now;if(visible&&!document.hidden&&!reduce.matches){time+=dt*PARAMS.speed;draw()}raf=requestAnimationFrame(loop)};
  const img=new Image();
  img.onload=()=>{
   if(disposed)return;
   const tex=gl.createTexture();gl.activeTexture(gl.TEXTURE0);gl.bindTexture(gl.TEXTURE_2D,tex);
   gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
   gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,img);gl.uniform1i(u('u_image_texture'),0);
   size();draw();setReady(true);last=performance.now();raf=requestAnimationFrame(loop);
  };
  img.src='/liquid-asterisk.png';
  const io=new IntersectionObserver(([e])=>{visible=e.isIntersecting});io.observe(el);
  const onResize=()=>{size();draw()};window.addEventListener('resize',onResize);
  const onMotion=()=>draw();reduce.addEventListener('change',onMotion);
  return()=>{disposed=true;cancelAnimationFrame(raf);io.disconnect();window.removeEventListener('resize',onResize);reduce.removeEventListener('change',onMotion);gl.getExtension('WEBGL_lose_context')?.loseContext()};
 },[]);

 return <span className={`liquid-logo${ready?' is-ready':''}`} aria-hidden="true">
  <span className="liquid-glyph">✳</span>
  <canvas ref={canvas} className="liquid-canvas"/>
 </span>;
}
