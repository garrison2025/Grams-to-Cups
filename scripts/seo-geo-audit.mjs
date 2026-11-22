/**
 * Confirm all core SEO acquisition routes expose a deterministic, readable
 * conversion answer and (where ingredient mass is inferred) a real citation.
 * This report is source verification, not an AI citation, ranking or traffic test.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {convertQuantity,formatAmount} from '../src/core.mjs';
import {csvSafeCell} from '../src/seo-evidence.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>fs.readFileSync(path.join(root,p),'utf8');
const manifest=JSON.parse(read('dist/site-manifest.json'));
const foods=JSON.parse(read('src/ingredients.json'));
const foodById=new Map(foods.map(i=>[i.id,i]));
const source='https://www.kingarthurbaking.com/learn/ingredient-weight-chart';
const toolSlugs=new Set([
 'grams-to-cups','cups-to-grams','grams-to-tablespoons','tablespoons-to-grams',
 'ml-to-cups','tablespoons-to-cups','cups-to-tablespoons',
 'tablespoons-to-ml','ml-to-tablespoons','cups-to-fluid-ounces','fluid-ounces-to-cups'
]);
const report=[['url','topic_type','production_index_candidate','visible_direct_answer',
 'visible_exact_unit','original_source_link','ingredient_state_disclosed','answer_excerpt','coverage_notes']];
const counts={home:0,unitTool:0,numeric:0,ingredient:0,ingredientWeight:0,referenceChart:0};
const strip=s=>String(s).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ')
 .replace(/<[^>]+>/g,' ').replace(/&amp;/g,'&').replace(/&#39;/g,"'")
 .replace(/&quot;/g,'"').replace(/&nbsp;/g,' ').replace(/\s+/g,' ').trim();

for(const page of manifest.pages){
 const url=page.url,html=read('dist/'+(url==='/'?'index.html':url.slice(1)+'index.html'));
 const numeric=url.match(/^\/cooking\/grams-to-cups\/(\d+)-grams-to-cups\/$/);
 const combo=url.match(/^\/cooking\/ingredients\/([^/]+)\/(\d+)-grams-to-cups\/$/);
 const ingredient=url.match(/^\/cooking\/ingredients\/([^/]+)\/$/);
 const tool=url.match(/^\/cooking\/([^/]+)\/$/);
 const chart=/^\/cooking\/charts\/(?:flour\/|sugar\/)?$/.test(url);
 let type='',direct=false,unit=false,sourceVisible=html.includes('href="'+source+'"');
 let state=false,excerpt='',note='';
 if(url==='/'){
  type='home';
  direct=html.includes('<h2>How many cups is 100 grams?</h2>');
  unit=html.includes('100 grams of spoon-and-leveled all-purpose flour is about')&&html.includes(' US cups.');
  excerpt=strip(html.match(/<section class="section section-answer">([\s\S]*?)<\/section>/)?.[1]||'');
  state=html.includes('spoon-and-leveled');
  assert.ok(html.includes('divide the grams by the ingredient’s grams per US cup'),'Homepage must show the conversion formula');
  assert.ok(sourceVisible,'Homepage answer must show a usable published reference');
  assert.ok(html.includes('The same mass does not correspond to one universal cup amount.'),
   'Homepage must not imply a universal weight-to-volume ratio');
 }else if(combo){
  type='ingredientWeight';
  const food=foodById.get(combo[1]);
  assert.ok(food,'Unknown ingredient in combo '+url);
  const n=Number(combo[2]),answer=formatAmount(convertQuantity(n,'g','cup',{ingredient:food}),3);
  direct=html.includes(n+' grams of '+food.name+' ≈ '+answer+' US cups');
  unit=html.includes(answer+' US cups');
  const metric=formatAmount(convertQuantity(n,'g','cup',{ingredient:food,standard:'metric'}),3);
  assert.ok(html.includes('data-answer-evidence'),'Missing cited conversion trace '+url);
  assert.ok(html.includes('approximately <b>'+metric+' metric cups</b>'),
   'Missing separately calculated metric cup result '+url);
  assert.ok(html.includes(food.sourceEntry)&&html.includes(food.reviewedAt)&&html.includes(food.method),
   'Missing source entry, checked date or measuring method '+url);
  state=html.includes(food.state)&&html.includes(food.method);
  excerpt=strip(html.match(/<div class="seo-answer">([\s\S]*?)<\/div>/)?.[1]||'');
  assert.ok(sourceVisible,'Ingredient+number answer must link the published source: '+url);
 }else if(numeric){
  type='numeric';
  const n=Number(numeric[1]),flour=foodById.get('all-purpose-flour');
  const answer=formatAmount(convertQuantity(n,'g','cup',{ingredient:flour}),3);
  direct=html.includes(formatAmount(n,3)+' grams of All-purpose flour ≈ '+answer+' US cups');
  unit=html.includes(answer+' US cups');
  const metric=formatAmount(convertQuantity(n,'g','cup',{ingredient:flour,standard:'metric'}),3);
  assert.ok(html.includes('data-answer-evidence'),'Missing cited conversion trace '+url);
  assert.ok(html.includes('approximately <b>'+metric+' metric cups</b>'),
   'Numeric page missing separately calculated metric value '+url);
  assert.ok(html.includes('Food state and measuring method')&&html.includes(flour.state)&&html.includes(flour.method),
   '27-food comparison must expose distinct measurement states '+url);
  state=html.includes(flour.state)&&html.includes(flour.method);
  excerpt=strip(html.match(/<div class="seo-answer">([\s\S]*?)<\/div>/)?.[1]||'');
  assert.ok(sourceVisible,'Numeric answer must show its mass-to-volume source: '+url);
 }else if(ingredient){
  type='ingredient';
  const food=foodById.get(ingredient[1]);
  assert.ok(food,'Unknown ingredient '+url);
  const grams=formatAmount(convertQuantity(1,'cup','g',{ingredient:food}),3);
  direct=html.includes('How many grams are in one US cup of '+food.name.toLowerCase()+'?');
  unit=html.includes('approximately <strong>'+grams+' grams</strong>');
  const metric=formatAmount(convertQuantity(100,'g','cup',{ingredient:food,standard:'metric'}),3);
  assert.ok(html.includes('data-ingredient-evidence'),'Ingredient page missing explicit metric basis '+url);
  assert.ok(html.includes('100 g ≈ '+metric+' metric cups'),
   'Metric cup weight must match the same ingredient source '+url);
  state=html.includes(food.state)&&html.includes(food.method);
  excerpt=strip(html.match(/<h2>How many grams are in one US cup[\s\S]*?<\/p>/)?.[0]||'');
  assert.ok(sourceVisible,'Ingredient direct answer must link the original published source '+url);
 }else if(tool&&toolSlugs.has(tool[1])){
  type='unitTool';
  direct=html.includes('<h2>Conversion answer and calculation</h2>');
  unit=html.includes(' converts to ')||html.includes(' = approximately ');
  state=html.includes('defined US customary volume units')||
   html.includes('scooping')||html.includes('spooned-and-leveled');
  excerpt=strip(html.match(/<h2>Conversion answer and calculation<\/h2>([\s\S]*?)<\/div>/)?.[1]||'');
  if(['grams-to-cups','cups-to-grams','grams-to-tablespoons','tablespoons-to-grams'].includes(tool[1]))
   assert.ok(sourceVisible,'Mass/volume tool must include a visible ingredient source '+url);
 }else if(chart){
  type='referenceChart';
  direct=html.includes('<h2>Measured US cup portions</h2>');
  unit=html.includes('1/4 cup')&&html.includes('1/2 cup');
  state=html.includes('Method');
  excerpt=strip(html.match(/<h2>Measured US cup portions<\/h2>([\s\S]*?)<div data-chart>/)?.[1]||'');
  assert.ok(sourceVisible,'Chart must link the cited food measurements '+url);
 }
 if(!type)continue;
 counts[type]++;
 assert.ok(direct,'Missing reader-visible direct answer heading/summary: '+url);
 assert.ok(unit,'Missing explicit numeric/unit answer: '+url);
 assert.ok(state,'Missing measurement method/state or fixed-unit context: '+url);
 assert.ok(excerpt.length>30,'Missing substantive crawlable answer copy: '+url);
 report.push([url,type,page.indexCandidate?'yes':'no','yes','yes',sourceVisible?'yes':'not-applicable',
   state?'yes':'no',excerpt.slice(0,280),
   'Build-time crawlability check only; rankings, AI citations, and real Google indexing are not verified.']);
}
assert.deepEqual(counts,{home:1,unitTool:11,numeric:21,ingredient:24,ingredientWeight:10,referenceChart:3},
 'SEO answer templates/pages changed: recheck topical coverage');
assert.equal(report.length,71,'Expected 70 source-aware content routes plus CSV header');
const dir=path.join(root,'reports');fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(path.join(dir,'seo-geo-visible-answers.csv'),'\ufeff'+report.map(r=>r.map(csvSafeCell).join(',')).join('\r\n')+'\r\n');
console.log('SEO/GEO direct-answer audit passed:',JSON.stringify(counts),
 '70 relevant page templates, each with a visible answer, explicit unit and context.');
