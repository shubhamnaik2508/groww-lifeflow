import type {Metadata,Viewport} from 'next';
import './style.css';
import './transitions.css';
export const metadata:Metadata={title:'Groww LifeFlow',description:'Life changes. Your money plan adapts. An independent educational prototype, not affiliated with Groww.',manifest:'/manifest.webmanifest',icons:{icon:'/icon-192.png',apple:'/icon-192.png'}};
export const viewport:Viewport={themeColor:'#102d40',width:'device-width',initialScale:1};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
