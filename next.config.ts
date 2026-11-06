import type {NextConfig} from 'next';

// Conservative headers. No Content-Security-Policy yet: WebLLM needs WebAssembly, a module
// worker and cross-origin model downloads (huggingface.co, raw.githubusercontent.com), so a
// CSP must be designed and tested against a real model load before it is added.
const config:NextConfig={
 poweredByHeader:false,
 headers(){
  return [{source:'/:path*',headers:[
   {key:'X-Content-Type-Options',value:'nosniff'},
   {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
   {key:'X-Frame-Options',value:'DENY'},
   {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
  ]}];
 },
};
export default config;
