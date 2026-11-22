import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {csvSafeCell} from '../src/seo-evidence.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'site-manifest.json'),'utf8'));
const pages=manifest.pages;
// A single querySelector result is not iterable; using it in a for..of loop
// throws during module initialization and silently disables later UI sections.
const browserScript=fs.readFileSync(path.join(dist,'assets/app.js'),'utf8');
assert.doesNotMatch(browserScript,/for\s*\(\s*(?:const|let)\s+\w+\s+of\s+\$\s*\(/,
 'Browser initialization uses querySelector in an iterable loop; use querySelectorAll ($)');
assert.doesNotMatch(browserScript,/(?<!\$)\$\([^\r\n;]*?\)\.(?:forEach|map|filter|reduce|some|every)\s*\(/,
 'Single-element selector used as an array; choose querySelectorAll ($) for collection methods');
assert.equal(pages.length,81,'78 app pages plus 3 legal pages');
assert.equal(new Set(pages.map(p=>p.url)).size,pages.length,'duplicate routes');
assert.equal(new Set(pages.map(p=>p.title)).size,pages.length,'duplicate SEO titles');
const known=new Set(pages.map(p=>p.url));
const pageHtml=url=>fs.readFileSync(path.join(dist,url==='/'?'index.html':url.slice(1)+'index.html'),'utf8');
for(const page of pages){
 const html=pageHtml(page.url),t=html.match(/<title>(.*?)<\/title>/),h=html.match(/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/);
 assert.ok(t,'missing title on '+page.url);
 assert.ok(h,'missing h1 on '+page.url);
 assert.match(html,/<meta name="description"/);
 assert.match(html,/<html lang="en">/);
 assert.match(html,/<main id="main">/);
 assert.ok(!html.includes('undefined')&&!html.includes('NaN'),'broken values on '+page.url);
 assert.ok(page.wordCount>55,'insufficient explanatory text '+page.url);
 if(manifest.publicIndex&&page.indexCandidate){
  assert.ok(html.includes('rel="canonical"'),page.url);
  assert.ok(html.includes('content="index,follow"'),page.url);
 }else{
  assert.ok(html.includes('content="noindex,follow"'),page.url);
  assert.ok(!html.includes('rel="canonical"'),page.url);
 }
 for(const m of html.matchAll(/href="(\/[^"#?]*\/)(?:#[^"]*)?"/g)){
  if(m[1]==='/'||known.has(m[1]))continue;
  throw Error('Broken internal link '+m[1]+' from '+page.url);
 }
}
// A route existing in sitemap.xml does not make it discoverable through internal
// links. Audit the actual static <a> graph, not just route references in source.
const links=new Map(),inbound=new Map();
for(const page of pages){
 const html=pageHtml(page.url);
 const targets=new Set(
  [...html.matchAll(/<a\b[^>]*\bhref="([^"]+)"/gi)]
   .map(m=>m[1])
   .filter(url=>url.startsWith('/'))
   .map(url=>url.split(/[?#]/)[0])
   .filter(url=>known.has(url))
 );
 links.set(page.url,targets);
 for(const target of targets){
  if(target===page.url)continue;
  inbound.set(target,(inbound.get(target)||0)+1);
 }
}
const depth=new Map([['/',0]]),queue=['/'];
for(const current of queue){
 for(const target of links.get(current)||[]){
  if(depth.has(target))continue;
  depth.set(target,depth.get(current)+1);
  queue.push(target);
 }
}
// This legacy duplicate-intent route intentionally has no internal links and
// remains noindex; every other generated page must have a real crawl path.
const intentionallyUnlinked=new Set(['/cooking/grams-to-cups/']);
for(const page of pages){
 if(page.url==='/'||intentionallyUnlinked.has(page.url))continue;
 assert.ok(inbound.get(page.url)>0,'Orphan page with no internal inbound link: '+page.url);
 assert.ok(depth.has(page.url),'Page not reachable from home by internal links: '+page.url);
 assert.ok(depth.get(page.url)<=4,'Page more than four clicks from home: '+page.url+' ('+depth.get(page.url)+')');
}
const ingredientNumberPages=pages.filter(page=>/^\/cooking\/ingredients\/[^/]+\/\d+-grams-to-cups\/$/.test(page.url));
assert.equal(ingredientNumberPages.length,10,'Expected ten source-backed ingredient/weight landing pages');
for(const page of ingredientNumberPages){
 const match=page.url.match(/^\/cooking\/ingredients\/([^/]+)\/(\d+)-grams-to-cups\/$/);
 const [,ingredient,grams]=match;
 assert.ok(links.get('/cooking/ingredients/'+ingredient+'/')?.has(page.url),
  'Ingredient landing must offer contextual link to specific weight: '+page.url);
 assert.ok(links.get('/cooking/grams-to-cups/'+grams+'-grams-to-cups/')?.has(page.url),
  'Numeric landing must link to matching ingredient/weight page: '+page.url);
}
// Keep an inspectable crawl-path report private to the CI artifact.
const graphReport=[['url','production_index_candidate','inbound_page_links','click_depth_from_home','intentionally_unlinked'],
 ...pages.map(p=>[p.url,p.indexCandidate?'yes':'no',inbound.get(p.url)||0,depth.get(p.url)??'',
  intentionallyUnlinked.has(p.url)?'yes':'no'])];
const reportDir=path.join(root,'reports');
fs.mkdirSync(reportDir,{recursive:true});
fs.writeFileSync(path.join(reportDir,'seo-link-graph.csv'),'\ufeff'+graphReport.map(row=>row.map(csvSafeCell).join(',')).join('\r\n')+'\r\n');
assert.equal(depth.size,80,'Expected 80 crawlable URLs and one deliberate noindex duplicate-intent route');
console.log('Internal link graph passed:',depth.size,'reachable pages,',ingredientNumberPages.length,
 'specific ingredient/weight pages cross-linked, max click depth',Math.max(...depth.values()));

const files=['assets/app.js','assets/core.mjs','assets/ingredients.json','assets/styles.css','robots.txt','404.html','favicon.svg'];
for(const f of files)assert.ok(fs.existsSync(path.join(dist,f)),'missing '+f);
assert.ok(manifest.publicIndex?fs.existsSync(path.join(dist,'sitemap.xml')):!fs.existsSync(path.join(dist,'sitemap.xml')));
assert.equal(pages.filter(p=>p.indexCandidate).length,62,'expected 62 audited index candidates after editorial review');
const numberPages=pages.filter(x=>/\/grams-to-cups\/\d+-grams-to-cups\/$/.test(x.url));
assert.equal(numberPages.length,21);
assert.equal(pages.filter(x=>/\/ingredients\/[^/]+\/$/.test(x.url)).length,24);

// Every ingredient page must show its independently checked original chart entry,
// rather than a bare citation that cannot establish which weight was selected.
const refs=JSON.parse(fs.readFileSync(path.join(root,'research/ingredient-reference-lock.json'),'utf8'));
for(const item of refs.records){
 const route='/cooking/ingredients/'+item.id+'/';
 // Tool-only foods are verified in the source ledger, without generating thin pages.
 if(!pages.some(page=>page.url===route))continue;
 const html=pageHtml(route);
 assert.ok(html.includes('Original published entry:'),'missing provenance on '+route);
 assert.ok(html.includes(item.label.replaceAll('&','&amp;').replaceAll("'",'&#39;')),'wrong source label on '+route);
}
// A source-to-result ledger for all 27 verified food references, never a claim of lab
// density measurements or of an up-to-date external source change.
const ingredientData=JSON.parse(fs.readFileSync(path.join(root,'src/ingredients.json'),'utf8'));
const sourceLedger=refs.records.map(reference=>{
 const food=ingredientData.find(row=>row.id===reference.id);
 assert.ok(food,'Missing source-backed ingredient in live data: '+reference.id);
 assert.equal(food.referenceGrams,reference.grams);
 assert.equal(food.referenceAmount,reference.amount);
 assert.equal(food.referenceUnit,reference.unit);
 assert.equal(food.sourceEntry,reference.label);
 assert.equal(food.sourceUrl,refs.source);
 return {id:reference.id,label:reference.label,displayName:food.name,
  sourceUrl:food.sourceUrl,reviewedAt:food.reviewedAt,
  state:food.state,method:food.method,referenceGrams:reference.grams,
  referenceAmount:reference.amount,referenceUnit:reference.unit,
  limitations:food.note,
  sourceLockMatch:true,derivedDensityMeasurement:false};
});
assert.equal(sourceLedger.length,27,'All 27 source-backed ingredient evidence entries are required');
fs.writeFileSync(path.join(reportDir,'ingredient-source-evidence.json'),
 JSON.stringify({source:refs.source,sourceReviewedAt:refs.checked,entries:sourceLedger,
  limitation:'Source-locked recipe chart values, not independent lab densities, physical constants, or evidence of current external chart updates.'},null,2)+'\n');
const methods=pageHtml('/cooking/sources-and-methods/');
assert.ok(methods.includes('Source entries used by this website'),'missing original references table');
for(const ref of refs.records)assert.ok(methods.includes(ref.label.replaceAll('&','&amp;').replaceAll("'",'&#39;')),'missing methods row '+ref.id);

assert.equal(pages.filter(x=>/\/ingredients\/[^/]+\/\d+-grams-to-cups\/$/.test(x.url)).length,10);

for(const item of refs.records){
 const url='/cooking/ingredients/'+item.id+'/';
 const html=pageHtml(url);
 assert.match(html,/: cups to grams<\/h2>/,'Missing reverse lookup on '+url);
 assert.match(html,/<th scope="col">US cup amount<\/th>/,'Missing measured cup portions table on '+url);
 assert.match(html,/<th scope="col">Equivalent metric cups<\/th>/,'Missing metric cups conversion column on '+url);
}
for(const page of numberPages){
 const html=pageHtml(page.url);
 assert.match(html,/Closest common cup measures for/,'Missing practical measuring guide on '+page.url);
 assert.match(html,/Weight difference<\/th>/,'Missing measurement precision warning on '+page.url);
}

assert.equal(pages.find(p=>p.url==='/').indexCandidate,true,'homepage is primary grams-to-cups landing');
assert.equal(pages.find(p=>p.url==='/cooking/grams-to-cups/').indexCandidate,false,'duplicate core converter must not compete with homepage');
assert.ok(!pageHtml('/').includes('href="/cooking/grams-to-cups/"'),'internal links must use the primary homepage URL');
assert.ok(!pageHtml('/cooking/').includes('href="/cooking/grams-to-cups/"'),'tool directory must route core intent to homepage');
assert.equal(pages.find(p=>p.url==='/cooking/grams-to-cups/1000-grams-to-cups/').indexCandidate,false,'1000g KD37 has not qualified for standalone numeric index eligibility');
assert.ok(known.has('/cooking/batch-converter/'),'missing batch converter route');
assert.equal(pages.find(x=>x.url==='/cooking/batch-converter/').indexCandidate,false,'batch tool stays noindex without search demand evidence');
assert.match(pageHtml('/cooking/batch-converter/'),/data-batch-results/,'missing interactive batch results');
console.log('Audit passed:',pages.length,'pages,',numberPages.length,'number pages,',files.length,'static assets. publicIndex='+manifest.publicIndex);
