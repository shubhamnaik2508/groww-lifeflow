import type {Metadata,Viewport} from 'next';
import './style.css';
export const metadata:Metadata={title:'Groww LifeFlow',description:'Life changes. Your money plan adapts.',manifest:'/manifest.webmanifest'};
export const viewport:Viewport={themeColor:'#111b19',width:'device-width',initialScale:1};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
