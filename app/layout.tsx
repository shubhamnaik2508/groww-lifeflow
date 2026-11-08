import type {Metadata,Viewport} from 'next';
import './style.css';
import './transitions.css';
export const metadata:Metadata={title:'Groww LifeFlow',description:'Life changes. Your money plan adapts. An independent educational prototype, not affiliated with Groww.',manifest:'/manifest.webmanifest',icons:{icon:'/icon-192.png',apple:'/icon-192.png'}};
export const viewport:Viewport={themeColor:'#102d40',width:'device-width',initialScale:1};
// Decides before first paint whether to show the landing page or the app, so neither flashes. The landing page is the
// default on every visit; links to a section (#ai-reliability etc.) and ?app open the app directly. Storage is not used.
const VIEW_SCRIPT="try{if(location.hash.length>1||/[?&]app(=|&|$)/.test(location.search))document.documentElement.classList.add('lf-app')}catch(e){document.documentElement.classList.add('lf-app')}";
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{__html:VIEW_SCRIPT}}/></head><body>{children}</body></html>}
