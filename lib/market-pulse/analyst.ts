import type {Generate} from '../ai/pipeline';
import {deterministicBrief,humanDate,type Evidence} from './evidence';
import {analysisJsonSchema,evaluate,type Analysis,type GateCheck} from './gate';

export const MARKET_PROMPT_VERSION='market-pulse-v1';

const SYSTEM=`You are the Market Pulse analyst in Groww LifeFlow, an independent educational prototype for first-time salaried investors in India. It is not affiliated with Groww and gives no investment advice.

You receive VERIFIED FACTS (index closes, changes and history statistics computed by LifeFlow) and NEWS ITEMS (headline, publisher, date and summary from permitted feeds). Write a short, neutral explanation of the latest completed trading session.

Rules:
1. Use only the facts and news provided. Never invent prices, percentages, dates, events, news or sources. Copy figures exactly as given in "display".
2. Every claim lists its support ids: market_facts, history_context and verdict_summary cite fact ids (F_...); context claims cite news ids (N...).
3. Describe causes only when a cited news item reports them, and attribute them ("according to <publisher>", "reported"). If no news supports a cause, say the reasons are not established by the sources provided.
4. Refer to the session by its date, never "today", "yesterday" or "live".
5. Do not predict markets or returns. Do not recommend buying, selling, continuing, pausing, reducing or stopping a SIP, and do not call a fall a buying opportunity.
6. sip_education explains, neutrally, what periodic investing means in a falling or rising market and that cash-flow affordability, emergency savings, investment horizon and uncertainty are the considerations. It must not tell the user what to do.
7. uncertainty lists what the facts and news do not establish.
8. Plain English, short sentences, no hype. Output JSON only.
9. Lengths: verdict_headline under 120 characters; market_facts 2 to 5 items; context up to 4; history_context up to 3; sip_education 1 to 3; uncertainty 1 to 3. Each claim is one or two sentences.`;

export function buildMessages(e:Evidence){
 const user={session_date:e.sessionDate,session_date_display:humanDate(e.sessionDate),
  facts:e.facts.map(f=>({id:f.id,label:f.label,display:f.display})),
  news:e.news.map(n=>({id:n.id,headline:n.title,publisher:n.publisher,published:n.publishedAt.slice(0,10),summary:n.summary}))};
 return [{role:'system' as const,content:SYSTEM},{role:'user' as const,content:JSON.stringify(user)}];
}

export type Brief={
 kind:'ai'|'deterministic';
 sessionDate:string;generatedAt:string;promptVersion:string;model:string|null;
 headline:string;summary:string;note:string|null;
 analysis:Analysis|null;           // present only when every gate check passed
 checks:GateCheck[];               // which checks ran and their result (no rejected text is stored)
 fallbackReason:string|null;
};

/** Generates the AI brief; on any provider error or gate failure, returns the deterministic brief instead. */
export async function analyse(e:Evidence,generate:Generate|null,model:string|null,now=new Date()):Promise<Brief>{
 const base={sessionDate:e.sessionDate,generatedAt:now.toISOString(),promptVersion:MARKET_PROMPT_VERSION,model};
 const fallback=(reason:string,checks:GateCheck[]=[]):Brief=>{const d=deterministicBrief(e);return {...base,kind:'deterministic',headline:d.headline,summary:d.summary,note:d.note,analysis:null,checks,fallbackReason:reason}};
 if(!generate)return fallback('AI is not configured on this server.');
 let raw:unknown;
 try{
  const text=await generate({messages:buildMessages(e),schema:analysisJsonSchema,signal:AbortSignal.timeout(28000)});
  raw=JSON.parse(text);
 }catch(err){return fallback(err instanceof SyntaxError?'The AI response was not valid JSON.':(err as {message?:string})?.message?.slice(0,200)??'The AI request failed.')}
 const result=evaluate(raw,e);
 // Rejected content is discarded here: only check names and short reasons are kept.
 if(!result.passed)return fallback('The AI analysis did not pass every Market Pulse check, so verified facts are shown instead.',result.checks.map(c=>({id:c.id,label:c.label,passed:c.passed})));
 const a=raw as Analysis;
 return {...base,kind:'ai',headline:a.verdict_headline,summary:a.verdict_summary.text,note:null,analysis:a,checks:result.checks,fallbackReason:null};
}
