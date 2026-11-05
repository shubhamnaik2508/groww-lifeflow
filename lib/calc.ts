export type Profile = {salary:number; expenses:number; sip:number; sipDate:string};
export type Scenario = {id:string; type:string; title:string; before:number; after:number; change:number; detail:string; createdAt:string};
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
export const money=(n:number)=>new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:2}).format(n);
