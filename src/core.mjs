export const US_CUP_ML=236.5882365;
export const METRIC_CUP_ML=250;
export const US_TBSP_ML=14.78676478125;
export const US_TSP_ML=US_TBSP_ML/3;
export const US_FL_OZ_ML=US_CUP_ML/8;
export const G_PER_OZ=28.349523125;

const VULGAR_FRACTIONS=Object.freeze({'¼':'1/4','½':'1/2','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'});
const SUPERSCRIPT_DIGITS=Object.freeze({'⁰':'0','¹':'1','²':'2','³':'3','⁴':'4','⁵':'5','⁶':'6','⁷':'7','⁸':'8','⁹':'9'});
const SUBSCRIPT_DIGITS=Object.freeze({'₀':'0','₁':'1','₂':'2','₃':'3','₄':'4','₅':'5','₆':'6','₇':'7','₈':'8','₉':'9'});
const translateNumeral=(symbols,map)=>[...symbols].map(x=>map[x]).join('');

function normalizeFractionInput(value){
 return String(value??'').trim().replace(/[\u00a0\u202f]/g,' ')
 .replace(/([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\s*[\u2044/]\s*([₀₁₂₃₄₅₆₇₈₉]+)/g,
  (_,numerator,denominator)=>translateNumeral(numerator,SUPERSCRIPT_DIGITS)+'/'+translateNumeral(denominator,SUBSCRIPT_DIGITS))
 .replace(/\u2044/g,'/')
 .replace(/(\d)([¼½¾⅓⅔⅛⅜⅝⅞])/g,(_,whole,symbol)=>whole+' '+VULGAR_FRACTIONS[symbol])
 .replace(/[¼½¾⅓⅔⅛⅜⅝⅞]/g,symbol=>VULGAR_FRACTIONS[symbol])
 .replace(/\s+/g,' ').trim();
}

export function parseAmount(input){
  const s=normalizeFractionInput(input);
  if(!s||s.length>48) throw new Error('Enter a reasonable, positive amount.');
  let n;
  const mixed=s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  const frac=s.match(/^(\d+)\/(\d+)$/);
  if(mixed){const d=Number(mixed[3]);if(!d)throw new Error('A fraction cannot have a zero denominator.');n=Number(mixed[1])+Number(mixed[2])/d;}
  else if(frac){const d=Number(frac[2]);if(!d)throw new Error('A fraction cannot have a zero denominator.');n=Number(frac[1])/d;}
  else if(/^(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?$/.test(s)||/^\.\d+$/.test(s))
   n=Number(s.replaceAll(',',''));
  else throw new Error('Use a number, 1/4, or 1 1/2.');
  if(!Number.isFinite(n)||n<=0||n>1e9)throw new Error('Amount must be greater than zero and at most one billion.');
  return n;
}
export const formatAmount=(n,digits=3)=>{
 if(!Number.isFinite(n))throw new Error('The result is not finite.');
 const formatted=new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(n);
 // A small positive conversion must never display as zero after rounding.
 if(n>0&&Number(formatted.replaceAll(',',''))===0)return Number(n.toPrecision(3)).toString();
 return formatted;
};
export function approximateFraction(value){
 if(!Number.isFinite(value)||value<0||value>1e7)return '';
 const whole=Math.floor(value), part=value-whole, denom=16, numerator=Math.round(part*denom),error=Math.abs(part-numerator/denom);
 if(error>0.015)return '';
 if(numerator===0)return whole?String(whole):''; // Never suggest "about zero" for a positive amount.
 if(numerator===denom)return String(whole+1);
 const gcd=(a,b)=>b?gcd(b,a%b):a;const g=gcd(numerator,denom);
 return [whole||'',String(numerator/g)+'/'+String(denom/g)].filter(Boolean).join(' ');
}
export function cupMl(standard='us'){
 if(standard==='us')return US_CUP_ML;
 if(standard==='metric')return METRIC_CUP_ML;
 throw new Error('Unknown cup standard.');
}
export function gramsPerMl(ingredient){
 if(!ingredient||!['recipe_reference'].includes(ingredient.referenceType))throw new Error('Choose a supported ingredient for mass-to-volume conversions.');
 const baseMl=ingredient.referenceUnit==='cup'?ingredient.referenceAmount*ingredient.referenceCupMl:
 ingredient.referenceUnit==='tablespoon'?ingredient.referenceAmount*US_TBSP_ML:
 ingredient.referenceUnit==='teaspoon'?ingredient.referenceAmount*US_TSP_ML:NaN;
 if(!Number.isFinite(baseMl)||baseMl<=0||!(ingredient.referenceGrams>0))throw new Error('Invalid reference data.');
 return ingredient.referenceGrams/baseMl;
}
export function convertQuantity(amount,from,to,{ingredient=null,standard='us',waterMode='recipe'}={}){
 const n=typeof amount==='number'?amount:parseAmount(amount);
 if(!Number.isFinite(n)||n<0||n>1e9)throw new Error('Invalid amount.');
 const mlUnits={cup:cupMl(standard),tbsp:US_TBSP_ML,tsp:US_TSP_ML,ml:1,'fl-oz':US_FL_OZ_ML};
 const gUnits={g:1,oz:G_PER_OZ,kg:1000};
 const a=Object.hasOwn(gUnits,from)?'mass':Object.hasOwn(mlUnits,from)?'volume':null;
 const b=Object.hasOwn(gUnits,to)?'mass':Object.hasOwn(mlUnits,to)?'volume':null;
 if(!a||!b)throw new Error('Unsupported unit.');
 const base=a==='mass'?n*gUnits[from]:n*mlUnits[from];
 if(a===b)return base/(b==='mass'?gUnits[to]:mlUnits[to]);
 if(!['recipe','capacity'].includes(waterMode))throw new Error('Choose a valid water measurement method.');
 if(waterMode==='capacity'&&ingredient?.id!=='water')
  throw new Error('Capacity-based mass estimates are only supported for water.');
 // Approximate physical-volume mode at ~1 g/mL (temperature changes water density).
 // The recipe-reference mode instead preserves the documented 227 g per US cup.
 const density=waterMode==='capacity'?1:gramsPerMl(ingredient);
 return (a==='mass'?base/density:base*density)/(b==='mass'?gUnits[to]:mlUnits[to]);
}
export function unitDescription(code,standard='us'){
 return ({g:'grams',kg:'kilograms',oz:'mass ounces',cup:standard==='metric'?'metric cups (250 mL)':'US cups (236.588 mL)',tbsp:'US tablespoons',tsp:'US teaspoons',ml:'milliliters','fl-oz':'US fluid ounces'})[code]||code;
}
// Common countable ingredient nouns can change between singular and plural
// when serving counts change. Never infer a density or change unknown food names.
const COUNTABLE_INGREDIENT_NOUNS=Object.freeze({
 egg:'eggs',onion:'onions',clove:'cloves',apple:'apples',banana:'bananas',
 lemon:'lemons',lime:'limes',carrot:'carrots',tomato:'tomatoes',potato:'potatoes',
 slice:'slices',can:'cans',pinch:'pinches',stick:'sticks',piece:'pieces',
 leaf:'leaves',loaf:'loaves',sprig:'sprigs',packet:'packets',bag:'bags',
 head:'heads',bunch:'bunches',cube:'cubes'
});
const COUNTABLE_PLURALS=Object.fromEntries(Object.entries(COUNTABLE_INGREDIENT_NOUNS).map(([one,many])=>[many,one]));
function scaledCountableNoun(suffix,amount){
 const m=String(suffix).match(/^(\s*(?:(?:large|medium|small|whole|fresh|ripe|chopped|crushed|diced)\s+)*)([a-z]+)(\b.*)$/i);
 if(!m)return suffix;
 const current=m[2].toLowerCase();
 const singular=Object.hasOwn(COUNTABLE_INGREDIENT_NOUNS,current)?current:Object.hasOwn(COUNTABLE_PLURALS,current)?COUNTABLE_PLURALS[current]:null;
 if(!singular)return suffix;
 const replacement=amount<=1?singular:COUNTABLE_INGREDIENT_NOUNS[singular];
 const text=m[2][0]===m[2][0].toUpperCase()?replacement[0].toUpperCase()+replacement.slice(1):replacement;
 return m[1]+text+m[3];
}
// Accept only full, unambiguous quantities. Unsupported glyphs are preserved
// for manual review rather than scaling only the leading number.
const RECIPE_AMOUNT=/(?:(?:\d+\s+)?\d+\/\d+|(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)/.source;
const RECIPE_UNIT=/(?:g|grams?|kg|oz|ounces?|(?:(?:US|metric)\s+)?cups?|tbsp|tablespoons?|tsp|teaspoons?|ml|milliliters?)/.source;
const RECIPE_RANGE=new RegExp('^\\s*('+RECIPE_AMOUNT+')\\s*(?:[-–—]|to\\b)\\s*('+RECIPE_AMOUNT+')\\s*(?:('+RECIPE_UNIT+')\\b)?(.*)$','i');
const RECIPE_SINGLE=new RegExp('^\\s*('+RECIPE_AMOUNT+')\\s*(?:('+RECIPE_UNIT+')\\b)?(.*)$','i');
function scaledUnit(unit,amount){
 if(!unit)return '';
 const stem=/^((?:(?:US|metric)\s+)?cups?|tablespoons?|teaspoons?|grams?|ounces?|milliliters?)$/i.test(unit)
  ?unit.replace(/s$/i,''):null;
 return stem?(amount<=1?stem:stem+'s'):unit;
}
function unsafeIngredientRemainder(text){
 const rest=String(text);
 // A recipe row is atomic: if another independent amount occurs anywhere after
 // the first one, do not scale only the first ingredient. This catches
 // "1 cup milk, 2 eggs", "1 cup milk; 2 eggs", bare counts, mixed fractions,
 // quantities in parentheses, and quantities after preparation notes.
 // Numeric food descriptions like "2% milk" are intentionally conservative:
 // leave the whole line unchanged rather than guessing.
 const secondAmount=/(?:^|[^\p{L}\p{N}])(?:\d+(?:[.,]\d+)?(?:\/\d+)?|\.\d+)(?=$|[^\p{L}\p{N}])/u;
 const spelledSecondAmount=/(?:,|，|\band\b|\bplus\b|\bwith\b)\s*(?:(?:about|roughly|approximately)\s+)?(?:one|two|three|four|five|six|seven|eight|nine|ten|half|quarter|an?|a\s+few)\b/iu;
 return /;/u.test(rest)||
  secondAmount.test(rest)||
  spelledSecondAmount.test(rest)||
  /^\s*[,\.]\s*\d/u.test(rest)||
  /^\s*(?:[-–—/]|to\b|or\b)\s*(?:\d|\.)/iu.test(rest)||
  /(?:\+|&|\band\b|\bplus\b)\s*(?:\d|\.)/iu.test(rest)||
  /\b\d+(?:\.\d+)?\s*(?:g|grams?|kg|oz|ounces?|cups?|tbsp|tablespoons?|tsp|teaspoons?|ml|milliliters?)\b/iu.test(rest)||
  /[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉\u2044]/u.test(rest);
}
function isStandaloneCookingInstruction(remainder){
 // No unit was recognized. Temperature, cooking durations and heat settings
 // must never become scaled ingredient weights or counts.
 return /^\s*(?:°\s*[cf]\b|degrees?\b|fahrenheit\b|celsius\b|kelvin\b|minutes?\b|mins?\b|hours?\b|hrs?\b|seconds?\b|secs?\b|days?\b|weeks?\b|[cf]\b(?:\s|$)|%)/iu.test(remainder);
}
export function scaleRecipe(text,originalServings,newServings,{fractions=false}={}){
 const source=parseAmount(originalServings),dest=parseAmount(newServings);
 const factor=dest/source;if(factor>1000||factor<0.001)throw new Error('Scaling factor must be between 0.001 and 1,000.');
 const rows=String(text??'').split(/\r?\n/);
 if(rows.length>100)throw new Error('Limit the recipe to 100 lines.');
 const output=rows.map(raw=>{
  if(!raw.trim())return {original:raw,scaled:'',ok:true};
  const normalized=normalizeFractionInput(raw);
  if(/[⁰¹²³⁴⁵⁶⁷⁸⁹₀₁₂₃₄₅₆₇₈₉\u2044]/u.test(normalized))
   return {original:raw,scaled:raw,ok:false};
  const range=normalized.match(RECIPE_RANGE);
  const single=range?null:normalized.match(RECIPE_SINGLE);
  const match=range||single;
  if(!match)return {original:raw,scaled:raw,ok:false};
  const isRange=!!range;
  const first=match[1],second=isRange?match[2]:null;
  const unit=isRange?(match[3]||''):(match[2]||'');
  const rest=isRange?(match[4]||''):(match[3]||'');
  if(unsafeIngredientRemainder(rest))return {original:raw,scaled:raw,ok:false};
  if(!unit&&isStandaloneCookingInstruction(rest))
   return {original:raw,scaled:raw,ok:false};
  // In an interval with no stated kitchen unit, scale only recognizable
  // countable ingredient nouns; do not alter time/temperature/method ranges.
  if(isRange&&!unit){
   const noun=rest.match(/^\s*(?:(?:large|medium|small|whole|fresh|ripe|chopped|crushed|diced)\s+)*([a-z]+)\b/i)?.[1]?.toLowerCase();
   if(!noun||(!Object.hasOwn(COUNTABLE_INGREDIENT_NOUNS,noun)&&!Object.hasOwn(COUNTABLE_PLURALS,noun)))
    return {original:raw,scaled:raw,ok:false};
  }
  try{
   const lowRaw=parseAmount(first),highRaw=isRange?parseAmount(second):lowRaw;
   if(highRaw<lowRaw)throw Error('Descending recipe range.');
   const low=lowRaw*factor,high=highRaw*factor;
   if(!Number.isFinite(low)||!Number.isFinite(high)||high>1e9)throw Error('Scaled quantity out of range.');
   const show=n=>fractions?formatKitchenAmount(n):formatAmount(n,4);
   const finalUnit=scaledUnit(unit,high);
   const finalRest=unit?rest:scaledCountableNoun(rest,high);
   const suffix=unit?' '+finalUnit+finalRest:finalRest.trim()?' '+finalRest.trimStart():'';
   const amountDisplay=isRange?show(low)+'–'+show(high):show(low);
   return {original:raw,scaled:amountDisplay+suffix,ok:true};
  }catch{return {original:raw,scaled:raw,ok:false};}
 });
 return {rows:output,factor,unparsed:output.filter(r=>!r.ok).length};
}
export function csvCell(s){
 const value=String(s??'');
 // Quoted CSV cells can still be evaluated as formulas by spreadsheet applications.
 // Include leading spaces, controls and zero-width characters in the check.
 const safe=/^[\s\u0000-\u001f\u200b-\u200d\ufeff]*[=+@-]/u.test(value)?"'"+value:value;
 return '"'+safe.replaceAll('"','""')+'"';
}


// Strict kitchen-friendly display: show a fraction only when it is effectively exact.
export function formatKitchenAmount(value,{fractions=true,precision=4}={}){
 if(!Number.isFinite(value)||value<0||value>1e9)throw new Error('Invalid scaled quantity.');
 if(fractions){
  const whole=Math.floor(value),remainder=value-whole;
  for(const denominator of [2,3,4,6,8,16]){
   const numerator=Math.round(remainder*denominator);
   if(Math.abs(remainder-numerator/denominator)>1e-7)continue;
   if(numerator===0)return remainder===0?formatAmount(whole,0):formatAmount(value,precision);
   if(numerator===denominator)return formatAmount(whole+1,0);
   const gcd=(a,b)=>b?gcd(b,a%b):a,g=gcd(numerator,denominator);
   return (whole?formatAmount(whole,0)+' ':'')+numerator/g+'/'+denominator/g;
  }
 }
 return formatAmount(value,precision);
}
// Exact rational arithmetic for a kitchen measuring task, rather than using
// floating-point addition and approximating common fractions (e.g. 1/3 + 1/4).
// The UI intentionally defaults to 1/2 + 1/4 = 3/4.
function exactKitchenRational(input){
 // Reuse the same strict positive-quantity validation as every other tool.
 parseAmount(input);
 const normalized=normalizeFractionInput(input);
 const mixed=normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/);
 const simple=normalized.match(/^(\d+)\/(\d+)$/);
 let numerator,denominator;
 if(mixed){
  denominator=BigInt(mixed[3]);
  numerator=BigInt(mixed[1])*denominator+BigInt(mixed[2]);
 }else if(simple){
  numerator=BigInt(simple[1]);
  denominator=BigInt(simple[2]);
 }else{
  const raw=normalized.replaceAll(',','');
  const pieces=raw.split('.');
  denominator=10n**BigInt(pieces[1]?.length||0);
  numerator=BigInt((pieces[0]||'0')+(pieces[1]||''));
 }
 if(denominator<=0n)throw new Error('A fraction cannot have a zero denominator.');
 return {numerator,denominator};
}
function bigintGcd(a,b){while(b!==0n){[a,b]=[b,a%b]}return a}
export function calculateKitchenFractions(first,operation,second){
 if(!['+','-','*','/'].includes(operation))throw new Error('Choose add, subtract, multiply or divide.');
 const a=exactKitchenRational(first),b=exactKitchenRational(second);
 let numerator,denominator;
 switch(operation){
  case '+':numerator=a.numerator*b.denominator+b.numerator*a.denominator;denominator=a.denominator*b.denominator;break;
  case '-':numerator=a.numerator*b.denominator-b.numerator*a.denominator;denominator=a.denominator*b.denominator;break;
  case '*':numerator=a.numerator*b.numerator;denominator=a.denominator*b.denominator;break;
  default:numerator=a.numerator*b.denominator;denominator=a.denominator*b.numerator;
 }
 if(denominator<=0n||numerator<0n)throw new Error('The resulting kitchen quantity cannot be negative.');
 const divisor=bigintGcd(numerator,denominator);
 numerator/=divisor;denominator/=divisor;
 const value=Number(numerator)/Number(denominator);
 if(!Number.isFinite(value)||value>1e9)throw new Error('Result is too large for a kitchen measurement.');
 const decimal=formatAmount(value,6);
 const exact=denominator<=64n;
 const whole=numerator/denominator,remainder=numerator%denominator;
 const fraction=exact?(remainder===0n?formatAmount(Number(whole),0):
  (whole?formatAmount(Number(whole),0)+' ':'')+remainder+'/'+denominator):decimal;
 return {value,decimal,fraction,exact};
}

const UNIT_ALIASES=Object.freeze({
 g:'g',gram:'g',grams:'g',kg:'kg',kilogram:'kg',kilograms:'kg',
 oz:'oz',ounce:'oz',ounces:'oz',
 cup:'cup',cups:'cup','us cup':'cup','us cups':'cup','metric cup':'cup','metric cups':'cup',tbsp:'tbsp',tablespoon:'tbsp',tablespoons:'tbsp',
 tsp:'tsp',teaspoon:'tsp',teaspoons:'tsp',
 ml:'ml',milliliter:'ml',milliliters:'ml',millilitre:'ml',millilitres:'ml',
 'fl oz':'fl-oz','fluid ounce':'fl-oz','fluid ounces':'fl-oz'
});
const BATCH_LINE=/^\s*(\d+\s+\d+\/\d+|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)\s*(fluid ounces?|fl\.?\s*oz|millilit(?:er|re)s?|kilograms?|tablespoons?|teaspoons?|ounces?|grams?|(?:US\s+|metric\s+)?cups?|tbsp|tsp|ml|kg|oz|g)\b\s+(.+?)\s*$/i;
const normalizedName=s=>String(s).toLowerCase().replace(/[-_]+/g,' ').replace(/[’']/g,'').replace(/\s+/g,' ').trim();
function resolveIngredient(name,ingredients){
 const normalized=normalizedName(name);
 // Exact name matches only: "flour" could mean several different ingredients.
 const candidates=ingredients.filter(food=>
  [food.name,...(food.aliases||[])].some(alias=>normalizedName(alias)===normalized));
 return candidates.length===1?candidates[0]:null;
}
export function batchConvertIngredients(text,{ingredients,target='cup',standard='us',fractions=true}={}){
 if(!Array.isArray(ingredients)||ingredients.length===0)throw new Error('The source-backed ingredient list is unavailable.');
 if(!['cup','g'].includes(target))throw new Error('Choose cups or grams as the result unit.');
 cupMl(standard);
 const raw=String(text??'');
 if(raw.length>16000)throw new Error('Limit the ingredient list to 16,000 characters.');
 const lines=raw.split(/\r?\n/);
 if(lines.length>100)throw new Error('Limit the ingredient list to 100 lines.');
 const rows=lines.map((original,index)=>{
  if(!original.trim())return {index,original,status:'blank',output:'',reason:'',ingredient:''};
  const match=normalizeFractionInput(original).match(BATCH_LINE);
  if(!match)return {index,original,status:'review',output:original,reason:'Use amount + unit + a specific ingredient (e.g., 200 g all-purpose flour).',ingredient:''};
  const [,rawAmount,rawUnit,foodName]=match;
  const cleanedUnit=rawUnit.toLowerCase().replace(/\./g,'').replace(/\s+/g,' ').trim();
  const unit=UNIT_ALIASES[cleanedUnit];
  // An explicit input cup standard takes precedence over the global result standard.
  const sourceStandard=cleanedUnit.startsWith('us cup')?'us':cleanedUnit.startsWith('metric cup')?'metric':standard;
  if(!unit)return {index,original,status:'review',output:original,reason:'Unsupported measurement unit.',ingredient:''};
  const food=resolveIngredient(foodName,ingredients);
  if(!food)return {index,original,status:'review',output:original,reason:'Ingredient not matched unambiguously. Use the exact ingredient name listed on the site.',ingredient:foodName.trim()};
  try{
   const amount=parseAmount(rawAmount);
   const result=unit==='cup'&&target==='cup'&&sourceStandard!==standard
    ?convertQuantity(convertQuantity(amount,'cup','ml',{standard:sourceStandard}),'ml','cup',{standard})
    :convertQuantity(amount,unit,target,{ingredient:food,standard:unit==='cup'?sourceStandard:standard});
   const quantityUnit=target==='cup'?(standard==='metric'?'metric':'US')+' cup'+(result<=1+1e-10?'':'s'):'g';
   const originalUnit=food.referenceUnit==='cup'?'US cup':food.referenceUnit==='tablespoon'?'US tablespoon':'US teaspoon';
   return {index,original,status:'converted',output:formatKitchenAmount(result,{fractions:fractions&&target==='cup'})+' '+quantityUnit+' '+food.name,
     amount,result,from:unit,to:target,sourceStandard:unit==='cup'?sourceStandard:null,ingredient:food.name,ingredientId:food.id,reason:'Reference: '+food.referenceGrams+' g / '+food.referenceAmount+' '+originalUnit};
  }catch(error){
   return {index,original,status:'review',output:original,reason:error.message,ingredient:food.name};
  }
 });
 return {rows,converted:rows.filter(x=>x.status==='converted').length,
         review:rows.filter(x=>x.status==='review').length,
         blank:rows.filter(x=>x.status==='blank').length,
         target,standard};
}
