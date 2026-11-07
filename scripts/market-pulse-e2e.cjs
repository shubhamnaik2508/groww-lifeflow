// Market Pulse browser test. The API response is intercepted INSIDE THIS TEST with synthetic,
// clearly labelled test numbers, so the UI can be checked without live data; production code
// has no sample-data path. One check also calls the real API to confirm its honest empty state.
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const edge=process.env.LIFEFLOW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base=(process.env.LIFEFLOW_TEST_URL||'http://localhost:3000').replace(/\/$/,'');
let passed=0;const ok=m=>{passed++;console.log('PASS',m)};

// ---- synthetic test snapshot (NOT market data) ----
function closes(end,last){const out=[];let d=new Date(`${end}T00:00:00Z`),v=last;while(out.length<270){const w=d.getUTCDay();if(w&&w<6){out.push({date:d.toISOString().slice(0,10),close:Math.round(v*100)/100});v=v*(1+Math.sin(out.length/7)*0.004)}d=new Date(d.getTime()-86400000)}return out.reverse()}
const src={name:'TEST SOURCE (synthetic)',url:'https://example.test/source',attribution:'Synthetic test data'};
const mk=(id,name,last,prev)=>{const c=closes('2026-11-06',last);c[c.length-2].close=prev;c[c.length-1].close=last;return {session:{id,name,sessionDate:'2026-11-06',close:last,previousClose:prev,previousDate:c[c.length-2].date,change:Math.round((last-prev)*100)/100,changePct:Math.round((last-prev)/prev*10000)/100,direction:last<prev?'down':'up',source:src,retrievedAt:'2026-11-06T13:05:00Z'},closes:c}};
const snapshot={version:1,sessionDate:'2026-11-06',updatedAt:'2026-11-06T13:05:00Z',sources:[src],notes:[],
 indices:[mk('nifty50','NIFTY 50',11111.11,11211.11),mk('sensex','BSE SENSEX',22222.22,22322.22)],
 news:[{id:'N1',title:'TEST HEADLINE: synthetic news item for UI testing',publisher:'Test Wire',publishedAt:'2026-11-06T10:00:00Z',url:'https://example.test/n1',summary:'Synthetic summary used only by the automated test.'}],
 brief:{kind:'ai',sessionDate:'2026-11-06',generatedAt:'2026-11-06T13:05:00Z',promptVersion:'market-pulse-v1',model:'test-model',headline:'TEST VERDICT: benchmark indices closed lower on 6 November 2026',summary:'TEST SUMMARY sentence.',note:null,fallbackReason:null,
  checks:[{id:'schema',label:'Response matches the required structure',passed:true}],
  analysis:{verdict_headline:'x',verdict_summary:{text:'x',supports:[]},market_facts:[{text:'TEST FACT claim.',supports:['F_NIFTY_CLOSE']}],context:[{text:'TEST CONTEXT claim.',supports:['N1']}],history_context:[],sip_education:[{text:'TEST SIP education claim.',supports:['F_NIFTY_PCT']}],uncertainty:['TEST UNCERTAINTY item.']}}};
const fulfil=body=>route=>route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});

(async()=>{
 const browser=await chromium.launch({executablePath:edge,headless:true});
 const errors=[];
 try{
  // 1. Real API: without storage configured, it reports that honestly and shows no figures.
  const real=await (await fetch(base+'/api/market-pulse')).json();
  assert(['not_configured','empty','ok','error'].includes(real.status));
  if(real.status!=='ok')assert(!('snapshot' in real));
  ok(`real API responds honestly (${real.status})`);

  const ctx=await browser.newContext({viewport:{width:1366,height:900}});
  await ctx.addInitScript(()=>{try{localStorage.setItem('lifeflow-onboarded','yes')}catch{}});
  const page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  const tvRequests=[];
  // The Single Ticker web component module is also stubbed inside the test (defines <tv-single-ticker>).
  await page.route('https://widgets.tradingview-widget.com/**',route=>{tvRequests.push(route.request().url());route.fulfill({status:200,contentType:'text/javascript',body:"if(!customElements.get('tv-single-ticker'))customElements.define('tv-single-ticker',class extends HTMLElement{connectedCallback(){this.textContent='SENSEX (test stub) · SENSEX quote by TradingView'}})"})});
  await page.route('https://s3.tradingview.com/**',route=>{tvRequests.push(route.request().url());route.fulfill({status:200,contentType:'text/javascript',body:"(function(s){if(!s||!s.parentNode)return;var d=document.createElement('div');d.className='tv-stub';d.textContent='TradingView widget (test stub): '+JSON.parse(s.text).symbol||'';s.parentNode.appendChild(d)})(document.currentScript)"})});
  await page.route('**/api/market-pulse',fulfil({status:'ok',snapshot,freshness:{status:'current',weekdaysBehind:0,latestPossible:'2026-11-06'},checkedAt:'2026-11-07T13:30:00Z',lastRunFailed:false}));

  // 2. Navigation: Market Pulse is reachable from the sidebar; existing items remain.
  await page.goto(base+'/');
  for(const n of ['Home','Scenario Lab','AI Companion','My Journey','AI Reliability','Market Pulse'])assert(await page.locator('.sidebar nav').getByRole('button',{name:n,exact:true}).isVisible(),n);
  await page.locator('.sidebar nav').getByRole('button',{name:'Market Pulse',exact:true}).click();
  await page.getByRole('heading',{name:'Daily Market Brief'}).waitFor();
  assert.equal(new URL(page.url()).hash,'#market-pulse');ok('sidebar opens Market Pulse at #market-pulse');

  // 3. Exact hierarchy: heading → hero → explorer → history → news → insight → disclaimer.
  const order=await page.evaluate(()=>[...document.querySelector('.mp').children].map(e=>e.className.split(' ').find(c=>c.startsWith('mp-'))||e.className));
  assert.deepEqual(order,['mp-heading','mp-hero','mp-explorer','mp-history','mp-news','mp-insight','mp-disclaimer']);
  const hero=await page.locator('.mp-hero').boundingBox();assert(hero.y<500,'hero starts in the first viewport');ok('section order matches the brief and the hero is in the first viewport');

  // 4. Hero contents.
  const heroText=await page.locator('.mp-hero').innerText();
  for(const t of ['6 Nov 2026','End-of-day data · not live','NIFTY 50','BSE SENSEX','11,111.11','11,211.11','−100.00','22,222.22','TEST VERDICT','What remains uncertain','Evidence','Last successful update','Last checked','TEST SOURCE (synthetic)'])assert(heroText.includes(t),`hero shows ${t}`);
  assert(await page.locator('.mp-index.down').count()===2);ok('hero shows session date, both indices with changes, verdict, uncertainty and evidence');

  // 5. SIP Decision Explorer arithmetic and validation.
  const ex=page.locator('.mp-explorer');
  assert(await ex.getByText('These are educational scenarios, not investment recommendations.').isVisible());
  await ex.getByLabel('Monthly salary (₹)').fill('30000');await ex.getByLabel('Essential monthly expenses (₹)').fill('18000');await ex.getByLabel('Current monthly SIP (₹)').fill('3000');
  assert((await ex.locator('.mp-baseline').innerText()).includes('₹9,000'));
  const pause=ex.getByRole('tab',{name:/Pause SIP/});assert((await pause.innerText()).includes('₹12,000'));assert((await pause.innerText()).includes('+₹3,000'));
  await pause.click();assert((await ex.locator('#mp-option-detail').innerText()).includes('pausing is not a redemption'));
  await ex.getByRole('tab',{name:/Stop SIP/}).click();assert((await ex.locator('#mp-option-detail').innerText()).includes('Stopping a SIP is not a redemption'));
  await ex.getByLabel('Proposed reduced SIP (₹)').fill('5000');assert(await ex.getByRole('alert').getByText('cannot be more than the current monthly SIP').isVisible());
  await ex.getByLabel('Proposed reduced SIP (₹)').fill('1500');
  assert(!/recommended|safest/i.test(await ex.innerText()));ok('explorer: ₹9,000 → ₹12,000 when paused (+₹3,000), validation, neutral wording');

  // 6. History chart: periods, keyboard reading, attribution.
  const hist=page.locator('.mp-history');
  for(const p of ['1M','3M','6M','1Y'])assert(await hist.getByRole('button',{name:p}).isEnabled());
  await hist.getByRole('button',{name:'1Y'}).click();const svg=hist.locator('svg');await svg.focus();await page.keyboard.press('Home');
  const cap1=await hist.locator('figcaption').innerText();await page.keyboard.press('ArrowRight');const cap2=await hist.locator('figcaption').innerText();assert.notEqual(cap1,cap2);
  await hist.getByRole('button',{name:'BSE SENSEX'}).click();assert((await hist.locator('figcaption').innerText()).includes('BSE SENSEX'));
  assert(await hist.getByText('TEST SOURCE (synthetic)').isVisible());ok('history: periods, index switch, keyboard-readable chart, attribution');

  // 7. News, insight, disclaimer.
  assert(await page.locator('.mp-news').getByRole('link',{name:/TEST HEADLINE/}).isVisible());
  await page.locator('.mp-insight summary').click();const ins=page.locator('.mp-insight');assert(await ins.getByText('TEST FACT claim.').isVisible());assert(await ins.getByText('TEST UNCERTAINTY item.').isVisible());
  assert((await page.locator('.mp-disclaimer').innerText()).includes('cannot pause, modify, stop or start a SIP'));ok('news with publisher and date, expandable insight, disclaimer');

  // 8. Stale and unavailable states never show invented figures.
  await page.unroute('**/api/market-pulse');
  await page.route('**/api/market-pulse',fulfil({status:'ok',snapshot,freshness:{status:'stale',weekdaysBehind:3,latestPossible:'2026-11-11'},checkedAt:'2026-11-06T13:05:00Z',lastRunFailed:true}));
  await page.reload();await page.getByText(/Stale: 3 weekdays behind/).waitFor();assert(await page.locator('.mp-stale').getByText(/last verified brief/).isVisible());assert(await page.getByText(/latest scheduled refresh did not complete/).isVisible());
  await page.unroute('**/api/market-pulse');
  await page.route('**/api/market-pulse',fulfil({status:'not_configured',message:'Market Pulse storage is not configured on this server.'}));
  await page.reload();await page.getByText('The daily AI brief is not available right now.').waitFor();
  assert(!(await page.locator('.mp-hero').innerText()).match(/\d{2},\d{3}\.\d{2}/),'no index figures without a brief');
  assert((await page.locator('.mp-explorer .mp-baseline').innerText()).includes('₹'));ok('stale notice; unavailable state shows no figures and the explorer still works');

  // 8b. Open-data mode: SENSEX via TradingView widget (attribution kept), NIFTY 50 honestly unavailable, OECD monthly brief.
  const months=Array.from({length:24},(_,i)=>{const d=new Date(Date.UTC(2024,10+i,1));return {period:d.toISOString().slice(0,7),value:i===23?267.44:250+i}});
  const openSnap={...snapshot,mode:'open',indices:[],monthly:{name:'India share price index (OECD, monthly, 2015 = 100)',points:months,source:{name:'OECD Data Explorer',url:'https://data-explorer.oecd.org/',attribution:'OECD (2026), test attribution'}},
   brief:{...snapshot.brief,kind:'deterministic',analysis:null,headline:'TEST OPEN BRIEF for 6 November 2026',summary:'TEST OPEN SUMMARY.',note:'TEST OPEN NOTE.',fallbackReason:'AI is not configured on this server.',checks:[]},sources:[{name:'OECD Data Explorer',url:'https://data-explorer.oecd.org/',attribution:'OECD (2026), test attribution'}]};
  await page.unroute('**/api/market-pulse');
  await page.route('**/api/market-pulse',fulfil({status:'ok',snapshot:openSnap,freshness:{status:'current',weekdaysBehind:0,latestPossible:'2026-11-06'},checkedAt:null,lastRunFailed:false}));
  await page.reload();await page.locator('.mp-index-tv tv-single-ticker[symbol="BSE:SENSEX"]').waitFor();await page.locator('.mp-history .tv-stub').waitFor();
  const hero2=await page.locator('.mp-hero').innerText();
  for(const t of ['Brief for','BSE SENSEX','end of day, via TradingView','NIFTY 50','Not shown on this free site','View NIFTY 50 on TradingView','TEST OPEN BRIEF','TEST OPEN NOTE'])assert(hero2.includes(t),'open hero shows '+t);
  assert.equal(await page.locator('.mp-index-tv tv-single-ticker').getAttribute('theme'),'dark');
  assert.equal(await page.locator('.mp-index-tv .tradingview-widget-copyright').count(),0,'the web component draws its own attribution; none is added');
  assert(await page.locator('.mp-history .tradingview-widget-copyright a[href="https://www.tradingview.com/symbols/BSE-SENSEX/"]').isVisible(),'chart attribution visible');
  assert.equal((await page.locator('.mp-history .tradingview-widget-copyright').innerText()).replace(/\s+/g,' ').trim(),'SENSEX quote by TradingView','chart attribution exactly as generated by TradingView');
  assert.equal(await page.locator('.mp-index-na').getByText(/\d{2},\d{3}/).count(),0,'no NIFTY figure');
  assert(tvRequests.some(u=>u.endsWith('/w/en/tv-single-ticker.js'))&&tvRequests.some(u=>u.endsWith('embed-widget-symbol-overview.js')),'both widgets requested');
  assert.equal(await page.locator('a[href*="nseindia.com"], a[href*="bseindia.com"]').count(),0,'no links to exchange sites');
  const histText=await page.locator('.mp-history').innerText();
  assert(histText.includes('BSE SENSEX: 1 month to 1 year')&&histText.includes('not the NIFTY 50 or SENSEX level')&&histText.includes('267.44'),'history shows SENSEX widget and labelled OECD chart');
  assert(await page.locator('.mp-history .mp-tv .tradingview-widget-copyright a').isVisible());
  assert((await page.locator('.mp-connect').innerText()).includes('OECD, monthly'));
  ok('open-data mode: SENSEX widget with attribution, NIFTY 50 unavailable without figures, labelled OECD monthly chart');

  // 8c. Market videos (YouTube): hidden without a key; with one, a separate block with YouTube terms and privacy links.
  assert.equal(await page.locator('.mp-videos').count(),0,'videos block hidden when YouTube is not configured');
  await page.route('**/api/market-pulse/videos',fulfil({status:'ok',partial:false,fetchedAt:'2026-11-06T13:00:00Z',channels:[{name:'moneycontrol',url:'https://www.youtube.com/@moneycontrol'},{name:'CNBC-TV18',url:'https://www.youtube.com/@CNBC-TV18'}],
   videos:[{videoId:'test0000001',title:'TEST VIDEO: Sensex closing wrap',channel:'CNBC-TV18',publishedAt:'2026-11-06T11:00:00Z',thumbnail:null,url:'https://www.youtube.com/watch?v=test0000001'}]}));
  await page.reload();await page.locator('.mp-videos').waitFor();
  const vids=page.locator('.mp-videos');
  assert(await vids.getByRole('link',{name:/TEST VIDEO: Sensex closing wrap/}).isVisible());assert((await vids.innerText()).includes('End-of-day market videos'));
  assert(await vids.getByRole('link',{name:/Terms of Service/}).isVisible()&&await vids.getByRole('link',{name:/Google Privacy Policy/}).isVisible());
  assert((await vids.innerText()).includes('from YouTube'));
  assert.equal(await page.locator('.mp-news-list .mp-video-title').count(),0,'videos are not mixed into the headline list');
  await page.unroute('**/api/market-pulse/videos');
  ok('market videos: hidden without a key; separate YouTube block with terms and privacy links');

  // 9. Mobile: no horizontal scroll, all six nav destinations, back to other features.
  await page.unroute('**/api/market-pulse');await page.route('**/api/market-pulse',fulfil({status:'ok',snapshot,freshness:{status:'current',weekdaysBehind:0,latestPossible:'2026-11-06'}}));
  for(const w of [320,375,768]){await page.setViewportSize({width:w,height:800});await page.reload();await page.locator('.mp-hero').waitFor();
   const over=await page.evaluate(()=>document.documentElement.scrollWidth-document.documentElement.clientWidth);assert(over<=0,`overflow ${over}px at ${w}`)}
  await page.setViewportSize({width:375,height:800});
  const mobile=page.locator('.mobile-nav');for(const n of ['Home','Scenario Lab','AI Companion','My Journey','AI Reliability','Market Pulse'])assert(await mobile.getByRole('button',{name:new RegExp(n)}).isVisible(),n);
  await mobile.getByRole('button',{name:/Scenario Lab/}).click();await page.getByRole('heading',{name:/Let’s make sense/}).waitFor();
  await mobile.getByRole('button',{name:/Market Pulse/}).click();await page.locator('.mp-hero').waitFor();ok('no overflow at 320/375/768 px; six mobile destinations; switching works');
  assert.deepEqual(errors,[]);ok('no page errors');
  console.log(`RESULT ${passed} passed`);
 }catch(e){console.error('FAIL',e.message);process.exitCode=1}finally{await browser.close()}
})();
