import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),dist=path.join(root,'dist');
const manifest=JSON.parse(fs.readFileSync(path.join(dist,'site-manifest.json'),'utf8'));
const pages=manifest.pages;
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
const files=['assets/app.js','assets/core.mjs','assets/ingredients.json','assets/styles.css','robots.txt','404.html','favicon.svg'];
for(const f of files)assert.ok(fs.existsSync(path.join(dist,f)),'missing '+f);
assert.ok(manifest.publicIndex?fs.existsSync(path.join(dist,'sitemap.xml')):!fs.existsSync(path.join(dist,'sitemap.xml')));
assert.equal(pages.filter(p=>p.indexCandidate).length,66,'expected 66 audited index candidates');
const numberPages=pages.filter(x=>/\/grams-to-cups\/\d+-grams-to-cups\/$/.test(x.url));
assert.equal(numberPages.length,21);
assert.equal(pages.filter(x=>/\/ingredients\/[^/]+\/$/.test(x.url)).length,24);
assert.equal(pages.filter(x=>/\/ingredients\/[^/]+\/\d+-grams-to-cups\/$/.test(x.url)).length,10);
assert.equal(pages.find(p=>p.url==='/').indexCandidate,true,'homepage is primary grams-to-cups landing');
assert.equal(pages.find(p=>p.url==='/cooking/grams-to-cups/').indexCandidate,false,'duplicate core converter must not compete with homepage');
assert.ok(!pageHtml('/').includes('href="/cooking/grams-to-cups/"'),'internal links must use the primary homepage URL');
assert.ok(!pageHtml('/cooking/').includes('href="/cooking/grams-to-cups/"'),'tool directory must route core intent to homepage');
assert.ok(known.has('/cooking/batch-converter/'),'missing batch converter route');
assert.equal(pages.find(x=>x.url==='/cooking/batch-converter/').indexCandidate,false,'batch tool stays noindex without search demand evidence');
assert.match(pageHtml('/cooking/batch-converter/'),/data-batch-results/,'missing interactive batch results');
console.log('Audit passed:',pages.length,'pages,',numberPages.length,'number pages,',files.length,'static assets. publicIndex='+manifest.publicIndex);
