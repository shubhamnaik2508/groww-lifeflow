// AI Reliability: the status names the published human-labelled review, and "Load published review" shows its runs and human verdicts.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const edge=process.env.LIFEFLOW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base=(process.env.LIFEFLOW_TEST_URL||'http://localhost:3000').replace(/\/$/,'');
let passed=0;const ok=m=>{passed++;console.log('PASS',m)};

(async()=>{
 const browser=await chromium.launch({executablePath:edge,headless:true});const errors=[];
 try{
  const ctx=await browser.newContext({viewport:{width:1366,height:900}});
  await ctx.addInitScript(()=>{try{localStorage.setItem('lifeflow-onboarded','yes')}catch{}});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(base+'/#ai-reliability');
  await page.getByText(/one human-labelled set of 6 cases/).waitFor();
  assert(await page.getByText(/No labelled examples imported/).isVisible(),'empty until loaded');ok('status describes the published review; nothing is loaded by default');
  await page.getByRole('button',{name:'Load published review'}).click();
  await page.getByText(/6 human-labelled cases imported/).waitFor();
  const metrics=(await page.locator('.metrics').innerText()).replace(/\s+/g,' ');
  for(const t of ['GENUINE LABELLED CASES 6','BEHAVIOUR MATCH 4/6','6 reviewed','Pass: 2','Correct abstention: 2','Partial pass: 1','Fail: 1'])assert(metrics.includes(t),`metrics show "${t}" (${metrics})`);
  ok('metrics: 6 genuine cases, 4/6 behaviour match, 6 reviewed (Pass 2, Correct abstention 2, Partial pass 1, Fail 1)');
  const sec=page.locator('section.reliability').nth(1);
  for(const [id,verdict,match] of [['h1-expense','Pass',true],['h2-fund-pick','Correct abstention',true],['h3-empty-profile','Pass',true],['h4-salary-delay','Partial pass',false],['h5-rent-increase','Fail',false],['h6-prompt-injection','Correct abstention',true]]){
   await sec.locator('select').first().selectOption(id);
   assert.equal((await sec.innerText()).includes('matches label'),match,`${id} behaviour match shown as ${match}`);
   assert.equal(await sec.locator('label.field',{hasText:'Overall human outcome'}).locator('select').inputValue(),verdict);
  }
  ok('each case shows its recorded output, behaviour match and human verdict');
  assert(!(await page.content()).match(/Shubham|Naik/i));ok('no personal names on the page');
  assert.deepEqual(errors,[]);ok('no page errors');
  console.log(`RESULT ${passed} passed`);
 }catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await browser.close()}
})();
