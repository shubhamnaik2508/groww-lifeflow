import {money,Profile} from '../lib/calc';

/** A proportional view of entered monthly commitments, not a portfolio chart. */
export default function FlowStory({profile,remaining}:{profile:Profile;remaining:number|null}){
 if(remaining===null||![profile.salary,profile.expenses,profile.sip].every(Number.isFinite))return null;
 const total=profile.expenses+profile.sip+Math.max(0,remaining);
 const width=(v:number)=>total>0?`${v/total*100}%`:'0%';
 return <section className="flow-story" aria-label="Monthly cash flow breakdown"><div className="flow-copy"><div className="eyebrow">THE LIFE-TO-SIP PICTURE</div><h3>Give every rupee context.</h3><p>See how the monthly amounts you entered fit together. This is an estimate, not an account balance.</p></div><div className="flow-visual"><div className="flow-top"><span>MONTHLY TAKE-HOME</span><b>{money(profile.salary)}</b></div><div className="flow-bar" aria-hidden="true"><span className="flow-expenses" style={{width:width(profile.expenses)}}/><span className="flow-sip" style={{width:width(profile.sip)}}/><span className="flow-remaining" style={{width:width(Math.max(0,remaining))}}/></div><div className="flow-legend"><span><i className="flow-expenses"/> Expenses <b>{money(profile.expenses)}</b></span><span><i className="flow-sip"/> SIP <b>{money(profile.sip)}</b></span><span><i className="flow-remaining"/> Remaining <b>{money(remaining)}</b></span></div>{remaining<0&&<p className="flow-warning">Commitments exceed entered monthly income by {money(-remaining)}. This does not establish your bank balance.</p>}</div></section>;
}
