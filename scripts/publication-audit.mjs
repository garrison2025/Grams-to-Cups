/**
 * Gate the generated HTML site against accidental publication and SEO metadata
 * regressions. Checks BOTH unindexed preview builds and approved production CI.
 * No network, database or new npm dependencies.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const dist=path.join(root,'dist');
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'site-manifest.json'),'utf8'));
const pages=manifest.pages;
const production=manifest.publicIndex===true;
const get=url=>fs.readFileSync(path.join(dist,url==='/'?'index.html':url.slice(1)+'index.html'),'utf8');
const read=file=>fs.readFileSync(path.join(dist,file),'utf8');
const decode=s=>String(s).replaceAll('&amp;','&').replaceAll('&#39;',"'").replaceAll('&quot;','"').replaceAll('&lt;','<').replaceAll('&gt;','>');
const tag=(html,regex)=>[...html.matchAll(regex)];
const canonicalFor=page=>manifest.origin+page.url;
const eligibility=pages.filter(p=>p.indexCandidate);
const titleMap=new Map(),descriptionMap=new Map();
const warnings=[];
assert.equal(pages.length,81,'Expected 81 generated pages');
assert.equal(eligibility.length,62,'Expected 62 index-approved candidates');
if(production){
 assert.match(manifest.origin,/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i);
 const hostname=new URL(manifest.origin).hostname;
 const fixture=process.env.CI==='true'&&process.env.SITE_URL_FIXTURE_APPROVED_FOR_CI==='true'&&hostname==='example.com';
 assert.ok(fixture||!/^(?:example\.com|localhost|127\.0\.0\.1|0\.0\.0\.0)$/.test(hostname)&&!/\.(?:example|test|invalid|localhost)$/.test(hostname),'Placeholder host must not be published');
}else assert.ok(!fs.existsSync(path.join(dist,'sitemap.xml')),'Preview has a sitemap');
const headers=read('_headers');
assert.match(headers,/X-Content-Type-Options:\s*nosniff/);
assert.match(headers,/Referrer-Policy:\s*strict-origin-when-cross-origin/);
assert.match(headers,/Permissions-Policy:\s*camera=\(\), microphone=\(\), geolocation=\(\)/);
if(production)assert.doesNotMatch(headers,/X-Robots-Tag:\s*noindex/);
else assert.match(headers,/X-Robots-Tag:\s*noindex/);
const robots=read('robots.txt');
if(production)assert.ok(robots.includes('Sitemap: '+manifest.origin+'/sitemap.xml'));
else assert.ok(!robots.includes('Sitemap:'),'No sitemap declaration in preview');

for(const page of pages){
 const html=get(page.url);
 const titles=tag(html,/<title>([\s\S]*?)<\/title>/gi);
 const descriptions=tag(html,/<meta name="description" content="([^"]*)"[^>]*>/gi);
 const h1=tag(html,/<h1(?:\s[^>]*)?>([\s\S]*?)<\/h1>/gi);
 const canonicals=tag(html,/<link rel="canonical" href="([^"]+)"[^>]*>/gi);
 const ogUrl=tag(html,/<meta property="og:url" content="([^"]+)"[^>]*>/gi);
 const robotMeta=tag(html,/<meta name="robots" content="([^"]+)"[^>]*>/gi);
 const structured=tag(html,/<script type="application\/ld\+json">([\s\S]*?)<\/script>/gi);
 assert.equal(titles.length,1,'Exactly one title required '+page.url);
 assert.equal(descriptions.length,1,'Exactly one meta description '+page.url);
 assert.equal(h1.length,1,'Exactly one H1 '+page.url);
 assert.equal(robotMeta.length,1,'Exactly one robots directive '+page.url);
 const title=decode(titles[0][1]),description=decode(descriptions[0][1]);
 assert.ok(title.length>=20&&title.length<=125,'Unreasonable page title '+page.url+': '+title.length);
 assert.ok(description.length>=55&&description.length<=220,'Unreasonable description '+page.url+': '+description.length);
 assert.ok(!titleMap.has(title),'Duplicate rendered title '+page.url+' and '+titleMap.get(title));
 assert.ok(!descriptionMap.has(description),'Duplicate rendered description '+page.url+' and '+descriptionMap.get(description));
 titleMap.set(title,page.url);
 descriptionMap.set(description,page.url);
 // The site intentionally links to source charts; only its own JS and CSS run.
 const scripts=tag(html,/<script\b[^>]*\bsrc="([^"]+)"[^>]*><\/script>/gi).map(x=>x[1]);
 const styles=tag(html,/<link\b[^>]*\brel="stylesheet"[^>]*\bhref="([^"]+)"[^>]*>/gi).map(x=>x[1]);
 assert.deepEqual(scripts,['/assets/app.js'],'No third-party runtime scripts expected '+page.url);
 assert.deepEqual(styles,['/assets/styles.css'],'No third-party CSS expected '+page.url);
 const published=production&&page.indexCandidate;
 if(published){
  assert.deepEqual(robotMeta.map(x=>x[1]),['index,follow'],'Incorrect index rule '+page.url);
  assert.equal(canonicals.length,1,'Missing / duplicate canonical '+page.url);
  assert.equal(canonicals[0][1],canonicalFor(page),'Mismatched canonical '+page.url);
  assert.equal(ogUrl.length,1,'Missing OG url '+page.url);
  assert.equal(ogUrl[0][1],canonicalFor(page),'Mismatched OG url '+page.url);
  assert.ok(structured.length>=1,'Missing JSON-LD '+page.url);
  for(const item of structured){
   const data=JSON.parse(item[1]);
   assert.equal(data['@context'],'https://schema.org','Wrong schema context '+page.url);
   if(data['@type']==='WebPage'||data['@type']==='WebApplication')assert.equal(data.url,canonicalFor(page),'Mismatched JSON-LD canonical '+page.url);
   if(data['@type']==='BreadcrumbList'){
    for(const [i,li] of data.itemListElement.entries()){
     assert.equal(li.position,i+1,'Incorrect breadcrumb ordinal '+page.url);
     assert.ok(li.item.startsWith(manifest.origin+'/'),'Broken breadcrumb hostname '+page.url);
    }
   }
  }
 }else{
  assert.deepEqual(robotMeta.map(x=>x[1]),['noindex,follow'],'Missing noindex '+page.url);
  assert.equal(canonicals.length,0,'Canonical emitted for excluded or preview page '+page.url);
  assert.equal(ogUrl.length,0,'OG URL emitted for excluded or preview page '+page.url);
  assert.equal(structured.length,0,'Publication JSON-LD emitted on preview/noindex '+page.url);
 }
 // Do not recreate a competing landing via static HTML. The legacy calculator
 // is still functional when opened directly, but all internal links point home.
 assert.ok(!html.includes('href="/cooking/grams-to-cups/"'),'Duplicate primary SEO intent linked '+page.url);
}
if(production){
 const sitemap=read('sitemap.xml');
 const locs=tag(sitemap,/<loc>([^<]+)<\/loc>/g).map(x=>x[1]);
 const expected=eligibility.map(canonicalFor);
 assert.equal(new Set(locs).size,locs.length,'Duplicate sitemap URLs');
 assert.deepEqual(locs,expected,'Sitemap must exactly match canonical index candidates');
 assert.match(sitemap,/<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
}else{
 assert.ok(!fs.existsSync(path.join(dist,'sitemap.xml')),'No preview sitemap');
}
for(const item of warnings)console.warn(item);
console.log('Publication audit passed:',pages.length,'pages,',eligibility.length,'canonical-eligible pages, mode='+(production?'approved CI production':'noindex preview')+', no third-party runtime scripts.');
