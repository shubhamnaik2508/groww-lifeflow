// AI provider picker: Gemini is the default for first-time visitors, Groq can be chosen, switching keeps context and each
// provider's last answer, failures offer (never force) the other provider, and no credentials reach the browser.
// Usage: LIFEFLOW_TEST_URL=… node scripts/ai-providers-e2e.cjs   (set LIFEFLOW_LIVE_AI=1 to also ask both real providers)
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const edge=process.env.LIFEFLOW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base=(process.env.LIFEFLOW_TEST_URL||'http://localhost:3000').replace(/\/$/,'');
let passed=0;async function check(name,fn){try{await fn();passed++;console.log(`PASS ${name}`)}catch(e){console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);process.exitCode=1}}
const status={default_provider:'gemini',ai_enabled:true,protection:'shared',prompt_version:'lifeflow-agent-v3.2',providers:{gemini:{label:'Google Gemini',available:true,model:'gemini-3.5-flash-lite',unavailable_reason:null},groq:{label:'Groq',available:true,model:'openai/gpt-oss-120b',unavailable_reason:null}},provider:'gemini',ai_available:true,model:'gemini-3.5-flash-lite',unavailable_reason:null};
const answer=(provider,summary,kind='model')=>({kind,label:kind==='model'?'AI-generated · passed every quality check':'Rule-based guide · not AI',scenario:'Unexpected expense',summary,explanation:summary,claims:[],known_facts:[],user_facts:[],calculated_facts:[],facts_used:[],assumptions:[],missing_information:[],sources:[],next_steps:[],uncertainty:'Illustrative.',requires_abstention:false,abstention_reason:'',clarifying_question:'',safety_flags:[],checks:[],topic:'expense',created_at:new Date().toISOString()+Math.random(),...(kind==='model'?{model:{id:provider==='gemini'?'gemini-3.5-flash-lite':'openai/gpt-oss-120b',name:provider,library:'x',provider,prompt_version:'v',params:{temperature:0.1,top_p:0.9,max_tokens:700,seed:42}}}:{notice:'Google Gemini is busy or its quota is reached. Please try again shortly, or try Groq. The rule-based guide is shown; it is not an AI response.',fallback_reason:'provider_rate_limited'})});
async function open(browser,opts={},handler){
 const ctx=await browser.newContext({viewport:{width:1366,height:900},...opts});
 await ctx.addInitScript(()=>{try{localStorage.setItem('lifeflow-onboarded','yes')}catch{}});
 const page=await ctx.newPage();page.setDefaultTimeout(10000);const sent=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
 if(handler)await page.route('**/api/lifeflow/companion',async r=>{if(r.request().method()==='GET')return r.fulfill({json:status});const body=JSON.parse(r.request().postData());sent.push(body);return r.fulfill({json:handler(body,sent.length)})});
 await page.goto(base+'/#ai-companion');await page.locator('.provider-picker').waitFor();
 return {ctx,page,sent,errors};
}
const radio=(page,name)=>page.getByRole('radio',{name});

(async()=>{
 const browser=await chromium.launch({executablePath:edge,headless:true});
 try{
  await check('first-time visitors get Google Gemini (Recommended) selected; Groq is the Alternative',async()=>{
   const {ctx,page}=await open(browser,{},()=>answer('gemini','x'));
   assert.equal(await radio(page,/Google Gemini/).isChecked(),true);assert.equal(await radio(page,/Groq/).isChecked(),false);
   const cards=page.locator('.provider-option');
   assert.match(await cards.nth(0).innerText(),/Google Gemini[\s\S]*Recommended[\s\S]*Smart financial explanations and personalised learning assistance/i);
   assert.match(await cards.nth(1).innerText(),/Groq[\s\S]*Alternative[\s\S]*Fast AI responses powered by the existing Groq model/i);
   assert.match(await page.locator('.provider-note').innerText(),/default choice, not a claim that one model is better/);
   assert.match(await page.locator('.ai-status').innerText(),/Answering with Google Gemini/);
   await ctx.close();
  });
  await check('switching Gemini → Groq → Gemini sends the chosen provider, keeps the question and each provider’s last answer',async()=>{
   const {ctx,page,sent,errors}=await open(browser,{},b=>answer(b.provider,`ANSWER FROM ${b.provider.toUpperCase()}`));
   const q='How does this expense affect my cash?';await page.getByLabel('Your question').fill(q);
   await page.getByRole('button',{name:/Ask LifeFlow/}).click();await page.getByText('ANSWER FROM GEMINI').first().waitFor();
   await radio(page,/Groq/).check();assert.match(await page.locator('.ai-status').innerText(),/Answering with Groq/);
   assert.equal(await page.getByLabel('Your question').inputValue(),q,'question kept');assert.equal(await page.getByText('ANSWER FROM GEMINI').count(),0,'Groq has no answer yet');
   await page.getByRole('button',{name:/Ask LifeFlow/}).click();await page.getByText('ANSWER FROM GROQ').first().waitFor();
   await radio(page,/Google Gemini/).check();await page.getByText('ANSWER FROM GEMINI').first().waitFor();
   await radio(page,/Groq/).check();await page.getByText('ANSWER FROM GROQ').first().waitFor();
   assert.deepEqual(sent.map(b=>b.provider),['gemini','groq']);assert.ok(sent.every(b=>b.question===q));
   assert.deepEqual(errors,[]);await ctx.close();
  });
  await check('a Gemini failure is labelled and offers Groq; it never switches by itself',async()=>{
   const {ctx,page,sent}=await open(browser,{},b=>b.provider==='gemini'?answer('gemini','FALLBACK','rule-based'):answer('groq','ANSWER FROM GROQ'));
   await page.getByLabel('Your question').fill('How does this expense affect my cash?');await page.getByRole('button',{name:/Ask LifeFlow/}).click();
   await page.locator('.answer-notice').getByText(/Gemini is busy/).waitFor();
   assert.equal(await radio(page,/Google Gemini/).isChecked(),true,'still on Gemini');assert.deepEqual(sent.map(b=>b.provider),['gemini']);
   await page.getByRole('button',{name:'Ask Groq instead'}).click();await page.getByText('ANSWER FROM GROQ').first().waitFor();
   assert.equal(await radio(page,/Groq/).isChecked(),true);assert.deepEqual(sent.map(b=>b.provider),['gemini','groq']);
   await ctx.close();
  });
  await check('an unavailable provider is shown as such, and can still be selected',async()=>{
   const {ctx,page}=await open(browser);
   await page.route('**/api/lifeflow/companion',r=>r.fulfill({json:{...status,providers:{...status.providers,groq:{label:'Groq',available:false,model:'openai/gpt-oss-120b',unavailable_reason:'paused'}}}}));
   await page.reload();await page.locator('.provider-option.unavailable').getByText(/Paused on this demo/).waitFor();
   await radio(page,/Groq/).check();assert.match(await page.locator('.ai-status').innerText(),/paused/);await ctx.close();
  });
  await check('keyboard: arrow keys move between providers',async()=>{
   const {ctx,page}=await open(browser,{},()=>answer('gemini','x'));
   await radio(page,/Google Gemini/).focus();await page.keyboard.press('ArrowRight');assert.equal(await radio(page,/Groq/).isChecked(),true);
   await page.keyboard.press('ArrowLeft');assert.equal(await radio(page,/Google Gemini/).isChecked(),true);await ctx.close();
  });
  await check('phone (360 px): cards stack, nothing overflows, three themes render',async()=>{
   const {ctx,page}=await open(browser,{viewport:{width:360,height:780},isMobile:true,hasTouch:true},()=>answer('gemini','x'));
   const [a,b]=[await page.locator('.provider-option').nth(0).boundingBox(),await page.locator('.provider-option').nth(1).boundingBox()];
   assert(b.y>a.y+a.height-1,'stacked');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0);
   for(const t of ['dark-warm','blue-oceanic','lifeflow']){await page.getByLabel('Choose theme').selectOption(t);assert(await page.locator('.provider-badge.recommended').isVisible())}
   await ctx.close();
  });
  await check('no credentials or key names reach the browser',async()=>{
   const {ctx,page}=await open(browser);
   const texts=await page.evaluate(async()=>{const urls=[...document.scripts].map(s=>s.src).filter(Boolean);const out=[document.documentElement.outerHTML];for(const u of urls)out.push(await (await fetch(u)).text());out.push(await (await fetch('/api/lifeflow/companion')).text());return out.join('\n')});
   for(const re of [/gsk_[A-Za-z0-9]{20,}/,/AIza[0-9A-Za-z_-]{30,}/,/GEMINI_API_KEY/,/GROQ_API_KEY/,/KV_REST_API_TOKEN/,/UPSTASH_REDIS_REST_TOKEN/])assert(!re.test(texts),`found ${re}`);
   await ctx.close();
  });
  if(process.env.LIFEFLOW_LIVE_AI==='1')await check('live: both real providers answer the reference question with LifeFlow’s figures',async()=>{
   const {ctx,page}=await open(browser);
   await page.goto(base+'/');await page.getByLabel('Monthly take-home salary (₹)').fill('30000');await page.getByLabel('Recurring expenses (₹)').fill('18000');await page.getByLabel('Monthly SIP commitment (₹)').fill('3000');
   await page.locator('.sidebar').getByRole('button',{name:/Scenario Lab/}).click();await page.getByLabel('Expense amount (₹)').fill('5000');await page.getByLabel('Expense category').fill('Health');await page.getByRole('button',{name:'See the impact'}).click();
   await page.locator('.sidebar').getByRole('button',{name:/AI Companion/}).click();
   for(const [p,id] of [['Google Gemini','gemini'],['Groq','groq']]){
    await radio(page,new RegExp(p)).check();await page.getByLabel('Your question').fill('How does this expense affect my cash?');
    await page.getByRole('button',{name:/Ask LifeFlow/}).click();await page.locator('.answer').waitFor({timeout:60000});await page.getByRole('button',{name:/Ask LifeFlow/}).waitFor({timeout:60000});
    const badge=await page.locator('.answer .simulation-badge').innerText();const text=await page.locator('.answer').innerText();
    console.log(`  ${id}: ${badge} · ${(await page.locator('.answer .model-meta').innerText().catch(()=>'')).replace(/\s+/g,' ').slice(0,90)}`);
    assert.match(text,/4,000/);
    if(!/AI-generated/.test(badge))console.log(`  ${id} returned the labelled fallback: ${(await page.locator('.answer-notice').innerText().catch(()=>'')).slice(0,160)}`);
    await page.waitForTimeout(11000);
   }
   await ctx.close();
  });
  console.log(`RESULT ${passed} passed`);
 }catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await browser.close()}
})();
