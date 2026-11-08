// Life-to-SIP Scenario Simulator browser checks (no AI). Usage: LIFEFLOW_TEST_URL=… node scripts/simulator-e2e.cjs
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const edge=process.env.LIFEFLOW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base=process.env.LIFEFLOW_TEST_URL||'http://localhost:3000';
let passed=0;async function check(name,fn){try{await fn();passed++;console.log(`PASS ${name}`)}catch(e){console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);process.exitCode=1}}
(async()=>{
 const browser=await chromium.launch({executablePath:edge,headless:true});
 const page=await browser.newPage({viewport:{width:320,height:700},isMobile:true,hasTouch:true});page.setDefaultTimeout(8000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/?app');await page.getByRole('button',{name:/I understand/}).click();
 await page.getByLabel('Monthly take-home salary (₹)').fill('30000');await page.getByLabel('Recurring expenses (₹)').fill('18000');await page.getByLabel('Monthly SIP commitment (₹)').fill('3000');await page.getByLabel('Upcoming SIP date').fill('2026-12-05');
 const lab=async()=>{await page.locator('.mobile-nav').getByRole('button',{name:/Scenario Lab/}).click()};
 const pick=async n=>{await page.getByRole('button',{name:n}).click()};
 const impact=async()=>{await page.getByRole('button',{name:'See the impact'}).click()};
 await check('reference expense at 320px: ₹9,000 → ₹4,000',async()=>{await lab();await page.getByLabel('Expense amount (₹)').fill('5000');await page.getByLabel('Expense category').fill('Health');await impact();const t=await page.locator('.result').innerText();assert.match(t,/9,000\.00/);assert.match(t,/4,000\.00/);assert.match(t,/one-time/)});
 await check('₹0 and negative expenses are rejected with a clear message',async()=>{await page.getByLabel('Expense amount (₹)').fill('0');await impact();assert.match(await page.locator('p.error').innerText(),/above ₹0/);await page.getByLabel('Expense amount (₹)').fill('-5');await impact();assert.match(await page.locator('p.error').innerText(),/non-negative/)});
 await check('recurring expense is labelled monthly',async()=>{await page.getByLabel('Expense amount (₹)').fill('2000');await page.getByLabel('Frequency').selectOption('recurring');await impact();assert.match(await page.locator('.result').innerText(),/recurring monthly/)});
 await check('salary delay: timing only, no failure prediction',async()=>{await pick(/Salary delayed/);await page.getByLabel('Expected salary date').fill('2026-12-01');await page.getByLabel('Expected delay (days)').fill('7');await impact();const t=await page.locator('.result').innerText();assert.match(t,/2026-12-08, 3 day\(s\) after the SIP date/);assert.match(t,/does not establish a failed debit/)});
 await check('rent increase: ₹9,000 → ₹7,000',async()=>{await pick(/Rent increase/);await page.getByLabel('Previous rent (₹)').fill('8000');await page.getByLabel('Revised rent (₹)').fill('10000');await page.getByLabel('Effective month').fill('2026-12');await impact();assert.match(await page.locator('.result').innerText(),/7,000\.00/)});
 await check('job transition: unknown salary stays unknown and the gap commitments are named',async()=>{await pick(/Job transition/);await page.getByLabel('Previous monthly salary (₹)').fill('30000');await page.getByLabel('Expected gap (days)').fill('30');await impact();const t=await page.locator('.result').innerText();assert.match(t,/Unknown/);assert.match(t,/₹21,000\.00 a month\) continue/)});
 await check('SIP debit failure: reason unknown, no rule invented',async()=>{await pick(/SIP debit failure/);await page.getByLabel('Reported payment status').fill('failed');await impact();assert.match(await page.locator('.result').innerText(),/reason and applicable rules are unknown/)});
 await check('comparison at 320px without horizontal overflow',async()=>{const s=page.locator('.compare select');await s.nth(0).selectOption({index:1});await s.nth(1).selectOption({index:3});assert(await page.getByText(/Difference between results/).isVisible());const o=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(o<=1,`overflow ${o}`)});
 await check('history appears in My Journey',async()=>{await page.locator('.mobile-nav').getByRole('button',{name:/My Journey/}).click();assert((await page.locator('.timeline').count())>=5)});
 await check('no page errors',async()=>assert.deepEqual(errors,[]));
 await browser.close();console.log(`RESULT ${passed} passed`);
})();
