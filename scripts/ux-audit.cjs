// UX / accessibility measurement across widths and pages. No AI requests are made.
// Usage: LIFEFLOW_TEST_URL=http://localhost:3002 node scripts/ux-audit.cjs [outDir]
const {chromium}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path');
const edge=process.env.LIFEFLOW_BROWSER||'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const base=process.env.LIFEFLOW_TEST_URL||'http://localhost:3000';
const out=process.argv[2]||'test-results/ux-audit';fs.mkdirSync(out,{recursive:true});
const widths=[[320,640],[375,812],[430,932],[768,1024],[1440,900]];
const pages=[['Home','#home'],['Scenario Lab','#scenario-lab'],['AI Companion','#ai-companion'],['My Journey','#my-journey'],['AI Reliability','#ai-reliability']];

const measure=()=>{
 const vw=document.documentElement.clientWidth;
 const visible=e=>{const r=e.getBoundingClientRect();const s=getComputedStyle(e);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'};
 const lum=c=>{const m=c.match(/\d+(\.\d+)?/g);if(!m)return null;const [r,g,b]=m.slice(0,3).map(Number).map(v=>{v/=255;return v<=0.03928?v/12.92:((v+0.055)/1.055)**2.4});return 0.2126*r+0.7152*g+0.0722*b};
 const alpha=c=>{const m=c.match(/rgba?\(([^)]+)\)/);if(!m)return 1;const parts=m[1].split(',');return parts.length===4?Number(parts[3]):1};
 const bgOf=e=>{for(let n=e;n;n=n.parentElement){const s=getComputedStyle(n);if(alpha(s.backgroundColor)>0.5)return s.backgroundColor}return 'rgb(255,255,255)'};
 const targets=[...document.querySelectorAll('button,a,select,input,textarea,summary,[role=button]')].filter(visible).filter(e=>!e.closest('.sidebar')||vw>650);
 const small=targets.map(e=>({e,r:e.getBoundingClientRect()})).filter(({e,r})=>(r.height<44||r.width<44)&&!(e.tagName==='INPUT'&&['checkbox','radio','file'].includes(e.type))&&!(e.tagName==='A'&&getComputedStyle(e).display==='inline')).map(({e,r})=>`${e.tagName.toLowerCase()}${e.className?'.'+String(e.className).split(' ')[0]:''} "${(e.innerText||e.getAttribute('aria-label')||'').trim().slice(0,24)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
 const texts=[...document.querySelectorAll('body *')].filter(e=>visible(e)&&[...e.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1));
 const tiny=texts.filter(e=>parseFloat(getComputedStyle(e).fontSize)<11).map(e=>`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${getComputedStyle(e).fontSize} "${e.textContent.trim().slice(0,22)}"`);
 const lowContrast=texts.map(e=>{const s=getComputedStyle(e);const fg=lum(s.color),bg=lum(bgOf(e));if(fg==null||bg==null)return null;const ratio=(Math.max(fg,bg)+0.05)/(Math.min(fg,bg)+0.05);const size=parseFloat(s.fontSize);const large=size>=24||(size>=18.66&&Number(s.fontWeight)>=700);return ratio<(large?3:4.5)?`${e.tagName.toLowerCase()}.${String(e.className).split(' ')[0]} ${ratio.toFixed(2)}:1 "${e.textContent.trim().slice(0,22)}"`:null}).filter(Boolean);
 const unlabelled=[...document.querySelectorAll('input,select,textarea')].filter(visible).filter(e=>!(e.labels&&e.labels.length)&&!e.getAttribute('aria-label')).map(e=>`${e.tagName.toLowerCase()}[${e.type||''}]`);
 const nameless=[...document.querySelectorAll('button,a')].filter(visible).filter(e=>!(e.innerText||'').trim()&&!e.getAttribute('aria-label')&&!e.getAttribute('title')).length;
 return {overflow:document.documentElement.scrollWidth-vw,small,tiny,lowContrast,unlabelled,nameless};
};

(async()=>{
 const browser=await chromium.launch({executablePath:edge,headless:true});const report={base,when:new Date().toISOString(),results:[]};
 for(const [w,h] of widths){
  const ctx=await browser.newContext({viewport:{width:w,height:h},isMobile:w<700,hasTouch:w<700});const page=await ctx.newPage();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await page.goto(base);await page.getByRole('heading',{name:/Life happens/}).waitFor();
  if(w===320)await page.screenshot({path:path.join(out,'320-home-onboarding.png'),fullPage:false});
  const ack=page.getByRole('button',{name:/I understand/});if(await ack.count())await ack.click();
  await page.getByLabel('Monthly take-home salary (₹)').fill('30000');await page.getByLabel('Recurring expenses (₹)').fill('18000');await page.getByLabel('Monthly SIP commitment (₹)').fill('3000');await page.getByLabel('Upcoming SIP date').fill('2026-12-05');
  await page.goto(base+'#scenario-lab');await page.getByLabel('Expense amount (₹)').fill('5000');await page.getByLabel('Expense category').fill('Health');await page.getByRole('button',{name:'See the impact'}).click();
  for(const [name,hash] of pages){
   await page.goto(base+hash);await page.waitForTimeout(400);
   const m=await page.evaluate(measure);report.results.push({width:w,page:name,...m,small:m.small.length,smallExamples:m.small.slice(0,6),tiny:m.tiny.length,tinyExamples:m.tiny.slice(0,6),lowContrast:m.lowContrast.length,lowContrastExamples:m.lowContrast.slice(0,6)});
   if([320,375,1440].includes(w))await page.screenshot({path:path.join(out,`${w}-${name.replace(/ /g,'-').toLowerCase()}.png`),fullPage:false});
  }
  // Keyboard: Tab through the start of the Home page and confirm focus is visible on interactive elements.
  await page.goto(base+'#home');await page.keyboard.press('Tab');const focus=[];for(let i=0;i<12;i++){focus.push(await page.evaluate(()=>{const e=document.activeElement;const s=getComputedStyle(e);return `${e.tagName.toLowerCase()} "${(e.innerText||e.getAttribute('aria-label')||e.getAttribute('name')||'').trim().slice(0,20)}" outline=${s.outlineStyle!=='none'&&s.outlineWidth!=='0px'?'yes':'no'}`}));await page.keyboard.press('Tab')}
  report.results.push({width:w,page:'keyboard',focus,errors});
  await ctx.close();
 }
 await browser.close();fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
 for(const r of report.results){if(r.page==='keyboard'){console.log(`${r.width}px keyboard: ${r.focus.filter(f=>f.includes('outline=yes')).length}/${r.focus.length} focus visible; console errors ${r.errors.length}`);continue}console.log(`${String(r.width).padStart(4)}px ${r.page.padEnd(14)} overflow ${r.overflow} | small targets ${r.small} | text<11px ${r.tiny} | low contrast ${r.lowContrast} | unlabelled ${r.unlabelled.length} | nameless ${r.nameless}`)}
})();
