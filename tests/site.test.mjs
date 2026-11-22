import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSemrushNumber,parseSemrushKD,csvSafeCell} from '../src/seo-evidence.mjs';
import {parseAmount,convertQuantity,approximateFraction,scaleRecipe,csvCell,formatAmount,formatKitchenAmount,batchConvertIngredients,US_CUP_ML,METRIC_CUP_ML,US_TBSP_ML} from '../src/core.mjs';
const foods=JSON.parse(fs.readFileSync(new URL('../src/ingredients.json',import.meta.url),'utf8'));
const byId=id=>foods.find(x=>x.id===id);

const referenceLock=JSON.parse(fs.readFileSync(new URL('../research/ingredient-reference-lock.json',import.meta.url),'utf8'));
test('original King Arthur source entries match independently verified measurement pairs',()=>{
 assert.equal(referenceLock.source,'https://www.kingarthurbaking.com/learn/ingredient-weight-chart');
 assert.equal(referenceLock.records.length,24);
 assert.equal(new Set(referenceLock.records.map(x=>x.id)).size,24);
 for(const row of referenceLock.records){
  const item=byId(row.id);
  assert.ok(item,'missing source-locked ingredient '+row.id);
  assert.equal(item.sourceEntry,row.label,row.id+' original source row');
  assert.equal(item.referenceGrams,row.grams,row.id+' grams');
  assert.equal(item.referenceAmount,row.amount,row.id+' volume amount');
  assert.equal(item.referenceUnit,row.unit,row.id+' unit');
  assert.equal(item.sourceUrl,referenceLock.source,row.id+' citation URL');
 }
});

test('24 references have source, unambiguous method and original quantities',()=>{
 assert.equal(foods.length,24);
 assert.equal(new Set(foods.map(x=>x.id)).size,foods.length);
 for(const i of foods){
  assert.match(i.sourceUrl,/^https:\/\//);assert.ok(i.sourceName&&i.state&&i.method&&i.note);
  assert.equal(i.referenceType,'recipe_reference');
  assert.ok(i.referenceGrams>0&&i.referenceAmount>0&&i.referenceCupMl===US_CUP_ML);
  assert.ok(['cup','tablespoon','teaspoon'].includes(i.referenceUnit));
  assert.equal(i.approximate,true);
 }
});
test('published recipe reference values are reproduced correctly',()=>{
 for(const [id,grams,cups] of [['all-purpose-flour',120,1],['granulated-sugar',99,.5],['butter',113,.5],['brown-sugar-packed',213,1],['long-grain-rice-dry',99,.5],['honey',21,1/16],['water',227,1]]){
  assert.ok(Math.abs(convertQuantity(grams,'g','cup',{ingredient:byId(id)})-cups)<1e-10,id);
 }
});
test('unit definitions and US vs metric cups are distinct',()=>{
 assert.ok(Math.abs(convertQuantity(1,'cup','ml')-US_CUP_ML)<1e-9);
 assert.equal(convertQuantity(1,'cup','ml',{standard:'metric'}),METRIC_CUP_ML);
 assert.ok(Math.abs(convertQuantity(1,'cup','tbsp')-16)<1e-9);
 assert.ok(Math.abs(convertQuantity(1,'tbsp','ml')-US_TBSP_ML)<1e-9);
 assert.ok(Math.abs(convertQuantity(1,'cup','fl-oz')-8)<1e-9);
 assert.ok(Math.abs(convertQuantity(120,'g','cup',{ingredient:byId('all-purpose-flour'),standard:'metric'})-US_CUP_ML/METRIC_CUP_ML)<1e-9);
});
test('different ingredients and states never share a universal density',()=>{
 const flour=convertQuantity(100,'g','cup',{ingredient:byId('all-purpose-flour')});
 const sugar=convertQuantity(100,'g','cup',{ingredient:byId('granulated-sugar')});
 assert.notEqual(flour,sugar);
 assert.notEqual(convertQuantity(100,'g','cup',{ingredient:byId('long-grain-rice-dry')}),convertQuantity(100,'g','cup',{ingredient:byId('brown-rice-cooked')}));
 assert.throws(()=>convertQuantity(100,'g','cup'),/Choose a supported ingredient/);
 assert.notEqual(convertQuantity(1,'oz','g'),convertQuantity(1,'fl-oz','ml'));
});
test('prototype keys and unsupported units are rejected, never silently returned as NaN',()=>{
 for(const bad of ['constructor','toString','__proto__','valueOf','millions']){
  assert.throws(()=>convertQuantity(1,bad,'g'),/Unsupported unit/);
  assert.throws(()=>convertQuantity(1,'g',bad),/Unsupported unit/);
 }
});
test('round-trip conversion remains precise',()=>{
 for(const i of foods)for(const x of [1,25,100,345.67,1000]){
  const cups=convertQuantity(x,'g','cup',{ingredient:i});
  const grams=convertQuantity(cups,'cup','g',{ingredient:i});
  assert.ok(Math.abs(grams-x)<1e-9*Math.max(1,x),i.id);
 }
});
test('fraction and input validation',()=>{
 assert.equal(parseAmount('1 1/2'),1.5);
 assert.equal(parseAmount('3/4'),.75);
 assert.equal(parseAmount('0.25'),.25);
 assert.equal(parseAmount('1,000'),1000,'Strict US thousand grouping is supported');
 assert.equal(parseAmount('12,345.67'),12345.67);
 assert.equal(parseAmount('1,234,567'),1234567);
 assert.equal(approximateFraction(.375),'3/8');
 assert.equal(approximateFraction(.001),'','Do not call a nonzero measure approximately zero cups');
 for(const bad of ['','-1','0','3/0','NaN','Infinity','1e309','1/2/3','1,5','12,34','1,23,456','a',String(10**20)]){
  assert.throws(()=>parseAmount(bad),undefined,bad);
 }
});
test('recipe scaler preserves unknown lines and warns without guessing',()=>{
 const x=scaleRecipe('200 g flour\n1 1/2 cups milk\npinch of salt',4,6);
 assert.equal(x.rows[0].scaled,'300 g flour');
 assert.equal(x.rows[1].scaled,'2.25 cups milk');
 assert.equal(x.rows[2].ok,false);
 assert.equal(x.unparsed,1);
 assert.throws(()=>scaleRecipe('1 cup milk',0,2));
 const ranges=scaleRecipe('2-3 eggs\n1 to 2 cups stock\n1–2 tbsp cinnamon\n2 or 3 teaspoons salt',2,4);
 assert.equal(ranges.unparsed,4,'Ingredient ranges must request manual review');
 const grouping=scaleRecipe('1,000 g flour\n1,234.5 ml milk\n1,5 cups water\n1.2.3 tsp salt',2,4);
 assert.equal(grouping.rows[0].scaled,'2,000 g flour');
 assert.equal(grouping.rows[1].scaled,'2,469 ml milk');
 assert.equal(grouping.unparsed,2,'Malformed separators must not partially scale a number');
 assert.equal(grouping.rows[2].scaled,'1,5 cups water');
 assert.equal(grouping.rows[3].scaled,'1.2.3 tsp salt');
 assert.deepEqual(ranges.rows.map(r=>r.scaled),['2-3 eggs','1 to 2 cups stock','1–2 tbsp cinnamon','2 or 3 teaspoons salt']);
 const compounds=scaleRecipe('1 cup + 2 tbsp milk\n1 cup and 2 tbsp milk\n1 cup & 2 tbsp milk\n1 cup / 2 tbsp milk\n1 cup milk plus 2 tbsp cream\n2 eggs and 1 onion',2,4);
 assert.equal(compounds.unparsed,6,'Multi-quantity recipes must not only scale the first quantity');
 assert.deepEqual(compounds.rows.map(r=>r.scaled),compounds.rows.map(r=>r.original));
 const fractionStyle=scaleRecipe('1½ cups milk\n½ tsp salt',4,6,{fractions:true});
 assert.equal(fractionStyle.rows[0].scaled,'2 1/4 cups milk');
 assert.equal(fractionStyle.rows[1].scaled,'3/4 tsp salt');
});
test('very small positive measures stay positive in readable output',()=>{
 assert.equal(formatAmount(1e-9,5),'1e-9');
 assert.equal(formatAmount(0.000000123,4),'1.23e-7');
 assert.equal(formatKitchenAmount(1e-9,{fractions:true}),'1e-9');
 assert.equal(formatKitchenAmount(0.00002,{fractions:true}),'0.00002');
 assert.equal(formatKitchenAmount(0,{fractions:true}),'0');
});

test('recipe scaler adjusts full-unit singular and plural grammar',()=>{
 const changed=scaleRecipe('1 cup milk\n2 cups water\n1 gram yeast\n2 grams salt\n1 tablespoon oil\n2 teaspoons cinnamon\n1 tbsp honey\n2 eggs',2,4);
 assert.equal(changed.unparsed,0);
 assert.deepEqual(changed.rows.map(r=>r.scaled),[
 '2 cups milk','4 cups water','2 grams yeast','4 grams salt',
 '2 tablespoons oil','4 teaspoons cinnamon','2 tbsp honey','4 eggs'
 ]);
 const halved=scaleRecipe('2 cups milk\n2 teaspoons cinnamon\n2 grams salt\n2 tablespoons honey',4,2);
 assert.deepEqual(halved.rows.map(r=>r.scaled),[
 '1 cup milk','1 teaspoon cinnamon','1 gram salt','1 tablespoon honey'
 ]);
 const fraction=scaleRecipe('1 cup milk',4,2,{fractions:true});
 assert.equal(fraction.rows[0].scaled,'1/2 cup milk');
});

test('CSV escaping prevents spreadsheet formula injection',()=>{
 assert.equal(csvCell('=HYPERLINK("bad")'),'"\'=HYPERLINK(""bad"")"');
 assert.equal(csvCell('a,b'),'"a,b"');
 assert.equal(csvCell('  =1+1'),"\"'  =1+1\"");
 assert.equal(csvCell('\t+SUM(1,2)'),"\"'\t+SUM(1,2)\"");
 assert.equal(csvCell('\u200b@SUM(1,2)'),"\"'\u200b@SUM(1,2)\"");
});

test('Unicode and narrow-space kitchen fractions are parsed without a guess',()=>{
 assert.equal(parseAmount('½'),.5);
 assert.equal(parseAmount('⅔'),2/3);
 assert.equal(parseAmount('1½'),1.5);
 assert.equal(parseAmount('2 ¾'),2.75);
 assert.equal(parseAmount('1\u202f½'),1.5);
 assert.equal(parseAmount('3⁄4'),.75);
 assert.equal(formatKitchenAmount(1.5),'1 1/2');
 assert.equal(formatKitchenAmount(1/3),'1/3');
 assert.equal(formatKitchenAmount(0.505,{fractions:true}),'0.505');
 assert.equal(formatKitchenAmount(340.5,{fractions:false}),'340.5');
 assert.equal(formatKitchenAmount(1234.5),'1,234 1/2');
 assert.equal(formatKitchenAmount(1000),'1,000');
});
test('Unicode fraction recipe scaler does not mistake unit labels',()=>{
 const scaled=scaleRecipe('1½ cups milk\n½ tsp salt\n3⁄4 cup honey',2,3);
 assert.equal(scaled.unparsed,0);
 assert.equal(scaled.rows[0].scaled,'2.25 cups milk');
 assert.equal(scaled.rows[1].scaled,'0.75 tsp salt');
 assert.equal(scaled.rows[2].scaled,'1.125 cups honey');
});
test('batch conversion uses ingredient-specific values in both directions',()=>{
 const source='120 g all-purpose flour\n198 g granulated sugar\n½ cup butter\n2 tbsp honey';
 const cups=batchConvertIngredients(source,{ingredients:foods,target:'cup'});
 assert.equal(cups.converted,4);
 assert.equal(cups.review,0);
 assert.equal(cups.rows[0].output,'1 US cup All-purpose flour');
 const large=batchConvertIngredients('1,000 g all-purpose flour',{ingredients:foods,target:'cup'});
 assert.equal(large.converted,1,'Batch converter accepts correctly grouped input');
 assert.equal(large.rows[0].output,'8 1/3 US cups All-purpose flour');
 assert.equal(cups.rows[1].output,'1 US cup Granulated white sugar');
 assert.equal(cups.rows[2].output,'1/2 US cup Butter');
 assert.equal(cups.rows[3].output,'1/8 US cup Honey');
 const metric=batchConvertIngredients('120 g all-purpose flour',{ingredients:foods,target:'cup',standard:'metric'});
 assert.equal(metric.converted,1);
 assert.equal(metric.rows[0].output,'0.9464 metric cups All-purpose flour','metric cups are distinguishable from US cups');
 assert.match(metric.rows[0].reason,/120 g \/ 1 US cup/,'metric conversion still cites its original US cup source');
 const grams=batchConvertIngredients('½ cup granulated sugar\n1½ cups milk',{ingredients:foods,target:'g'});
 assert.equal(grams.converted,2);
 assert.equal(grams.rows[0].output,'99 g Granulated white sugar');
 assert.equal(grams.rows[1].output,'340.5 g Milk, fresh');
});
test('batch conversion flags unclear ingredients and invalid lines without inventing density',()=>{
 const result=batchConvertIngredients('200 g flour\n1 cup brown sugar, loose\n1 cup peanut butter\n3 handfuls flour\n0 g butter\n',{ingredients:foods,target:'cup'});
 assert.equal(result.converted,0);
 assert.equal(result.review,5);
 assert.equal(result.blank,1);
 assert.equal(result.rows[0].output,'200 g flour');
 assert.match(result.rows[0].reason,/unambiguously/);
 assert.throws(()=>batchConvertIngredients('1 cup milk',{ingredients:[],target:'g'}));
 assert.throws(()=>batchConvertIngredients('1 cup milk',{ingredients:foods,target:'kg'}));
 assert.throws(()=>batchConvertIngredients('1 cup milk',{ingredients:foods,standard:'unknown'}));
 assert.throws(()=>batchConvertIngredients(Array(102).fill('1 cup milk').join('\n'),{ingredients:foods}),/100 lines/);
});

test('Semrush evidence never treats missing KD as an easy keyword',()=>{
 for(const x of ['',null,undefined,'-','N/A','n/a',' ','unknown','NaN','Infinity','30%', '=0','-1','-0.25','-100']){
  assert.equal(parseSemrushNumber(x),null,'Should remain unknown: '+String(x));
 }
 assert.equal(parseSemrushNumber('0'),0,'Real observed zero remains zero');
 assert.equal(parseSemrushNumber('29'),29);
 assert.equal(parseSemrushNumber('29.5'),29.5);
 assert.equal(parseSemrushNumber('1300'),1300);
 for(const x of [-1,101,110,'missing',''])assert.equal(parseSemrushKD(x),null,'Out-of-range KD is unknown, not easy: '+String(x));
 assert.equal(parseSemrushKD('0'),0);
 assert.equal(parseSemrushKD('29'),29);
 assert.equal(parseSemrushKD('100'),100);
});
test('exported competitor CSV cannot execute spreadsheet formulas',()=>{
 for(const x of ['=1+1','+SUM(1,2)','-2+3','@SUM(1,2)','  =HYPERLINK("danger")','\u200b=HYPERLINK("danger")','\ufeff  @SUM(1,2)','\t+SUM(2,3)']){
  const value=csvSafeCell(x);
  assert.ok(value.startsWith('"\'')||value.startsWith('"\u0027'),'Formula must be prefixed with apostrophe');
  assert.ok(value.includes(x.replaceAll('"','""')),'CSV must preserve original content after escape');
 }
 assert.equal(csvSafeCell('normal keyword'),'"normal keyword"');
 assert.equal(csvSafeCell('cup, grams'),'"cup, grams"');
});
