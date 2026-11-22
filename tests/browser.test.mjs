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
 // Real keyboard typing, not only programmatic .fill(), must update the result.
 await page.locator('[data-amount]').focus();
 await page.keyboard.press('ControlOrMeta+A');
 await page.keyboard.type('125');
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'1.042','keyboard input updates conversion');
 await page.waitForFunction(()=>document.querySelector('[data-live-result]')?.textContent.includes('1.042 US cups'));
 assert.match(await page.locator('[data-live-result]').textContent(),/Conversion result: 1\.042 US cups for All-purpose flour/,
  'screen-reader status announces the settled result separately from immediate visible changes');
 await page.locator('[data-reset]').click();
 // Test the native copy action and the non-Web-Share fallback without browser permission prompts.
 await page.evaluate(()=>{
  window.__copiedConversion='';
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
   writeText:async value=>{window.__copiedConversion=value}
  }});
  Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
 });
 await page.locator('[data-copy]').click();
 assert.match(await page.evaluate(()=>window.__copiedConversion),/100 grams.*0\.833.*US cups/s,'copied text includes quantity, result and unit');
 assert.match(await page.locator('[data-feedback]').innerText(),/Copied conversion/);
 await page.locator('[data-share]').click();
 const shared=await page.evaluate(()=>window.__copiedConversion);
 assert.ok(shared.includes('amount=100')&&shared.includes('ingredient=all-purpose-flour')&&shared.includes('from=g')&&shared.includes('to=cup'),
  'shared URL preserves current converter state without uploading data');
 assert.match(await page.locator('[data-feedback]').innerText(),/Shareable link copied/);
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
 await page.locator('[data-amount]').fill('1,000');
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'8.333','US grouped input remains a valid quantity');
 await page.locator('[data-amount]').fill('1,5');
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'—','malformed thousand grouping is rejected');
 await page.locator('[data-reset]').click();
 await page.locator('[data-amount]').fill('1/4');
 assert.ok((await page.locator('[data-result]').innerText()).trim()!=='—','fractions compute');
 await page.locator('[data-amount]').fill('nonsense');
 assert.equal((await page.locator('[data-result]').innerText()).trim(),'—','bad values must not look valid');
 assert.ok(await page.locator('[data-error]').isVisible(),'invalid quantity shows clear error');
 await page.locator('[data-amount]').fill('0.000000001');
 const tinyValue=(await page.locator('[data-result]').innerText()).trim();
 assert.notEqual(tinyValue,'0','tiny positive weight must not render as zero cups');
 assert.match(tinyValue,/[1-9]/,'tiny quantity is meaningfully visible');
 assert.match(await page.locator('[data-meter-label]').innerText(),/Less than 1%/,'sub-1% cup fill is not falsely labelled zero');
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
 assert.equal((await page.locator('[data-meta-ingredient]').innerText()).trim(),'Fixed units','fixed conversions do not suggest ingredient weight references');
 await page.evaluate(()=>{
  window.__copiedFixed='';
  Object.defineProperty(navigator,'clipboard',{configurable:true,value:{writeText:async value=>{window.__copiedFixed=value}}});
  Object.defineProperty(navigator,'share',{configurable:true,value:undefined});
 });
 await page.locator('[data-copy]').click();
 const fixedText=await page.evaluate(()=>window.__copiedFixed);
 assert.match(fixedText,/2 US tablespoons.*milliliters/,'copy accurately describes fixed volume units');
 assert.ok(!/all-purpose flour/i.test(fixedText),'fixed conversions must never claim to use flour density');
 await page.locator('[data-share]').click();
 const fixedShare=await page.evaluate(()=>window.__copiedFixed);
 assert.ok(fixedShare.includes('from=tbsp')&&fixedShare.includes('to=ml'),'fixed-volume share link preserves direction');
 assert.ok(!fixedShare.includes('ingredient='),'fixed-volume share link does not add irrelevant ingredient parameters');
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

 await page.goto(origin+'/cooking/ingredients/all-purpose-flour/',{waitUntil:'networkidle'});
 assert.ok(await page.getByRole('heading',{name:'All-purpose flour: cups to grams'}).isVisible(),'ingredient reverse lookup is visible');
 const reverseChart=page.locator('table').nth(1);
 assert.ok((await reverseChart.innerText()).includes('1/2 cup'),'reverse chart includes practical cup sizes');
 assert.ok((await reverseChart.innerText()).includes('60 g'),'flour half-cup uses cited 120g-per-cup source');
 assert.ok((await reverseChart.innerText()).includes('metric cups'),'reverse chart explains metric differences');
 const flourSpecific=page.locator('a[href="/cooking/ingredients/all-purpose-flour/125-grams-to-cups/"]');
 assert.ok(await flourSpecific.isVisible(),'ingredient page links to an independently useful 125g flour guide');
 await flourSpecific.click();
 assert.ok(await page.getByRole('heading',{name:/125 grams of all-purpose flour to cups/i}).isVisible(),
  'ingredient+number link reaches usable specific page');
 await page.goto(origin+'/cooking/ingredients/granulated-sugar/',{waitUntil:'networkidle'});
 const sugarSpecific=page.locator('a[href="/cooking/ingredients/granulated-sugar/200-grams-to-cups/"]');
 assert.ok(await sugarSpecific.isVisible(),'sugar page links to its specific 200g conversion');
 await sugarSpecific.click();
 assert.ok(await page.getByRole('heading',{name:/200 grams of granulated white sugar to cups/i}).isVisible(),
  'sugar specific conversion renders');
 await page.goto(origin+'/cooking/grams-to-cups/100-grams-to-cups/',{waitUntil:'networkidle'});
 assert.ok(await page.getByRole('heading',{name:'Closest common cup measures for 100 grams'}).isVisible(),'numeric landing offers useful measuring comparisons');
 assert.ok((await page.locator('table').nth(1).innerText()).includes('Weight difference'),'numeric page warns about grams difference');
 assert.ok(await page.locator('a[href="/cooking/ingredients/all-purpose-flour/100-grams-to-cups/"]').isVisible(),
  'general 100g conversion has a crawlable contextual link to the 100g flour page');
 assert.ok(await page.locator('a[href="/cooking/ingredients/granulated-sugar/100-grams-to-cups/"]').isVisible(),
  'general 100g conversion has a crawlable contextual link to the 100g sugar page');
 assert.equal(errors.length,0,'no browser errors after expanded reference pages');

 await page.goto(origin+'/cooking/batch-converter/',{waitUntil:'networkidle'});
 assert.ok(await page.getByRole('heading',{name:/Batch Ingredient Converter/i}).isVisible(),'batch converter page renders');
 assert.ok((await page.locator('[data-batch-summary]').innerText()).includes('4 converted'),'default list identifies four supported ingredients');
 assert.ok((await page.locator('[data-batch-summary]').innerText()).includes('1 need review'),'ambiguous flour stays flagged for review');
 await page.locator('[data-batch-lines]').fill('120 g all-purpose flour\n½ cup granulated sugar\n200 g flour');
 assert.equal((await page.locator('[data-batch-summary]').innerText()).trim(),'2 converted · 1 need review · 0 blank');
 assert.equal((await page.locator('[data-batch-results] .batch-converted-row').count()),2);
 assert.equal((await page.locator('[data-batch-results] .batch-review-row').count()),1);
 assert.ok((await page.locator('[data-batch-results]').innerText()).includes('1 US cup All-purpose flour'),'exact flour conversion');
 assert.ok((await page.locator('[data-batch-results]').innerText()).includes('1/2 US cup Granulated white sugar'),'fraction-friendly results');
 await page.locator('[data-batch-standard]').selectOption('metric');
 assert.equal((await page.locator('[data-batch-target] option[value="cup"]').innerText()).trim(),'Metric cups',
  'target selector must not say US cups while calculating metric cups');
 assert.match(await page.locator('[data-batch-results]').innerText(),/metric cup Granulated white sugar/,'metric cup results are unambiguous');
 await page.locator('[data-batch-standard]').selectOption('us');
 assert.equal((await page.locator('[data-batch-target] option[value="cup"]').innerText()).trim(),'US cups',
  'target selector restores US cups when selecting the US standard');
 assert.ok((await page.locator('[data-batch-results]').innerText()).includes('1/2 US cup Granulated white sugar'),'US cup label restored after switching standard');
 // The tool must accept its own formatted cup labels when copied back into the input.
 await page.locator('[data-batch-lines]').fill('1 US cup All-purpose flour\n1 metric cup All-purpose flour');
 await page.locator('[data-batch-target]').selectOption('g');
 await page.locator('[data-batch-standard]').selectOption('metric');
 const roundTripRows=page.locator('[data-batch-results] .batch-converted-row');
 assert.equal(await roundTripRows.count(),2,'both explicit cup standards parse when pasted');
 assert.ok((await roundTripRows.first().innerText()).includes('120 g All-purpose flour'),
  'metric dropdown must not reinterpret an explicitly labeled US cup');
 assert.ok((await roundTripRows.nth(1).innerText()).includes('126.8'),
  'explicit metric cup retains its distinct mass');
 await page.locator('[data-batch-target]').selectOption('cup');
 await page.locator('[data-batch-lines]').fill('1 US cup All-purpose flour');
 assert.ok((await page.locator('[data-batch-results]').innerText()).includes('0.9464 metric cup All-purpose flour'),
  'US-to-metric cup conversion must change the numeric cup result');
 await page.locator('[data-batch-standard]').selectOption('us');
 await page.locator('[data-batch-target]').selectOption('cup');
 await page.locator('[data-batch-lines]').fill('1,000 g all-purpose flour');
 assert.ok((await page.locator('[data-batch-results]').innerText()).includes('8 1/3 US cups All-purpose flour'),'batch supports US thousands separators');
 await page.locator('[data-batch-lines]').fill('120 g all-purpose flour\n½ cup granulated sugar\n200 g flour');
 const batchDownload=page.waitForEvent('download');
 await page.locator('[data-batch-csv]').click();
 assert.equal((await batchDownload).suggestedFilename(),'batch-ingredient-conversions.csv');
 await page.locator('[data-batch-target]').selectOption('g');
 assert.ok((await page.locator('[data-batch-results]').innerText()).includes('99 g Granulated white sugar'),'reverse conversion uses sugar reference');
 await page.locator('[data-batch-clear]').click();
 assert.equal(await page.locator('[data-batch-lines]').inputValue(),'','clear action empties input');
 await page.goto(origin+'/cooking/half-a-measurement/',{waitUntil:'networkidle'});
 assert.equal((await page.locator('[data-fraction-result]').innerText()).trim(),'3/4',
  'fraction calculator adds 1/2 + 1/4 exactly');
 await page.locator('[data-fraction-first]').fill('1/3');
 assert.equal((await page.locator('[data-fraction-result]').innerText()).trim(),'7/12',
  'fraction addition uses exact rational arithmetic instead of decimal approximation');
 await page.locator('[data-fraction-operation]').selectOption('*');
 assert.equal((await page.locator('[data-fraction-result]').innerText()).trim(),'1/12',
  'fraction multiplication uses exact rational arithmetic');
 await page.locator('[data-fraction-operation]').selectOption('/');
 assert.equal((await page.locator('[data-fraction-result]').innerText()).trim(),'1 1/3',
  'fraction division supports mixed number results');
 await page.locator('[data-fraction-operation]').selectOption('-');
 await page.locator('[data-fraction-second]').fill('1/2');
 assert.equal((await page.locator('[data-fraction-result]').innerText()).trim(),'—',
  'negative kitchen results do not appear as valid amounts');
 assert.match(await page.locator('[data-fraction-error]').innerText(),/cannot be negative/,
  'negative quantities provide a clear error message');
 await page.locator('[data-fraction-first]').fill('3/4');
 assert.equal((await page.locator('[data-fraction-result]').innerText()).trim(),'1/4',
  'fraction calculator recovers after fixing bad values');
 await page.goto(origin+'/cooking/recipe-scaler/',{waitUntil:'networkidle'});
 await page.locator('[data-recipe-lines]').fill('1½ cups milk\n½ tsp salt\npinch of salt\n2-3 eggs');
 await page.locator('[data-old-servings]').fill('2');
 await page.locator('[data-new-servings]').fill('3');
 const scaled=await page.locator('[data-recipe-output]').innerText();
 assert.ok(scaled.includes('2 1/4 cups milk'),'recipe displays exact mixed kitchen fraction');
 assert.ok(scaled.includes('3/4 tsp salt'),'recipe displays Unicode fraction');
 assert.ok(scaled.includes('pinch of salt  [check manually]'),'unknown serving units stay visible for review');
 assert.ok(scaled.includes('2-3 eggs  [check manually]'),'ranges are not partially scaled into unsafe recipe quantities');
 await page.locator('[data-recipe-lines]').fill('1 cup milk + 2 tbsp cream');
 const compound=(await page.locator('[data-recipe-output]').innerText()).trim();
 assert.ok(compound.includes('1 cup milk + 2 tbsp cream  [check manually]'),'compound quantities must not be only partially scaled');
 await page.locator('[data-recipe-lines]').fill('1,000 g flour\n1,5 cups milk');
 const groupedScaled=(await page.locator('[data-recipe-output]').innerText()).trim();
 assert.ok(groupedScaled.includes('1,500 g flour'),'valid grouped recipe quantity scales correctly');
 assert.ok(groupedScaled.includes('1,5 cups milk  [check manually]'),'invalid grouping is preserved for review');
 assert.equal(errors.length,0,'no desktop runtime errors after batch conversion and recipe scaling');
 await page.locator('[data-recipe-lines]').fill('1 cup milk\n2 cups water');
 await page.locator('[data-old-servings]').fill('2');
 await page.locator('[data-new-servings]').fill('4');
 const units=(await page.locator('[data-recipe-output]').innerText()).trim();
 assert.ok(units.includes('2 cups milk'),'recipe multiplier pluralizes singular unit');
 assert.ok(units.includes('4 cups water'),'recipe multiplier preserves plural unit');
 await page.locator('[data-recipe-lines]').fill('1 US cup milk\n½ metric cup cream');
 const qualified=(await page.locator('[data-recipe-output]').innerText()).trim();
 assert.ok(qualified.includes('2 US cups milk'),'US cup label survives scaling');
 assert.ok(qualified.includes('1 metric cup cream'),'metric cup label survives scaling');
 await page.locator('[data-recipe-lines]').fill('1 large egg\n2 cloves garlic\n1 pinch salt');
 const counts=(await page.locator('[data-recipe-output]').innerText()).trim();
 assert.ok(counts.includes('2 large eggs'),'unitless eggs become plural when scaled');
 assert.ok(counts.includes('4 cloves garlic'),'unitless clove phrase has no doubled spaces');
 assert.ok(counts.includes('2 pinches salt'),'pinch becomes pinches');
 const recipeCsv=page.waitForEvent('download');
 await page.locator('[data-download-csv]').click();
 assert.equal((await recipeCsv).suggestedFilename(),'scaled-recipe.csv','recipe export is downloadable locally');
 // Pages include usable, source-backed HTML answers even with JavaScript disabled.
 const staticPage=await browser.newPage({viewport:{width:375,height:812},javaScriptEnabled:false});
 await staticPage.goto(origin+'/cooking/ingredients/all-purpose-flour/',{waitUntil:'domcontentloaded'});
 assert.ok(await staticPage.getByRole('heading',{name:'All-purpose flour: cups to grams'}).isVisible(),'source-based result remains readable without JavaScript');
 assert.ok((await staticPage.locator('table').nth(1).innerText()).includes('60 g'),'static half-cup conversion survives with JavaScript disabled');
 await staticPage.goto(origin+'/cooking/tablespoons-to-ml/',{waitUntil:'domcontentloaded'});
 assert.ok(await staticPage.locator('[data-meter-wrap]').isHidden(),'static fixed-unit page must not show a fabricated 83% cup meter');
 assert.equal((await staticPage.locator('[data-result]').innerText()).trim(),'29.574','static fixed volume conversion is correct without JavaScript');
 assert.equal((await staticPage.locator('[data-meta-ingredient]').innerText()).trim(),'Fixed units','static fixed-unit conversion must not claim a flour reference');
 assert.match(await staticPage.locator('[data-result-note]').innerText(),/defined conversion/i,'static note explains fixed measurement');
 await staticPage.goto(origin+'/',{waitUntil:'domcontentloaded'});
 assert.ok(await staticPage.locator('[data-meter-wrap]').isVisible(),'static home calculator shows useful cup progress');
 assert.match(await staticPage.locator('[data-meter-label]').innerText(),/83% of one US cup/,'static progress reflects the actual cup estimate');
 await staticPage.goto(origin+'/cooking/half-a-measurement/',{waitUntil:'domcontentloaded'});
 assert.equal((await staticPage.locator('[data-fraction-result]').innerText()).trim(),'3/4',
  'a useful 1/2 + 1/4 example is pre-rendered without JavaScript');
 await staticPage.close();

 const mobile=await browser.newPage({viewport:{width:375,height:812},deviceScaleFactor:1,isMobile:true,hasTouch:true});
 const mobileErrors=[];
 mobile.on('pageerror',err=>mobileErrors.push(err.message));
 // Four required breakpoint classes: 320px, 375px, 768px and desktop 1440px.
 // 375px is verified below with interactions; 1440px is verified by the desktop page above.
 for(const width of [320,768]){
  await mobile.setViewportSize({width,height:width===320?720:1024});
  for(const route of ['/','/cooking/grams-to-cups/','/cooking/ingredients/all-purpose-flour/',
   '/cooking/grams-to-cups/200-grams-to-cups/','/cooking/charts/','/cooking/half-a-measurement/','/cooking/batch-converter/','/cooking/recipe-scaler/']){
   await mobile.goto(origin+route,{waitUntil:'networkidle'});
   const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
   assert.ok(overflow<=1,route+' '+width+'px horizontal overflow '+overflow);
   assert.ok(await mobile.locator('h1').first().isVisible(),route+' '+width+'px heading is visible');
   assert.equal(mobileErrors.length,0,route+' '+width+'px JS exceptions: '+mobileErrors.join(','));
   if(width===320&&route==='/'){
    for(const selector of ['[data-nav-toggle]','[data-swap]','[data-amount-preset]','[data-ingredient-preset]']){
     const rect=await mobile.locator(selector).first().boundingBox();
     assert.ok(rect&&rect.width>=44&&rect.height>=44,selector+' must offer at least a 44×44px mobile touch target');
    }
   }
  }
 }
 await mobile.setViewportSize({width:375,height:812});
 for(const route of ['/','/cooking/grams-to-cups/','/cooking/ingredients/all-purpose-flour/','/cooking/grams-to-cups/200-grams-to-cups/','/cooking/charts/','/cooking/half-a-measurement/','/cooking/batch-converter/','/cooking/recipe-scaler/']){
  await mobile.goto(origin+route,{waitUntil:'networkidle'});
  const overflow=await mobile.evaluate(()=>document.documentElement.scrollWidth-window.innerWidth);
  assert.ok(overflow<=1,route+' mobile overflow '+overflow);
  assert.ok(await mobile.locator('h1').first().isVisible(),route+' mobile heading hidden');
  assert.equal(mobileErrors.length,0,route+' browser errors: '+mobileErrors.join(','));
  if(route==='/'){
   const button=mobile.locator('[data-nav-toggle]');
   await button.click();
   assert.equal(await button.getAttribute('aria-expanded'),'true','mobile menu opens');
   await mobile.keyboard.press('Escape');
   assert.equal(await button.getAttribute('aria-expanded'),'false','Escape closes mobile navigation');
   await button.focus();
   await mobile.keyboard.press('Enter');
   assert.equal(await button.getAttribute('aria-expanded'),'true','keyboard Enter opens mobile menu');
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
 console.log('Browser audit passed: full recipe scaler Unicode fractions, safe local batch conversion with review warnings and CSV, desktop/mobile overflow, conversion presets, ingredient comparison and interactive charts.');
}catch(err){failed=true;console.error(err.stack||err)}
finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
if(failed)process.exit(1);
