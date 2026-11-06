const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.env.LIFEFLOW_TEST_URL||'http://localhost:3000');
 assert.equal(await page.locator('.app').getAttribute('data-theme'),'blue-oceanic','new visitors should see Blue Oceanic');assert.equal(await page.getByLabel('Choose theme').inputValue(),'blue-oceanic');
 const toggle=page.getByRole('button',{name:'Collapse navigation dock'});await toggle.click();
 assert.equal(await page.getByRole('button',{name:'Expand navigation dock'}).getAttribute('aria-expanded'),'false');
 await page.locator('.sidebar').getByRole('button',{name:'Scenario Lab'}).click();assert(await page.getByRole('heading',{name:/Let’s make sense/}).isVisible());
 await page.reload();assert(await page.getByRole('button',{name:'Expand navigation dock'}).isVisible());await page.getByRole('button',{name:'Expand navigation dock'}).click();assert.equal(await page.getByRole('button',{name:'Collapse navigation dock'}).getAttribute('aria-expanded'),'true');
 const select=page.getByLabel('Choose theme');for(const theme of ['lifeflow','dark-warm','blue-oceanic']){await select.selectOption(theme);assert.equal(await page.locator('.app').getAttribute('data-theme'),theme);await page.reload();assert.equal(await page.getByLabel('Choose theme').inputValue(),theme)}
 await page.locator('.sidebar').getByRole('button',{name:'Home',exact:true}).click();await page.getByLabel('Choose theme').selectOption('dark-warm');await page.screenshot({path:'.next/theme-dark-preview.png',fullPage:false});
 await page.setViewportSize({width:390,height:844});await page.getByLabel('Choose theme').selectOption('blue-oceanic');assert(await page.locator('.mobile-nav').isVisible());await page.locator('.mobile-nav').getByRole('button',{name:/Scenario Lab/}).click();assert(await page.getByRole('heading',{name:/Let’s make sense/}).isVisible());assert.equal(await page.locator('.app').getAttribute('data-theme'),'blue-oceanic');const sizes=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:document.documentElement.clientWidth}));assert(sizes.width<=sizes.viewport+1);assert.deepEqual(errors,[]);
 console.log('PASS dock collapse/expand, desktop navigation, three themes, preference persistence, mobile navigation and overflow');await browser.close();
}
main().catch(e=>{console.error(e);process.exitCode=1});
