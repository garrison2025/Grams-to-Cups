import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.svg':'image/svg+xml; charset=utf-8','.txt':'text/plain'};
const server=http.createServer((req,res)=>{
 try{
  const u=new URL(req.url,'http://127.0.0.1');
  const pathname=decodeURIComponent(u.pathname);
  const candidate=path.resolve(dist,'.'+pathname);
  if(!candidate.startsWith(dist+path.sep)&&candidate!==dist){res.writeHead(403);res.end();return;}
  let target=candidate;
  if(!path.extname(target))target=path.join(target,'index.html');
  if(!fs.existsSync(target)||!fs.statSync(target).isFile())target=path.join(dist,'404.html');
  res.setHeader('Content-Type',mime[path.extname(target)]||'application/octet-stream');
  res.end(fs.readFileSync(target));
 }catch(err){res.writeHead(500);res.end(String(err))}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin='http://127.0.0.1:'+server.address().port;
const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
let failed=false;
try{
 const page=await browser.newPage({viewport:{width:1440,height:900},deviceScaleFactor:1});
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/',{waitUntil:'networkidle'});
 assert.ok(await page.getByRole('heading',{name:/Grams to cups.*without the guesswork/i}).isVisible(),'hero should show editorial heading');
 await page.locator('[data-result]').waitFor();
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'0.833','default flour reference');
 await page.locator('[data-amount-preset="200"]').click();
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'1.667','amount chip updates live result');
 await page.locator('[data-ingredient-preset="granulated-sugar"]').click();
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'1.01','ingredient chip uses distinct density');
 await page.locator('[data-amount-preset="100"]').click();
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'0.505','100 grams sugar');
 await page.locator('[data-swap]').click();
 await page.locator('[data-amount]').fill('0.5');
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'99','half cup sugar grams');
 await page.locator('[data-reset]').click();
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'0.833','reset returns default reference');
 await page.locator('[data-amount]').fill('1/4');
 assert.ok((await page.locator('[data-result]').innerText()).trim()!=='—','fractions compute');
 await page.locator('[data-amount]').fill('nonsense');
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'—','bad values must not look valid');
 assert.ok(await page.locator('[data-error]').isVisible(),'invalid quantity shows clear error');
 await page.locator('[data-reset]').click();
 await page.locator('[data-compare-preset="250"]').click();
 assert.equal((await page.locator('[data-compare-grams]').innerText()).trim(),'250 g','comparison preset changes grams');
 assert.equal((await page.locator('[data-compare-flour]').innerText()).trim(),'2.083','flour comparison uses 120 g/cup');
 assert.equal((await page.locator('[data-compare-sugar]').innerText()).trim(),'1.263','sugar comparison uses 198 g/cup');
 assert.equal(await page.locator('[data-compare-preset="250"]').getAttribute('aria-pressed'),'true','comparison selected preset is accessible');
 await page.locator('[data-compare-input]').evaluate(el=>{el.value='300';el.dispatchEvent(new Event('input',{bubbles:true}))});
 assert.equal((await page.locator('[data-compare-flour]').innerText()).trim(),'2.5','range slider updates same-weight comparison');
 assert.equal(errors.length,0,'no browser errors on desktop: '+errors.join(', '));
 const desktopOverflow=await page.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
 assert.ok(desktopOverflow<=1,'desktop horizontal overflow '+desktopOverflow);
 if(process.env.EMIT_UI_SHOTS==='1'){
  await page.evaluate(()=>window.scrollTo(0,0));
  const img=await page.screenshot({type:'jpeg',quality:42});
  console.log('DESKTOP_SHOT_BEGIN'+img.toString('base64')+'DESKTOP_SHOT_END');
 }
 await page.goto(origin+'/cooking/tablespoons-to-ml/',{waitUntil:'networkidle'});
 assert.ok(await page.locator('[data-density-field]').first().isHidden(),'hide ingredient controls for fixed volume conversions');
 assert.ok(await page.locator('[data-cup-standard-row]').isHidden(),'hide irrelevant cup standard when no cup involved');
 assert.ok(await page.locator('[data-source-fixed]').isVisible(),'fixed unit source messaging is visible');
 await page.locator('[data-from]').selectOption('g');
 assert.ok(await page.locator('[data-density-field]').first().isVisible(),'show ingredient when switching to mass-volume');
 assert.ok(await page.locator('[data-source-ingredient]').isVisible(),'show source reference only for ingredient-dependent quantities');
 await page.goto(origin+'/cooking/charts/',{waitUntil:'networkidle'});
 await page.locator('[data-chart-filter]').fill('brown sugar');
 assert.equal((await page.locator('[data-chart-count]').innerText()).trim(),'1 of 24 ingredients shown','chart filters ingredient rows');
 const visibleRows=await page.locator('[data-chart-table] tbody tr:visible').count();
 assert.equal(visibleRows,1,'chart only shows matching rows');
 const download=page.waitForEvent('download');
 await page.locator('[data-chart-download]').click();
 const exportFile=await download;
 assert.equal(exportFile.suggestedFilename(),'cooking-conversion-chart.csv','filtered chart downloads CSV');
 await page.locator('[data-chart-filter]').fill('zzz never an ingredient');
 assert.ok(await page.locator('[data-chart-empty]').isVisible(),'empty search feedback is visible');
 assert.equal(errors.length,0,'no desktop runtime errors after charts');
 const mobile=await browser.newPage({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const mobileErrors=[];
 mobile.on('pageerror',err=>mobileErrors.push(err.message));
 for(const route of ['/','/cooking/grams-to-cups/','/cooking/ingredients/all-purpose-flour/','/cooking/grams-to-cups/200-grams-to-cups/','/cooking/charts/']){
  await mobile.goto(origin+route,{waitUntil:'networkidle'});
  const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=1,route+' mobile overflow '+overflow);
  assert.ok(await mobile.locator('h1').first().isVisible(),route+' mobile heading hidden');
  assert.equal(mobileErrors.length,0,route+' browser errors: '+mobileErrors.join(','));
  if(route==='/'){
   const button=mobile.locator('[data-nav-toggle]');
   await button.click();
   assert.equal(await button.getAttribute('aria-expanded'),'true','mobile menu opens');
   await button.click();
   assert.equal(await button.getAttribute('aria-expanded'),'false','mobile menu closes');
   assert.ok(await mobile.locator('.hero-mobile-cta').isVisible(),'mobile hero includes direct converter action');
   await mobile.locator('.hero-mobile-cta').click();
   assert.ok(await mobile.locator('#converter').isVisible(),'mobile jump target exists');
   await mobile.evaluate(()=>window.scrollTo(0,0));
   if(process.env.EMIT_UI_SHOTS==='1'){
    const img=await mobile.screenshot({type:'jpeg',quality:46});
    console.log('MOBILE_SHOT_BEGIN'+img.toString('base64')+'MOBILE_SHOT_END');
   }
  }
 }
 console.log('Browser audit passed: live ingredient volume comparison, mass-volume context switching, searchable CSV chart, conversion presets, browser errors, mobile menu and no horizontal overflow.');
}catch(err){failed=true;console.error(err.stack||err)}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
if(failed)process.exit(1);
