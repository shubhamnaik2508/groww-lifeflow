import type {DailyClose,Freshness,Source,VerifiedSession} from './market';
import type {NewsItem} from './evidence';
import type {Brief} from './analyst';

/** The validated daily snapshot stored after each successful refresh and served to every visitor. */
export type Snapshot={version:1;sessionDate:string;updatedAt:string;indices:{session:VerifiedSession;closes:DailyClose[]}[];news:NewsItem[];brief:Brief;sources:Source[];notes:string[]};
/** `checkedAt`: when the scheduled job last completed successfully (including runs that found no new session). */
export type PulseResponse={status:'ok';snapshot:Snapshot;freshness:Freshness;checkedAt:string|null;lastRunFailed:boolean}|{status:'not_configured'|'empty'|'error';message:string};
