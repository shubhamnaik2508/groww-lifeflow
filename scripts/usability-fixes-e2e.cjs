// Fixes from the 5 moderated usability sessions: the salary-delay result states the debit-day condition (and uses an
// entered balance), the AI answer explains its checks in plain language, "Recommended" is explained, and expense
// frequency says one-time vs every month. Usage: LIFEFLOW_TEST_URL=… node scripts/usability-fixes-e2e.cjs
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const edge=process.env.LIFEFLOW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base=(process.env.LIFEFLOW_TEST_URL||'http://localhost:3000').replace(/\/$/,'');
let passed=0;async function check(name,fn){try{await fn();passed++;console.log(`PASS ${name}`)}catch(e){console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);process.exitCode=1}}
const norm=s=>s.replace(/\s+/g,' ').trim();
(async()=>{
 const browser=await chromium.launch({executablePath:edge,headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:1366,height:900}});await ctx.addInitScript(()=>{try{localStorage.setItem('lifeflow-onboarded','yes')}catch{}});
  const page=await ctx.newPage();page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/?app');
  await page.getByLabel('Monthly take-home salary (₹)').fill('35000');await page.getByLabel('Recurring expenses (₹)').fill('21000');await page.getByLabel('Monthly SIP commitment (₹)').fill('4000');
  await page.locator('.sidebar').getByRole('button',{name:/Scenario Lab/}).click();
  const delay=async balance=>{await page.getByRole('button',{name:/Salary delayed/}).click();await page.getByLabel('Expected salary date').fill('2026-12-01');await page.getByLabel('Expected delay (days)').fill('7');await page.getByLabel('Available balance (optional)').fill(balance);await page.getByLabel('SIP debit date').fill('2026-12-05');await page.getByRole('button',{name:'See the impact'}).click();return norm(await page.getByRole('note',{name:'Will my SIP go through?'}).innerText())};
  await check('salary delay without a balance: says it depends on ₹4,000 being in the account on 5 Dec, and that LifeFlow can’t see the balance',async()=>{
   const t=await delay('');assert.match(t,/depends on your balance on 5 Dec/);assert.match(t,/at least ₹4,000\.00/);assert.match(t,/can’t see your bank balance/);assert.match(t,/Enter “Available balance” above/);
  });
  await check('salary delay with ₹5,000 entered: covers the ₹4,000 SIP',async()=>{assert.match(await delay('5000'),/The ₹5,000\.00 you entered covers the ₹4,000\.00 SIP on 5 Dec/)});
  await check('salary delay with ₹3,000 entered: ₹1,000 short, the debit may fail',async()=>{assert.match(await delay('3000'),/₹1,000\.00 short of the ₹4,000\.00 SIP on 5 Dec.*may fail/)});
  await check('the timeline and calculation text are unchanged',async()=>{const t=norm(await page.locator('.result').innerText());assert.match(t,/2026-12-08, 3 day\(s\) after the SIP date/);assert.match(t,/Salary arrives 8 Dec/)});
  await check('expense frequency says one-time (this month only) vs recurring (every month)',async()=>{
   await page.getByRole('button',{name:/Unexpected expense/}).click();const opts=await page.getByLabel('Frequency').locator('option').allInnerTexts();assert.deepEqual(opts,['One-time (this month only)','Recurring (every month)']);
  });
  await check('AI answer explains its checks in plain language',async()=>{
   await page.locator('.sidebar').getByRole('button',{name:/AI Companion/}).click();await page.getByLabel('Companion mode').selectOption('rules');
   await page.getByLabel('Your question').fill('My salary is delayed and my SIP is due soon. What should I check?');await page.getByRole('button',{name:/Ask LifeFlow/}).click();
   const d=page.locator('.answer .checks-explained');await d.locator('summary').click();const t=norm(await d.innerText());
   for(const s of ['Figures calculated by LifeFlow','Calculation consistency','Source support','Safety screening','Uncertainty','can’t prove an answer is right'])assert(t.includes(s),s);
  });
  await check('“Recommended” is explained next to the provider choice',async()=>{
   await page.getByLabel('Companion mode').selectOption('live');const n=norm(await page.locator('.provider-note').innerText());assert.match(n,/Why “Recommended”\? Google Gemini is LifeFlow’s default choice for this demo; it is not a claim that one model is better/);
   assert.equal(await page.locator('.provider-badge.recommended').getAttribute('title'),'LifeFlow’s default choice, not a quality claim');
  });
  await check('no page errors',async()=>assert.deepEqual(errors,[]));
  console.log(`RESULT ${passed} passed`);
 }catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await browser.close()}
})();
