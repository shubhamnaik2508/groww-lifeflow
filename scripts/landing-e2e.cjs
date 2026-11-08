// Landing page: the default view on every visit, on desktop and phone; scroll story chapters change with scroll, every
// chapter fits the screen, "Open LifeFlow" opens Home, section links / ?app skip it, reduced motion is
// static, and the footer link brings it back. Usage: LIFEFLOW_TEST_URL=… node scripts/landing-e2e.cjs
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const edge=process.env.LIFEFLOW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base=(process.env.LIFEFLOW_TEST_URL||'http://localhost:3000').replace(/\/$/,'');
let passed=0;async function check(name,fn){try{await fn();passed++;console.log(`PASS ${name}`)}catch(e){console.error(`FAIL ${name}: ${e.message.split('\n')[0]}`);process.exitCode=1}}
const norm=s=>s.replace(/\s+/g,' ').trim();
const DEVICES={desktop:{viewport:{width:1440,height:900}},phone:{viewport:{width:390,height:844},isMobile:true,hasTouch:true},'small phone':{viewport:{width:360,height:740},isMobile:true,hasTouch:true}};
// Scroll points sit in the middle of each chapter's settled window (chapters cross-fade between them).
const EXPECT=[['Your salary arrives.',/₹35,000/],['It splits into what matters.',/₹10,000/],['Then a ₹6,000 bill arrives.',/₹4,000/],['Sometimes salary is late.',/8 Dec/],['Markets move. Your plan doesn’t have to panic.',/Market Pulse[\s\S]*Illustration, not market data[\s\S]*Continue[\s\S]*Pause[\s\S]*Stop/],['Ask anything. Every answer is checked.',/Recommended/]];

(async()=>{
 const browser=await chromium.launch({executablePath:edge,headless:true});
 try{
  for(const [device,opts] of Object.entries(DEVICES)){
   await check(`${device}: first visit shows the landing, the story changes chapter as you scroll, and every chapter fits the screen`,async()=>{
    const ctx=await browser.newContext(opts);const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.goto(base+'/');await page.locator('.landing').waitFor();
    assert.equal(await page.locator('.app').isVisible(),false,'app hidden behind the landing');
    await page.waitForTimeout(1600);
    assert.equal(norm(await page.locator('.lp-title').getAttribute('aria-label')||await page.locator('.lp-title').innerText()),'Life happens. Let’s plan for it.');
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0,'no sideways scroll');
    const story=await page.locator('.lp-story').evaluate(e=>e.getBoundingClientRect().top+window.scrollY);
    for(const [i,[title,visual]] of EXPECT.entries()){
     await page.evaluate(y=>window.scrollTo(0,y),story+5300*[0.1,0.19,0.372,0.53,0.73,0.94][i]);await page.waitForTimeout(1300);
     assert.equal(await page.locator('.lp-dot').evaluateAll(ds=>ds.findIndex(d=>d.classList.contains('on'))),i,`${title}: dot ${i} active`);
     const shown=await page.locator('.lp-chapter').evaluateAll(cs=>cs.filter(c=>getComputedStyle(c).visibility!=='hidden'&&+getComputedStyle(c).opacity>0.9).map(c=>c.querySelector('h2').textContent));
     assert.deepEqual(shown,[title],`${title}: chapters showing ${JSON.stringify(shown)}`);
     assert.match(norm(await page.locator('.lp-stage').innerText()),visual,`${title}: visual shows ${visual}`);
     const fit=await page.evaluate(()=>{const hdr=document.querySelector('.lp-top').getBoundingClientRect().bottom;return [...document.querySelectorAll('.lp-chapter,.lp-ai-card,.lp-market,.lp-readout,.lp-tl-labels,.lp-dots')].filter(e=>getComputedStyle(e).visibility!=='hidden'&&+getComputedStyle(e).opacity>0.5).every(e=>{const r=e.getBoundingClientRect();return r.top>=hdr-1&&r.bottom<=innerHeight+1&&r.left>=-1&&r.right<=innerWidth+1})});
     assert(fit,`${title}: everything visible fits between the header and the bottom of the screen`);
     const clash=await page.evaluate(()=>{const txt=[...document.querySelectorAll('.lp-chapter')].find(e=>+getComputedStyle(e).opacity>0.9);if(!txt)return null;const t=txt.getBoundingClientRect();return [...document.querySelectorAll('.lp-ai-card,.lp-market,.lp-readout,.lp-tl-labels,.lp-svg')].filter(e=>getComputedStyle(e).visibility!=='hidden'&&+getComputedStyle(e).opacity>0.5).map(e=>({c:e.className.baseVal??e.className,r:e.getBoundingClientRect()})).filter(({r})=>r.bottom>t.top+1&&r.top<t.bottom-1&&r.right>t.left+1&&r.left<t.right-1).map(x=>x.c)});
     assert.deepEqual(clash,[],`${title}: picture overlaps the chapter text (${JSON.stringify(clash)})`);
    }
    assert.deepEqual(errors,[],JSON.stringify(errors));await ctx.close();
   });
  }
  await check('Open LifeFlow opens Home (title animates); the landing is shown again on the next visit',async()=>{
   const ctx=await browser.newContext(DEVICES.phone);const page=await ctx.newPage();
   await page.goto(base+'/');await page.waitForTimeout(1200);await page.getByRole('button',{name:/Open LifeFlow/}).first().click();
   await page.locator('.app').waitFor({state:'visible'});assert.equal(await page.locator('.landing').count(),0);
   await page.waitForTimeout(1500);assert.equal(norm(await page.locator('.intro h1').innerText()),'Life happens. Let’s plan for it.');
   // Regression: the Home logo canvas was created while hidden behind the landing and stayed 1×1 (a solid square).
   const logo=await page.locator('.hero-art .liquid-canvas').evaluate(c=>({w:c.width,h:c.height,css:Math.round(c.getBoundingClientRect().width),ready:c.parentElement.classList.contains('is-ready')}));
   if(logo.ready)assert(logo.w>=logo.css*0.9&&logo.w>40,`Home logo canvas is drawn at its real size (${JSON.stringify(logo)})`);
   assert(await page.getByRole('heading',{name:/An educational companion/}).isVisible(),'onboarding card still shown to a new visitor');
   await page.reload();await page.locator('.landing').waitFor({state:'visible'});assert.equal(await page.locator('.app').isVisible(),false,'landing again on the next visit');
   await page.getByRole('button',{name:/Open LifeFlow/}).first().click();await page.locator('.app').waitFor({state:'visible'});
   await page.getByRole('button',{name:'See the LifeFlow story'}).click();await page.locator('.landing').waitFor({state:'visible'});assert.equal(await page.locator('.app').isVisible(),false);
   await ctx.close();
  });
  for(const [device,opts] of Object.entries(DEVICES))await check(`${device}: the top-right “Watch the story” button on Home replays the landing, and fits the top bar`,async()=>{
   const ctx=await browser.newContext(opts);await ctx.addInitScript(()=>{try{localStorage.setItem('lifeflow-onboarded','yes')}catch{}});const page=await ctx.newPage();
   await page.goto(base+'/');await page.locator('.landing').waitFor({state:'visible'});assert.equal(await page.locator('.app').isVisible(),false,'landing even after onboarding');
   await page.getByRole('button',{name:/Open LifeFlow/}).first().click();await page.locator('.app').waitFor({state:'visible'});
   const btn=page.getByRole('button',{name:'Watch the LifeFlow story again'});
   const r=await btn.boundingBox();const vw=opts.viewport.width;assert(r&&r.x+r.width<=vw&&r.y<90,`in the top bar, on screen (${JSON.stringify(r)})`);assert(r.height>=24);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0,'no sideways scroll');
   await page.locator('.sidebar, .mobile-nav').getByRole('button',{name:/Scenario Lab/}).first().click();assert.equal(await btn.count(),0,'only on Home');
   await page.locator('.sidebar, .mobile-nav').getByRole('button',{name:/Home/}).first().click();
   await btn.click();await page.locator('.landing').waitFor({state:'visible'});assert.equal(await page.locator('.app').isVisible(),false);
   await page.getByRole('button',{name:/Open LifeFlow/}).first().click();await page.locator('.app').waitFor({state:'visible'});
   await ctx.close();
  });
  await check('deep links and ?app skip the landing',async()=>{
   const ctx=await browser.newContext();const page=await ctx.newPage();
   for(const u of ['/#ai-reliability','/?app']){await page.goto(base+u);await page.waitForTimeout(500);assert.equal(await page.locator('.app').isVisible(),true,u);assert.equal(await page.locator('.landing').isVisible().catch(()=>false),false,u)}
   await ctx.close();
  });
  await check('reduced motion: no pinning, every chapter readable in order',async()=>{
   const ctx=await browser.newContext({...DEVICES.phone,reducedMotion:'reduce'});const page=await ctx.newPage();
   await page.goto(base+'/');await page.waitForTimeout(800);assert.equal(await page.locator('.landing.lp-static').count(),1);
   const vis=await page.locator('.lp-chapter').evaluateAll(cs=>cs.map(c=>getComputedStyle(c).opacity));assert.deepEqual(vis,['1','1','1','1','1','1']);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth),0);
   await ctx.close();
  });
  console.log(`RESULT ${passed} passed`);
 }catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await browser.close()}
})();
