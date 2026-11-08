// transitions.dev motion: each transition runs, ends fully visible, replays when it should, and is instant with reduced motion.
// Usage: LIFEFLOW_TEST_URL=… node scripts/transitions-e2e.cjs
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const edge=process.env.LIFEFLOW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base=(process.env.LIFEFLOW_TEST_URL||'http://localhost:3000').replace(/\/$/,'');
let passed=0;async function check(name,fn){try{await fn();passed++;console.log(`PASS ${name}`)}catch(e){console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);process.exitCode=1}}
// Opacity, blur and transform of an element now, and whether it is at rest (fully visible, no blur, no offset).
const look=(page,sel)=>page.evaluate(s=>{const el=document.querySelector(s);if(!el)return null;const c=getComputedStyle(el);return {opacity:+c.opacity,filter:c.filter,transform:c.transform,animation:c.animationName}},sel);
const atRest=v=>v&&v.opacity===1&&(v.filter==='none'||v.filter==='blur(0px)')&&(v.transform==='none'||v.transform==='matrix(1, 0, 0, 1, 0, 0)');

async function setup(browser,opts={}){
 const ctx=await browser.newContext({viewport:{width:1366,height:900},...opts});
 await ctx.addInitScript(()=>{try{localStorage.setItem('lifeflow-onboarded','yes')}catch{}});
 const page=await ctx.newPage();page.setDefaultTimeout(8000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?app');
 await page.getByLabel('Monthly take-home salary (₹)').fill('30000');await page.getByLabel('Recurring expenses (₹)').fill('18000');await page.getByLabel('Monthly SIP commitment (₹)').fill('3000');
 return {ctx,page,errors};
}
const nav=(page,name)=>page.locator('.sidebar').getByRole('button',{name:new RegExp(name)}).click();

(async()=>{
 const browser=await chromium.launch({executablePath:edge,headless:true});
 try{
  const {ctx,page,errors}=await setup(browser);
  await check('page headings: eyebrow and intro rise in with a stagger and settle fully visible, on every page (titles: gsap-motion-e2e)',async()=>{
   for(const name of ['Scenario Lab','Market Pulse','AI Companion','My Journey','AI Reliability']){
    await nav(page,name);
    const early=await look(page,'.page-heading .t-stagger-line--3');
    assert(early&&early.opacity<1,`${name}: intro starts hidden (opacity ${early?.opacity})`);
    await page.waitForTimeout(800);
    const lines=await page.locator('.page-heading .t-stagger-line').count();assert.equal(lines,2,`${name}: eyebrow and intro`);
    for(const n of [1,3])assert(atRest(await look(page,`.page-heading .t-stagger-line--${n}`)),`${name}: line ${n} at rest`);
   }
  });
  await check('Illustrative mode: grows from the pill (.is-open), shrinks on close (.is-closing), then leaves',async()=>{
   const pill=page.getByRole('button',{name:'Illustrative mode'});await pill.click();
   assert.equal(await page.locator('.illustrative-pop').getAttribute('data-origin'),'top-right');
   assert.match(await page.locator('.illustrative-pop').getAttribute('class'),/is-open/);
   await page.waitForTimeout(400);assert(atRest(await look(page,'.illustrative-pop')),'open popover at rest');
   await page.keyboard.press('Escape');
   assert.match(await page.locator('.illustrative-pop').getAttribute('class'),/is-closing/);
   // The close plays for --dropdown-close-dur (150 ms), even when the minified CSS writes it as .15s.
   await page.waitForTimeout(90);
   assert.match(await page.locator('.illustrative-pop').getAttribute('class',{timeout:500}),/is-closing/,'still closing after 90 ms');
   await page.locator('.illustrative-pop').waitFor({state:'detached',timeout:1000});
  });
  await check('scenario error shakes, and shakes again on the next failed try',async()=>{
   await nav(page,'Scenario Lab');await page.getByLabel('Expense amount (₹)').fill('0');await page.getByRole('button',{name:'See the impact'}).click();
   const a=await look(page,'p.error');assert.equal(a.animation,'t-input-shake');
   const first=await page.locator('p.error').elementHandle();
   await page.getByRole('button',{name:'See the impact'}).click();
   assert.equal(await first.evaluate(el=>el.isConnected),false,'a new message element replays the shake');
   assert.equal((await look(page,'p.error')).animation,'t-input-shake');
  });
  await check('scenario result slides in, and again for each new result',async()=>{
   await page.getByLabel('Expense amount (₹)').fill('5000');await page.getByLabel('Expense category').fill('Health');await page.getByRole('button',{name:'See the impact'}).click();
   assert.equal(await page.locator('.result').getAttribute('data-open'),'true');
   await page.waitForTimeout(600);assert(atRest(await look(page,'.result')),'result at rest');
   assert.match(await page.locator('.result').innerText(),/4,000\.00/);
   const first=await page.locator('.result').elementHandle();
   await page.getByLabel('Expense amount (₹)').fill('2000');await page.getByRole('button',{name:'See the impact'}).click();
   assert.equal(await first.evaluate(el=>el.isConnected),false,'new result is a fresh panel');
   await page.waitForTimeout(600);assert(atRest(await look(page,'.result')),'second result at rest');
  });
  await check('AI answer slides in and settles (rule-based guide, no network)',async()=>{
   await nav(page,'AI Companion');await page.getByLabel('Companion mode').selectOption('rules');
   await page.getByLabel('Your question').fill('How does this expense affect my cash?');await page.getByRole('button',{name:/Ask LifeFlow/}).click();
   await page.locator('.answer').waitFor();assert.equal(await page.locator('.answer').getAttribute('data-open'),'true');
   await page.waitForTimeout(600);assert(atRest(await look(page,'.answer')),'answer at rest');
  });
  await check('loaded evaluation cases slide in on AI Reliability',async()=>{
   await nav(page,'AI Reliability');await page.getByRole('button',{name:'Reload published review'}).click();
   const sec=page.locator('section.reliability').nth(1);await sec.waitFor();assert.equal(await sec.getAttribute('data-open'),'true');
   await page.waitForTimeout(600);assert(atRest(await look(page,'section.reliability.t-panel-slide')),'cases card at rest');
  });
  await check('no page errors',async()=>assert.deepEqual(errors,[]));
  await ctx.close();

  await check('"Checking the AI service…" shimmers, keeps its colour, and is announced once',async()=>{
   const c=await browser.newContext({viewport:{width:1366,height:900}});await c.addInitScript(()=>{try{localStorage.setItem('lifeflow-onboarded','yes')}catch{}});
   const p=await c.newPage();await p.route('**/api/lifeflow/companion',async r=>{if(r.request().method()==='GET'){await new Promise(x=>setTimeout(x,4000))}await r.continue().catch(()=>{})});
   await p.goto(base+'/#ai-companion');const s=p.locator('.ai-status .t-shimmer');await s.waitFor();
   const v=await s.evaluate(el=>{const b=getComputedStyle(el,'::before');return {anim:b.animationName,color:getComputedStyle(el).color,parent:getComputedStyle(el.parentElement).color}});
   assert.equal(v.anim,'t-shimmer');assert.equal(v.color,v.parent,'text keeps the status colour');
   const snap=await p.locator('.ai-status').ariaSnapshot();assert.equal((snap.match(/Checking the AI service/g)||[]).length,1,`announced once: ${snap}`);
   await c.close();
  });

  await check('reduced motion: headings, popover and results appear instantly at rest',async()=>{
   const {ctx:c,page:p}=await setup(browser,{reducedMotion:'reduce'});
   await nav(p,'Scenario Lab');assert(atRest(await look(p,'.page-heading .t-stagger-line--3')),'heading instantly at rest');
   await p.getByRole('button',{name:'Illustrative mode'}).click();await p.locator('.illustrative-pop.is-open').waitFor();assert(atRest(await look(p,'.illustrative-pop')),'popover instantly at rest');
   await p.keyboard.press('Escape');
   await p.getByLabel('Expense amount (₹)').fill('5000');await p.getByLabel('Expense category').fill('Health');await p.getByRole('button',{name:'See the impact'}).click();
   assert(atRest(await look(p,'.result')),'result instantly at rest');
   await p.getByLabel('Expense amount (₹)').fill('0');await p.getByRole('button',{name:'See the impact'}).click();
   assert.equal((await look(p,'p.error')).transform,'none','no shake');
   await c.close();
  });
  console.log(`RESULT ${passed} passed`);
 }catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await browser.close()}
})();
