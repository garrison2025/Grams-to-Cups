import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseSemrushNumber,parseSemrushKD,csvSafeCell} from '../src/seo-evidence.mjs';
import {parseAmount,convertQuantity,approximateFraction,scaleRecipe,csvCell,formatAmount,formatKitchenAmount,calculateKitchenFractions,batchConvertIngredients,US_CUP_ML,METRIC_CUP_ML,US_TBSP_ML} from '../src/core.mjs';
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
test('exact kitchen fraction arithmetic combines common measures without rounding to a false fraction',()=>{
 const calc=(a,op,b)=>calculateKitchenFractions(a,op,b);
 assert.deepEqual(calc('1/2','+','1/4'),{value:0.75,decimal:'0.75',fraction:'3/4',exact:true});
 assert.equal(calc('1/3','+','1/4').fraction,'7/12','exact denominator 12 must not be rounded to 9/16');
 assert.equal(calc('1½','+','¼').fraction,'1 3/4');
 assert.equal(calc('3/4','-','1/4').fraction,'1/2');
 assert.equal(calc('3/4','-','3/4').fraction,'0','zero is an acceptable subtraction result');
 assert.equal(calc('1/8','*','1/4').fraction,'1/32');
 assert.equal(calc('1/2','/','1/4').fraction,'2');
 assert.equal(calc('3/4','/','1/2').fraction,'1 1/2');
 assert.equal(calc('1,234.5','+','0.5').fraction,'1,235');
 assert.deepEqual(calc('1/1000','+','1/1000'),{value:.002,decimal:'0.002',fraction:'0.002',exact:false},
  'avoid presenting giant fractions as an everyday measuring spoon');
 assert.throws(()=>calc('1/4','-','1/2'),/cannot be negative/);
 assert.throws(()=>calc('1/2','/','0'),/positive amount|greater than zero/i);
 assert.throws(()=>calc('1/2','^','1/2'),/Choose add/);
 assert.throws(()=>calc('1,5','+','1/2'),/Use a number/);
});

test('recipe scaler preserves unknown lines and warns without guessing',()=>{
 const x=scaleRecipe('200 g flour\n1 1/2 cups milk\npinch of salt',4,6);
 assert.equal(x.rows[0].scaled,'300 g flour');
 assert.equal(x.rows[1].scaled,'2.25 cups milk');
 assert.equal(x.rows[2].ok,false);
 assert.equal(x.unparsed,1);
 assert.throws(()=>scaleRecipe('1 cup milk',0,2));
 const ranges=scaleRecipe('2-3 eggs\n1 to 2 cups stock\n1–2 tbsp cinnamon\n2 or 3 teaspoons salt',2,4);
 assert.equal(ranges.unparsed,1,'Only explicit disjunctions remain for manual review; simple intervals scale both ends');
 const grouping=scaleRecipe('1,000 g flour\n1,234.5 ml milk\n1,5 cups water\n1.2.3 tsp salt',2,4);
 assert.equal(grouping.rows[0].scaled,'2,000 g flour');
 assert.equal(grouping.rows[1].scaled,'2,469 ml milk');
 assert.equal(grouping.unparsed,2,'Malformed separators must not partially scale a number');
 assert.equal(grouping.rows[2].scaled,'1,5 cups water');
 assert.equal(grouping.rows[3].scaled,'1.2.3 tsp salt');
 assert.deepEqual(ranges.rows.map(r=>r.scaled),['4–6 eggs','2–4 cups stock','2–4 tbsp cinnamon','2 or 3 teaspoons salt']);
 const compounds=scaleRecipe('1 cup + 2 tbsp milk\n1 cup and 2 tbsp milk\n1 cup & 2 tbsp milk\n1 cup / 2 tbsp milk\n1 cup milk plus 2 tbsp cream\n2 eggs and 1 onion',2,4);
 assert.equal(compounds.unparsed,6,'Multi-quantity recipes must not only scale the first quantity');
 assert.deepEqual(compounds.rows.map(r=>r.scaled),compounds.rows.map(r=>r.original));
 const fractionStyle=scaleRecipe('1½ cups milk\n½ tsp salt',4,6,{fractions:true});
 assert.equal(fractionStyle.rows[0].scaled,'2 1/4 cups milk');
 assert.equal(fractionStyle.rows[1].scaled,'3/4 tsp salt');
});
test('superscript and subscript kitchen fractions never silently truncate the first quantity',()=>{
 assert.equal(parseAmount('1 ¹⁄₂'),1.5);
 assert.equal(parseAmount('¹⁄₂'),.5);
 assert.equal(parseAmount('1 ³⁄₄'),1.75);
 const recipes=scaleRecipe('1 ¹⁄₂ cups flour\n1 ¹/₂ cups milk\n2 ³⁄₄ tbsp sugar\n1½ cups water',4,6,{fractions:true});
 assert.equal(recipes.unparsed,0);
 assert.deepEqual(recipes.rows.map(x=>x.scaled),[
  '2 1/4 cups flour','2 1/4 cups milk','4 1/8 tbsp sugar','2 1/4 cups water'
 ]);
 const malformed=scaleRecipe('1 ¹⁄2 cups flour\n1 1/0 cup sugar\n1 ²⁄? cups milk',4,6,{fractions:true});
 assert.equal(malformed.unparsed,3);
 assert.deepEqual(malformed.rows.map(x=>x.scaled),malformed.rows.map(x=>x.original),
  'Unsupported glyphs and malformed fractional inputs must not be partly processed');
});

test('scaler adjusts both sides of a clear kitchen interval, preserving ambiguous lines unchanged',()=>{
 const x=scaleRecipe('1–2 cups milk\n1½–3 cups flour\n1/2-1 cup sugar\n2 to 3 eggs\n1–2 metric cups water',4,6,{fractions:true});
 assert.equal(x.unparsed,0);
 assert.deepEqual(x.rows.map(r=>r.scaled),[
  '1 1/2–3 cups milk','2 1/4–4 1/2 cups flour','3/4–1 1/2 cups sugar',
  '3–4 1/2 eggs','1 1/2–3 metric cups water'
 ]);
 const unsafe=scaleRecipe('2–1 cups milk\n1 cup + 2 tbsp cream\n1 cup milk 2 tbsp cream\n1–2 cups milk and 3 eggs\n10–20 minutes baking\n1–2 unknown things',4,6,{fractions:true});
 assert.equal(unsafe.unparsed,6);
 assert.deepEqual(unsafe.rows.map(x=>x.scaled),unsafe.rows.map(x=>x.original));
});

test('scaler refuses a second quantity after commas, semicolons or explanatory text',()=>{
 const lines=[
  '1 cup milk, 2 eggs',
  '1 cup milk; 2 eggs',
  '1 cup flour, sifted, 2 eggs',
  '1 cup milk (2 eggs)',
  '2 eggs; 1 onion',
  '1 cup milk, 1/2 tsp cinnamon',
  '1 cup milk and 2 eggs',
  '2 cups milk, 3% fat',
  '1 cup milk; whisk thoroughly'
 ];
 const result=scaleRecipe(lines.join('\n'),4,6,{fractions:true});
 assert.equal(result.unparsed,lines.length,'No multi-quantity or semicolon line may be partially marked successful');
 for(const row of result.rows){
  assert.equal(row.scaled,row.original,'Leave the entire ambiguous row byte-for-byte unchanged');
  assert.equal(row.ok,false,'Flag every ambiguous row for user review');
 }
 const safe=scaleRecipe('1 cup flour, sifted\n2 eggs\n1–2 cups milk\n1 ¹⁄₂ cups flour',4,6,{fractions:true});
 assert.equal(safe.unparsed,0,'Preparation notes and single-quantity lines still work');
 assert.deepEqual(safe.rows.map(x=>x.scaled),[
  '1 1/2 cups flour, sifted',
  '3 eggs',
  '1 1/2–3 cups milk',
  '2 1/4 cups flour'
 ]);
});

test('scaler never treats cooking times, temperatures or percent labels as ingredient amounts',()=>{
 const lines=[
  '15 minutes',
  '15 min',
  '2 hours',
  '30 seconds',
  '350°F',
  '180°C',
  '180 °C',
  '350 F',
  '180 degrees Celsius',
  '350 degrees Fahrenheit',
  '2 days to ferment',
  '1% milk'
 ];
 const result=scaleRecipe(lines.join('\n'),4,6,{fractions:true});
 assert.equal(result.unparsed,lines.length,'Every non-ingredient instruction must request review');
 assert.deepEqual(result.rows.map(row=>row.scaled),lines);
 assert.ok(result.rows.every(row=>!row.ok));
 assert.deepEqual(scaleRecipe('2 eggs\n1 cup milk',4,6,{fractions:true}).rows.map(row=>row.scaled),
  ['3 eggs','1 1/2 cups milk'],'Valid ingredient lines must still scale');
});

test('physical-capacity water and published recipe weight remain separate calculation modes',()=>{
 const water=byId('water');
 assert.equal(convertQuantity(1,'cup','g',{ingredient:water,standard:'us'}),227);
 assert.ok(Math.abs(convertQuantity(1,'cup','g',{ingredient:water,standard:'us',waterMode:'capacity'})-US_CUP_ML)<1e-8);
 assert.equal(convertQuantity(250,'ml','g',{ingredient:water,waterMode:'capacity'}),250);
 assert.ok(convertQuantity(250,'ml','g',{ingredient:water})<250);
 assert.ok(Math.abs(convertQuantity(100,'g','cup',{ingredient:water,waterMode:'capacity'})-100/US_CUP_ML)<1e-9);
 assert.throws(()=>convertQuantity(1,'cup','g',{ingredient:byId('all-purpose-flour'),waterMode:'capacity'}),/only supported for water/);
 assert.throws(()=>convertQuantity(1,'cup','g',{ingredient:water,waterMode:'unknown'}),/valid water measurement/);
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

test('recipe scaler cleans unitless spacing and safely changes common countable ingredient nouns',()=>{
 const larger=scaleRecipe('1 egg\n1 large egg\n2 eggs\n1 clove of garlic\n1 pinch of salt\n1 tomato\n1 leaf lettuce\n1 constructor\n2 unknown items',2,4);
 assert.equal(larger.unparsed,0);
 assert.deepEqual(larger.rows.map(x=>x.scaled),[
  '2 eggs','2 large eggs','4 eggs','2 cloves of garlic','2 pinches of salt',
  '2 tomatoes','2 leaves lettuce','2 constructor','4 unknown items'
 ]);
 const smaller=scaleRecipe('2 large eggs\n2 cloves garlic\n2 pinches salt\n2 tomatoes',4,2);
 assert.deepEqual(smaller.rows.map(x=>x.scaled),[
  '1 large egg','1 clove garlic','1 pinch salt','1 tomato'
 ]);
 assert.equal(scaleRecipe('1 tiny amount of spice',4,2,{fractions:true}).rows[0].scaled,'1/2 tiny amount of spice');
});

test('batch explicit US and metric cup quantities round-trip correctly across selected standards',()=>{
 const flour=byId('all-purpose-flour');
 const source='1 US cup All-purpose flour\n1 metric cup All-purpose flour\n1 cup All-purpose flour';
 const metricPage=batchConvertIngredients(source,{ingredients:foods,target:'g',standard:'metric'});
 assert.equal(metricPage.converted,3);
 assert.equal(metricPage.review,0);
 assert.equal(metricPage.rows[0].output,'120 g All-purpose flour',
  'explicit US cup is not silently treated as metric');
 const metricGrams=convertQuantity(1,'cup','g',{ingredient:flour,standard:'metric'});
 assert.ok(Math.abs(metricPage.rows[1].result-metricGrams)<1e-9);
 assert.ok(Math.abs(metricPage.rows[2].result-metricGrams)<1e-9,'unqualified cup uses selected standard');
 const usPage=batchConvertIngredients('1 metric cup All-purpose flour',{ingredients:foods,target:'cup',standard:'us',fractions:false});
 assert.equal(usPage.converted,1);
 assert.ok(Math.abs(usPage.rows[0].result-METRIC_CUP_ML/US_CUP_ML)<1e-10);
 assert.match(usPage.rows[0].output,/US cups All-purpose flour$/);
 const metricOutput=batchConvertIngredients('1 US cup All-purpose flour',{ingredients:foods,target:'cup',standard:'metric',fractions:false});
 assert.equal(metricOutput.converted,1);
 assert.ok(Math.abs(metricOutput.rows[0].result-US_CUP_ML/METRIC_CUP_ML)<1e-10);
 assert.match(metricOutput.rows[0].output,/metric cup All-purpose flour$/);
 const generated=batchConvertIngredients('120 g all-purpose flour',{ingredients:foods,target:'cup'});
 assert.equal(generated.rows[0].output,'1 US cup All-purpose flour');
 const pasted=batchConvertIngredients(generated.rows[0].output,{ingredients:foods,target:'g',standard:'metric'});
 assert.equal(pasted.rows[0].status,'converted');
 assert.equal(pasted.rows[0].output,'120 g All-purpose flour','the output label can be pasted back as valid input');
});

test('recipe serving scaler pluralizes explicit US and metric cup units without changing the standard',()=>{
 const enlarged=scaleRecipe('1 US cup milk\n½ metric cup cream\n2 metric cups water',2,4,{fractions:true});
 assert.equal(enlarged.unparsed,0);
 assert.deepEqual(enlarged.rows.map(r=>r.scaled),[
  '2 US cups milk','1 metric cup cream','4 metric cups water'
 ]);
 const smaller=scaleRecipe('2 US cups milk\n2 metric cups cream',4,2,{fractions:true});
 assert.deepEqual(smaller.rows.map(r=>r.scaled),['1 US cup milk','1 metric cup cream']);
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
 assert.equal(metric.rows[0].output,'0.9464 metric cup All-purpose flour','metric cups are distinguishable from US cups');
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
