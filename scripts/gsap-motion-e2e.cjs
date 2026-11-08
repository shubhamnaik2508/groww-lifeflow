// GSAP motion adds movement only: titles keep their exact text, the money flow shows LifeFlow's own figures, the Home
// logo animates, and with reduced motion everything is static. Usage: LIFEFLOW_TEST_URL=… node scripts/gsap-motion-e2e.cjs
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const edge=process.env.LIFEFLOW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base=(process.env.LIFEFLOW_TEST_URL||'http://localhost:3000').replace(/\/$/,'');
let passed=0;async function check(name,fn){try{await fn();passed++;console.log(`PASS ${name}`)}catch(e){console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);process.exitCode=1}}
const TITLES={'Home':'Life happens. Let’s plan for it.','Scenario Lab':'Let’s make sense of what changed.','Market Pulse':'Understand the market. Evaluate your options.','AI Companion':'A little clarity, when you need it.','My Journey':'Every moment is part of the story.','AI Reliability':'Trust is built in the details.'};
const norm=s=>s.replace(/\s+/g,' ').trim();
async function open(browser,opts={}){
 const ctx=await browser.newContext({viewport:{width:1366,height:900},...opts});
 await ctx.addInitScript(()=>{try{localStorage.setItem('lifeflow-onboarded','yes')}catch{}});
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/');
 await page.getByLabel('Monthly take-home salary (₹)').fill('30000');await page.getByLabel('Recurring expenses (₹)').fill('18000');await page.getByLabel('Monthly SIP commitment (₹)').fill('3000');
 return {ctx,page,errors};
}
const nav=(page,name)=>page.locator('.sidebar').getByRole('button',{name:new RegExp(name)}).click();
const streamWidth=(page,scope,id)=>page.locator(`${scope} [data-stream="${id}"]`).evaluate(el=>Number(el.getAttribute('stroke-width')));

(async()=>{
 const browser=await chromium.launch({executablePath:edge,headless:true});
 try{
  const {ctx,page,errors}=await open(browser);
  await check('every tab title moves in word by word and settles with exactly the same text',async()=>{
   for(const [name,text] of Object.entries(TITLES)){
    await nav(page,name);const h1=page.locator('.main h1').first();
    await page.waitForTimeout(60);const words=await h1.locator('.title-word').count();assert(words>=4,`${name}: split into words (${words})`);
    await page.waitForTimeout(1400);
    assert.equal(norm(await h1.innerText()),text,`${name}: visible text unchanged`);
    assert.equal(norm(await h1.getAttribute('aria-label')||await h1.innerText()),text,`${name}: accessible name unchanged`);
    const settled=await h1.locator('.title-word').evaluateAll(ws=>ws.every(w=>getComputedStyle(w).opacity==='1'));assert(settled,`${name}: all words visible`);
   }
  });
  await check('Home logo enters and keeps turning slowly',async()=>{
   await nav(page,'Home');await page.waitForTimeout(1800);
   const a=await page.locator('.hero-symbol').evaluate(el=>getComputedStyle(el).transform);await page.waitForTimeout(700);
   const b=await page.locator('.hero-symbol').evaluate(el=>getComputedStyle(el).transform);
   assert.notEqual(a,b,'symbol rotating');assert.equal(await page.locator('.hero-symbol').evaluate(el=>getComputedStyle(el).opacity),'1');
   assert.match(norm(await page.locator('.art-label').innerText()),/A little more clarity for what comes next\./);
  });
  await check('Home money flow uses LifeFlow’s figures: stream widths in proportion 18,000 : 3,000 : 9,000',async()=>{
   await page.waitForTimeout(400);const [e,s,r]=[await streamWidth(page,'.flow-story','expenses'),await streamWidth(page,'.flow-story','sip'),await streamWidth(page,'.flow-story','remaining')];
   assert.ok(Math.abs(e/s-6)<0.01&&Math.abs(r/s-3)<0.01,`${e} ${s} ${r}`);
   assert.match(norm(await page.locator('.flow-story .flow-legend').innerText()),/Expenses ₹18,000\.00 SIP ₹3,000\.00 Remaining ₹9,000\.00/);
   await page.getByLabel('Recurring expenses (₹)').fill('20000');await page.waitForTimeout(800);
   assert.ok(Math.abs(await streamWidth(page,'.flow-story','remaining')/await streamWidth(page,'.flow-story','sip')-7/3)<0.01,'updates live as figures change');
   await page.getByLabel('Recurring expenses (₹)').fill('18000');
  });
  await check('Scenario Lab: the flow morphs to the after state and adds the expense stream; numbers unchanged',async()=>{
   await nav(page,'Scenario Lab');await page.getByLabel('Expense amount (₹)').fill('5000');await page.getByLabel('Expense category').fill('Health');await page.getByRole('button',{name:'See the impact'}).click();
   await page.waitForTimeout(1800);
   const res=norm(await page.locator('.result').innerText());assert.match(res,/₹9,000\.00 → AFTER ₹4,000\.00/);
   const [c,r]=[await streamWidth(page,'.scenario-flow','change'),await streamWidth(page,'.scenario-flow','remaining')];assert.ok(Math.abs(c/r-5/4)<0.01,`change ${c} remaining ${r}`);
   assert.match(norm(await page.locator('.scenario-flow .flow-legend').innerText()),/Expenses SIP This expense Remaining after/);
   assert.equal(await page.locator('.result').getByText('₹4,000.00').count(),1,'figures shown once, as before');
  });
  await check('salary delay shows the timing: 1 Dec expected, 5 Dec SIP, 8 Dec arrival, 3-day gap',async()=>{
   await page.getByRole('button',{name:/Salary delayed/}).click();await page.getByLabel('Expected salary date').fill('2026-12-01');await page.getByLabel('Expected delay (days)').fill('7');await page.getByLabel('SIP debit date').fill('2026-12-05');await page.getByRole('button',{name:'See the impact'}).click();
   await page.waitForTimeout(2200);const t=norm(await page.locator('.salary-timeline').innerText());
   assert.match(t,/Salary expected 1 Dec SIP debit 5 Dec Salary arrives 8 Dec/);assert.match(t,/3 days after the SIP debit date/);
   assert.equal(await page.locator('.tl-coin').evaluate(el=>getComputedStyle(el).transform),'matrix(1, 0, 0, 1, 0, 0)','coin ends at arrival');
  });
  await check('no page errors',async()=>assert.deepEqual(errors,[]));
  await ctx.close();
  await check('reduced motion: titles are not split, the logo is still, flows are drawn at their final size',async()=>{
   const {ctx:c,page:p}=await open(browser,{reducedMotion:'reduce'});
   assert.equal(await p.locator('.main h1 .title-word').count(),0);assert.equal(norm(await p.locator('.intro h1').innerText()),TITLES.Home);
   const a=await p.locator('.hero-symbol').evaluate(el=>getComputedStyle(el).transform);await p.waitForTimeout(600);assert.equal(await p.locator('.hero-symbol').evaluate(el=>getComputedStyle(el).transform),a);
   assert.ok(await streamWidth(p,'.flow-story','expenses')>0);await c.close();
  });
  await check('phone (360 px): no sideways scroll on Home and Scenario Lab',async()=>{
   const {ctx:c,page:p}=await open(browser,{viewport:{width:360,height:780},isMobile:true,hasTouch:true});
   await p.waitForTimeout(1500);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0);
   await p.locator('.mobile-nav').getByRole('button',{name:/Scenario Lab/}).click();await p.getByLabel('Expense amount (₹)').fill('5000');await p.getByLabel('Expense category').fill('Health');await p.getByRole('button',{name:'See the impact'}).click();
   await p.waitForTimeout(1500);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0);await c.close();
  });
  console.log(`RESULT ${passed} passed`);
 }catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await browser.close()}
})();
