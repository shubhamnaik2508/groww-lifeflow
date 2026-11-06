import {money,validAmount} from '../calc';

/**
 * Deterministic engine for the Market Pulse SIP Decision Explorer.
 *
 * Compares four hypothetical contribution choices by their effect on one month's cash flow.
 * It never ranks the choices, never calls one recommended or safest, and the language model
 * never computes any of these figures.
 */

export type ExplorerInputs={
 salary:number;          // monthly take-home salary
 essentials:number;      // essential monthly expenses
 sip:number;             // current monthly SIP
 emergency:number;       // available emergency savings
 reducedSip:number;      // proposed reduced SIP (for the Reduce option)
 extraExpense:number;    // optional additional monthly expense (0 when not entered)
 pauseMonths:number;     // length of a hypothetical pause, in months
};

/** Clearly labelled hypothetical defaults for demonstrations (matches the LifeFlow reference case). */
export const DEMO_INPUTS:ExplorerInputs={salary:30000,essentials:18000,sip:3000,emergency:40000,reducedSip:1500,extraExpense:0,pauseMonths:3};

export type OptionId='continue'|'pause'|'reduce'|'stop';
export type OptionResult={
 id:OptionId;title:string;
 contribution:number;        // monthly SIP contribution under this option
 remaining:number;           // remaining monthly cash after essentials, extra expense and contribution
 difference:number;          // remaining cash compared with continuing the current plan
 notContributed:number|null; // contributions not made over the modelled period (pause: pause months; reduce: per month)
 tradeOffs:string[];         // neutral educational trade-offs; never a recommendation
};
export type ExplorerResult={
 ok:true;inputs:ExplorerInputs;
 baseline:{income:number;commitments:number;remaining:number};
 options:OptionResult[];
 emergency:{monthsOfEssentials:number|null;shortfallMonthsCovered:number|null};
 notes:string[];
}|{ok:false;errors:string[]};

const round=(n:number)=>Math.round(n*100)/100;
const MAX_PAUSE=24;

/** Validates every input; returns plain-language errors rather than guessing. */
export function validateInputs(raw:Partial<Record<keyof ExplorerInputs,unknown>>):{ok:true;inputs:ExplorerInputs}|{ok:false;errors:string[]}{
 const errors:string[]=[];
 const read=(key:keyof ExplorerInputs,label:string,optional=false):number=>{
  const v=raw[key];
  if(optional&&(v===undefined||v===null||v===''))return 0;
  const n=typeof v==='string'?(v.trim()===''?NaN:Number(v)):typeof v==='number'?v:NaN;
  if(!validAmount(n)){errors.push(`${label}: enter an amount from ₹0 to ₹10,00,00,000.`);return 0}
  return n;
 };
 const inputs:ExplorerInputs={
  salary:read('salary','Monthly salary'),essentials:read('essentials','Essential monthly expenses'),sip:read('sip','Current monthly SIP'),
  emergency:read('emergency','Emergency savings',true),reducedSip:read('reducedSip','Proposed reduced SIP',true),extraExpense:read('extraExpense','Additional monthly expense',true),
  pauseMonths:0,
 };
 const pm=raw.pauseMonths===undefined||raw.pauseMonths===''?3:Number(raw.pauseMonths);
 if(!Number.isInteger(pm)||pm<1||pm>MAX_PAUSE)errors.push(`Pause length: enter a whole number of months from 1 to ${MAX_PAUSE}.`);else inputs.pauseMonths=pm;
 if(!errors.length&&inputs.reducedSip>inputs.sip)errors.push('Proposed reduced SIP cannot be more than the current monthly SIP.');
 return errors.length?{ok:false,errors}:{ok:true,inputs};
}

export function exploreSip(raw:Partial<Record<keyof ExplorerInputs,unknown>>):ExplorerResult{
 const v=validateInputs(raw);if(!v.ok)return v;
 const i=v.inputs;
 const before=round(i.salary-i.essentials-i.extraExpense);       // cash before any SIP contribution
 const remainingWith=(contribution:number)=>round(before-contribution);
 const current=remainingWith(i.sip);
 const make=(id:OptionId,title:string,contribution:number,notContributed:number|null,tradeOffs:string[]):OptionResult=>
  ({id,title,contribution:round(contribution),remaining:remainingWith(contribution),difference:round(remainingWith(contribution)-current),notContributed:notContributed===null?null:round(notContributed),tradeOffs});
 const options:OptionResult[]=[
  make('continue','Continue SIP',i.sip,null,[
   `Your monthly contribution stays ${money(i.sip)}, so remaining cash is ${money(current)} a month.`,
   'Regular contributions keep buying units at whatever prices apply on each SIP date, including after market falls or rises.',
   'The invested value can go down as well as up; continuing does not protect against market losses.',
   current<0?`Your entered commitments exceed your income by ${money(-current)} a month, so affordability is the first thing to check.`:'Check that this still leaves room for essentials and irregular costs in the months ahead.',
  ]),
  make('pause','Pause SIP',0,i.sip*i.pauseMonths,[
   `During a ${i.pauseMonths}-month pause, remaining cash would be ${money(remainingWith(0))} a month (${money(i.sip)} more than now).`,
   `About ${money(i.sip*i.pauseMonths)} of contributions would not be made over the pause.`,
   'Whether a pause is available, and for how long, depends on your platform or fund house; check their rules before relying on it.',
   'Pausing stops new contributions only. Units you already hold stay invested; pausing is not a redemption.',
  ]),
  make('reduce','Reduce SIP',i.reducedSip,i.sip-i.reducedSip,[
   i.reducedSip===i.sip?'The proposed amount equals your current SIP, so nothing changes.':`Contributing ${money(i.reducedSip)} instead of ${money(i.sip)} leaves ${money(remainingWith(i.reducedSip))} a month (${money(i.sip-i.reducedSip)} more than now).`,
   'Smaller contributions mean fewer new units each month; existing units are unaffected.',
   'Changing the amount usually means modifying or replacing the SIP mandate; the steps and timing depend on your platform or fund house.',
  ]),
  make('stop','Stop SIP',0,null,[
   `With no further contributions under this plan, remaining cash would be ${money(remainingWith(0))} a month (${money(i.sip)} more than now).`,
   'Stopping ends future contributions under this plan. Existing mutual fund holdings remain invested until you choose to redeem them.',
   'Stopping a SIP is not a redemption and does not sell any units.',
   'Restarting later usually means registering a new SIP.',
  ]),
 ];
 const monthly=i.essentials+i.extraExpense;
 const notes:string[]=[];
 if(i.sip===0)notes.push('Your current SIP is ₹0, so the four options leave the same remaining cash.');
 if(before<0)notes.push(`Essential and additional expenses exceed income by ${money(-before)} a month before any SIP.`);
 if(i.salary===0)notes.push('Monthly salary is ₹0, so every commitment reduces remaining cash below zero.');
 notes.push('These are hypothetical, one-month comparisons. A cash-flow difference does not by itself determine the right investment decision for you.');
 return {ok:true,inputs:i,baseline:{income:i.salary,commitments:round(i.essentials+i.extraExpense+i.sip),remaining:current},options,
  emergency:{monthsOfEssentials:monthly>0?round(i.emergency/monthly):null,shortfallMonthsCovered:current<0?round(i.emergency/-current):null},notes};
}
