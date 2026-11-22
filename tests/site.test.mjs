import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseAmount,convertQuantity,approximateFraction,scaleRecipe,csvCell,formatKitchenAmount,batchConvertIngredients,US_CUP_ML,METRIC_CUP_ML,US_TBSP_ML} from '../src/core.mjs';
const foods=JSON.parse(fs.readFileSync(new URL('../src/ingredients.json',import.meta.url),'utf8'));
const byId=id=>foods.find(x=>x.id===id);
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
 assert.equal(approximateFraction(.375),'3/8');
 for(const bad of ['','-1','0','3/0','NaN','Infinity','1e309','1/2/3','1,000','a',String(10**20)]){
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
 const fractionStyle=scaleRecipe('1½ cups milk\n½ tsp salt',4,6,{fractions:true});
 assert.equal(fractionStyle.rows[0].scaled,'2 1/4 cups milk');
 assert.equal(fractionStyle.rows[1].scaled,'3/4 tsp salt');
});
test('CSV escaping prevents spreadsheet formula injection',()=>{
 assert.equal(csvCell('=HYPERLINK("bad")'),'"\'=HYPERLINK(""bad"")"');
 assert.equal(csvCell('a,b'),'"a,b"');
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
});
test('Unicode fraction recipe scaler does not mistake unit labels',()=>{
 const scaled=scaleRecipe('1½ cups milk\n½ tsp salt\n3⁄4 cup honey',2,3);
 assert.equal(scaled.unparsed,0);
 assert.equal(scaled.rows[0].scaled,'2.25 cups milk');
 assert.equal(scaled.rows[1].scaled,'0.75 tsp salt');
 assert.equal(scaled.rows[2].scaled,'1.125 cup honey');
});
test('batch conversion uses ingredient-specific values in both directions',()=>{
 const source='120 g all-purpose flour\n198 g granulated sugar\n½ cup butter\n2 tbsp honey';
 const cups=batchConvertIngredients(source,{ingredients:foods,target:'cup'});
 assert.equal(cups.converted,4);
 assert.equal(cups.review,0);
 assert.equal(cups.rows[0].output,'1 cup All-purpose flour');
 assert.equal(cups.rows[1].output,'1 cup Granulated white sugar');
 assert.equal(cups.rows[2].output,'1/2 cups Butter');
 assert.equal(cups.rows[3].output,'1/8 cups Honey');
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
