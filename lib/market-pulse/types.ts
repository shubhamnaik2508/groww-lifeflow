import type {DailyClose,Freshness,Source,VerifiedSession} from './market';
import type {NewsItem} from './evidence';
import type {Brief} from './analyst';
import type {MonthlyPoint} from './oecd';

/**
 * The validated daily snapshot stored after each successful refresh and served to every visitor.
 * mode 'licensed': verified NIFTY 50 / SENSEX closes from a licensed source.
 * mode 'open': no index closes; the OECD monthly India share price index and news only.
 */
export type Snapshot={version:1;mode?:'licensed'|'open';sessionDate:string;updatedAt:string;indices:{session:VerifiedSession;closes:DailyClose[]}[];
 monthly?:{name:string;points:MonthlyPoint[];source:Source}|null;news:NewsItem[];brief:Brief;sources:Source[];notes:string[]};
/** `checkedAt`: when the scheduled job last completed successfully (including runs that found no new session). */
export type PulseResponse={status:'ok';snapshot:Snapshot;freshness:Freshness;checkedAt:string|null;lastRunFailed:boolean}|{status:'not_configured'|'empty'|'error';message:string};
