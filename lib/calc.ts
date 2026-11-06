export type Profile = {salary:number; expenses:number; sip:number; sipDate:string};
export type Scenario = {id:string; type:string; title:string; before:number; after:number; change:number; detail:string; createdAt:string; inputs?:Record<string,string>; profile?:Profile; estimateKnown?:boolean};
export function validAmount(value: number): boolean { return Number.isFinite(value) && value >= 0 && value <= 100000000; }
export function cashFlow(salary:number, expenses:number, sip:number, oneTime=0):number {
  if (![salary,expenses,sip,oneTime].every(validAmount)) throw new Error('Enter valid non-negative amounts.');
  return Math.round((salary-expenses-sip-oneTime)*100)/100;
}
export function daysBetween(a:string,b:string):number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  const parse=(s:string)=>{const [y,m,d]=s.split('-').map(Number); const date=new Date(Date.UTC(y,m-1,d)); return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===s ? date.getTime() : NaN;};
  const x=parse(a), y=parse(b); return Number.isFinite(x)&&Number.isFinite(y)?(y-x)/86400000:null;
}
/** Non-blocking plausibility notes for valid but unusual inputs. Arithmetic is unchanged. */
export function inputWarnings(profile:Profile,oneTime=0):string[]{
 const w:string[]=[];if(![profile.salary,profile.expenses,profile.sip].every(validAmount))return w;
 if(profile.salary>1000000)w.push('The monthly take-home salary is unusually large (above ₹10,00,000). Please check it is a monthly figure.');
 if(profile.salary===0&&(profile.expenses>0||profile.sip>0))w.push('Monthly take-home salary is ₹0, so every commitment reduces the estimate below zero.');
 if(profile.salary>0&&profile.expenses+profile.sip>profile.salary)w.push('Recurring expenses and SIP together exceed the entered take-home salary.');
 if(profile.salary>0&&validAmount(oneTime)&&oneTime>profile.salary*12)w.push('The one-time amount is more than twelve months of the entered salary. Please check the figure.');
 return w;
}
export const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n);

const titles:Record<string,string>={expense:'Unexpected expense',salary:'Salary delayed',rent:'Rent increase',job:'Job transition',failure:'SIP debit failure'};
export function calculateScenario(type:string, vals:Record<string,string>, profile:Profile) {
 const before=cashFlow(profile.salary,profile.expenses,profile.sip);let after=before,detail='',estimateKnown=true;
 if(!titles[type])throw Error('Choose a supported scenario.');
 const num=(key:string)=>{if(!vals[key]?.trim())throw Error('Complete the required fields.');const n=Number(vals[key]);if(!validAmount(n))throw Error('Enter valid non-negative amounts.');return n};
 const date=(key:string)=>{const v=vals[key]||profile.sipDate;if(daysBetween(v,v)===null)throw Error('Enter a valid SIP date.');return v};
 if(type==='expense'){const n=num('amount');if(n<=0)throw Error('Enter an expense amount above ₹0.');if(!vals.category?.trim())throw Error('Add an expense category.');after=cashFlow(profile.salary,profile.expenses,profile.sip,n);detail=`${vals.category.slice(0,80)}: ${money(n)} ${vals.frequency==='recurring'?'recurring monthly':'one-time'} expense. ${vals.frequency==='recurring'?'This estimate treats it as an additional monthly expense.':'This affects the illustrated month only.'}`}
 if(type==='rent'){const old=num('old'),next=num('new');if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(vals.month||''))throw Error('Choose the effective month.');if(old>profile.expenses)throw Error('Previous rent cannot exceed the recurring expenses entered in your monthly picture.');const diff=Math.round((next-old)*100)/100;after=Math.round((before-diff)*100)/100;detail=`Rent changes by ${money(diff)} per month from ${vals.month}. Assumes your existing expenses include the previous rent once.`}
 if(type==='salary'){const delay=num('delay');if(!Number.isInteger(delay)||delay>365)throw Error('Enter a whole-number delay up to 365 days.');const sipDate=date('debitDate');if(daysBetween(vals.salaryDate||'',sipDate)===null)throw Error('Enter a valid expected salary date.');const arrivalDate=new Date(`${vals.salaryDate}T00:00:00Z`);arrivalDate.setUTCDate(arrivalDate.getUTCDate()+delay);const arrival=arrivalDate.toISOString().slice(0,10);const gap=daysBetween(sipDate,arrival)!;detail=`Expected salary: ${arrival}, ${Math.abs(gap)} day(s) ${gap>0?'after':gap<0?'before':'on'} the SIP date. ${vals.balance?.trim()?`Available balance supplied: ${money(num('balance'))}. `:''}Timing alone does not establish a failed debit. Verify available funds, other commitments and the payment status.`}
 if(type==='job'){const old=num('oldSalary'),gap=num('gap'),sipDate=date('debitDate');if(!Number.isInteger(gap)||gap>3650)throw Error('Enter a valid whole-number gap in days.');if(vals.newSalary?.trim()){const next=num('newSalary');after=cashFlow(next,profile.expenses,profile.sip);detail=`Illustration using the expected new monthly salary; change from previous salary is ${money(next-old)}. `}else{estimateKnown=false;detail='The new salary is unknown, so no new monthly cash estimate is available. '}detail+=`Expected gap: ${gap} day(s); SIP date: ${sipDate}. ${gap>0?`During the gap, your recurring expenses and SIP (${money(Math.round((profile.expenses+profile.sip)*100)/100)} a month) continue whether or not salary is received. `:''}Actual income timing, available savings and other commitments need verification.`}
 if(type==='failure'){if(!vals.status?.trim())throw Error('Enter a reported status.');const sipDate=date('debitDate');detail=`Reported status: ${vals.status.slice(0,100)}; debit date: ${sipDate}. ${vals.mandate?.trim()?`Bank or mandate status: ${vals.mandate.slice(0,100)}. `:''}Check the bank transaction and mandate status, and confirm the instalment with your fund house. The reason and applicable rules are unknown.`}
 return {type,title:titles[type],before,after,change:Math.round((after-before)*100)/100,detail,estimateKnown};
}
