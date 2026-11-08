// "Illustrative mode" pill: clicking opens an explanation; it closes on a second click, outside click or Escape.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const edge=process.env.LIFEFLOW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base=(process.env.LIFEFLOW_TEST_URL||'http://localhost:3000').replace(/\/$/,'');
// Closing plays the 150 ms dropdown close before the popover leaves the page.
const gone=async(page,msg)=>{await page.locator('.illustrative-pop').waitFor({state:'detached',timeout:2000}).catch(()=>{throw Error(msg)})};
let passed=0;const ok=m=>{passed++;console.log('PASS',m)};

(async()=>{
 const browser=await chromium.launch({executablePath:edge,headless:true});const errors=[];
 try{
  for(const theme of ['blue-oceanic','lifeflow','dark-warm']){
   const ctx=await browser.newContext({viewport:{width:1366,height:900}});
   await ctx.addInitScript(t=>{try{localStorage.setItem('lifeflow-onboarded','yes');localStorage.setItem('lifeflow-theme',t)}catch{}},theme);
   const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base+'/#market-pulse');
   const pill=page.getByRole('button',{name:'Illustrative mode'});await pill.waitFor();
   assert.equal(await pill.getAttribute('aria-expanded'),'false');
   assert.equal(await page.locator('.illustrative-pop').count(),0,'closed by default');
   await pill.click();
   const pop=page.getByRole('note',{name:'About illustrative mode'});await pop.waitFor();
   const text=await pop.innerText();
   for(const t of ['examples you enter','never connects to a bank, Groww or any investment account','LifeFlow’s server and Groq','Reset illustrative data'])assert(text.includes(t),`explains: ${t}`);
   assert.equal(await pill.getAttribute('aria-expanded'),'true');
   await page.keyboard.press('Escape');await gone(page,'Escape closes');
   assert.equal(await page.evaluate(()=>document.activeElement?.textContent?.includes('Illustrative mode')),true,'focus returns to the pill');
   await pill.click();await pop.waitFor();await page.mouse.click(400,600);await gone(page,'outside click closes');
   await pill.click();await pill.click();await gone(page,'second click closes');
   await page.keyboard.press('Tab');await pill.focus();await page.keyboard.press('Enter');await pop.waitFor();ok(`${theme}: opens on click and keyboard; closes on Escape, outside click and second click`);
   await ctx.close();
  }
  // Phone: tap opens it, and it stays fully on screen.
  const m=await browser.newContext({viewport:{width:360,height:780},isMobile:true,hasTouch:true});
  await m.addInitScript(()=>{try{localStorage.setItem('lifeflow-onboarded','yes')}catch{}});
  const p=await m.newPage();p.on('pageerror',e=>errors.push(e.message));
  await p.goto(base+'/?app');const pill=p.getByRole('button',{name:'Illustrative mode'});await pill.tap();
  const box=await p.locator('.illustrative-pop').boundingBox();assert(box&&box.x>=0&&box.x+box.width<=360,`popover fits on a 360 px screen (${JSON.stringify(box)})`);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0,'no sideways scroll');
  ok('phone: tap opens it and it fits the screen');await m.close();
  assert.deepEqual(errors,[]);ok('no page errors');
  console.log(`RESULT ${passed} passed`);
 }catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await browser.close()}
})();
