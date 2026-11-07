import {NextResponse} from 'next/server';
import {fetchMarketVideos,VIDEO_CHANNELS,type MarketVideo} from '../../../../lib/market-pulse/youtube';

export const dynamic='force-dynamic';
export type VideosResponse={status:'ok';videos:MarketVideo[];channels:{name:string;url:string}[];fetchedAt:string;partial:boolean}|{status:'not_configured'}|{status:'error'};

/**
 * Public, read-only list of recent market videos. The YouTube API key stays on the server; upstream calls are cached
 * for an hour (Next.js data cache) and the response for 30 minutes at the edge, so visits barely touch the quota.
 */
export async function GET(){
 const send=(body:VideosResponse,maxAge:number)=>NextResponse.json(body,{headers:{'Cache-Control':`public, max-age=0, s-maxage=${maxAge}, stale-while-revalidate=3600`}});
 const key=process.env.YOUTUBE_API_KEY?.trim();
 if(!key)return send({status:'not_configured'},300);
 try{
  const {videos,failedChannels}=await fetchMarketVideos(key);
  if(failedChannels.length===VIDEO_CHANNELS.length)return send({status:'error'},120);
  return send({status:'ok',videos,channels:VIDEO_CHANNELS.map(c=>({name:c.name,url:c.url})),fetchedAt:new Date().toISOString(),partial:failedChannels.length>0},1800);
 }catch{return send({status:'error'},120)}
}
