export const US_CUP_ML=236.5882365;
export const METRIC_CUP_ML=250;
export const US_TBSP_ML=14.78676478125;
export const US_TSP_ML=US_TBSP_ML/3;
export const US_FL_OZ_ML=US_CUP_ML/8;
export const G_PER_OZ=28.349523125;

const VULGAR_FRACTIONS=Object.freeze({'¼':'1/4','½':'1/2','¾':'3/4','⅓':'1/3','⅔':'2/3','⅛':'1/8','⅜':'3/8','⅝':'5/8','⅞':'7/8'});
function normalizeFractionInput(value){
 return String(value??'').trim().replace(/[\u00a0\u202f]/g,' ').replace(/\u2044/g,'/')
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
  else if(/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(s))n=Number(s);
  else throw new Error('Use a number, 1/4, or 1 1/2.');
  if(!Number.isFinite(n)||n<=0||n>1e9)throw new Error('Amount must be greater than zero and at most one billion.');
  return n;
}
export const formatAmount=(n,digits=3)=>{
 if(!Number.isFinite(n))throw new Error('The result is not finite.');
 return new Intl.NumberFormat('en-US',{maximumFractionDigits:digits}).format(n);
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
export function convertQuantity(amount,from,to,{ingredient=null,standard='us'}={}){
 const n=typeof amount==='number'?amount:parseAmount(amount);
 if(!Number.isFinite(n)||n<0||n>1e9)throw new Error('Invalid amount.');
 const mlUnits={cup:cupMl(standard),tbsp:US_TBSP_ML,tsp:US_TSP_ML,ml:1,'fl-oz':US_FL_OZ_ML};
 const gUnits={g:1,oz:G_PER_OZ,kg:1000};
 const a=Object.hasOwn(gUnits,from)?'mass':Object.hasOwn(mlUnits,from)?'volume':null;
 const b=Object.hasOwn(gUnits,to)?'mass':Object.hasOwn(mlUnits,to)?'volume':null;
 if(!a||!b)throw new Error('Unsupported unit.');
 const base=a==='mass'?n*gUnits[from]:n*mlUnits[from];
 if(a===b)return base/(b==='mass'?gUnits[to]:mlUnits[to]);
 const density=gramsPerMl(ingredient);
 return (a==='mass'?base/density:base*density)/(b==='mass'?gUnits[to]:mlUnits[to]);
}
export function unitDescription(code,standard='us'){
 return ({g:'grams',kg:'kilograms',oz:'mass ounces',cup:standard==='metric'?'metric cups (250 mL)':'US cups (236.588 mL)',tbsp:'US tablespoons',tsp:'US teaspoons',ml:'milliliters','fl-oz':'US fluid ounces'})[code]||code;
}
export function scaleRecipe(text,originalServings,newServings,{fractions=false}={}){
 const source=parseAmount(originalServings),dest=parseAmount(newServings);
 const factor=dest/source;if(factor>1000||factor<0.001)throw new Error('Scaling factor must be between 0.001 and 1,000.');
 const rows=String(text??'').split(/\r?\n/);
 if(rows.length>100)throw new Error('Limit the recipe to 100 lines.');
 const output=rows.map(raw=>{
  if(!raw.trim())return {original:raw,scaled:'',ok:true};
  const m=normalizeFractionInput(raw).match(/^\s*((?:\d+\s+)?\d+\/\d+|\d+\s?[¼½¾⅓⅔⅛⅜⅝⅞]|[¼½¾⅓⅔⅛⅜⅝⅞]|(?:\d+(?:\.\d*)?|\.\d+))\s*(?:(g|grams?|kg|oz|ounces?|cups?|tbsp|tablespoons?|tsp|teaspoons?|ml|milliliters?)\b)?(.*)$/i);
  if(!m)return {original:raw,scaled:raw,ok:false};
  try{const scaled=parseAmount(m[1])*factor;if(!Number.isFinite(scaled)||scaled>1e9)throw Error();
  return {original:raw,scaled:(fractions?formatKitchenAmount(scaled):formatAmount(scaled,4))+' '+(m[2]||'')+(m[3]||''),ok:true};
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
   if(numerator===0)return String(whole);
   if(numerator===denominator)return String(whole+1);
   const gcd=(a,b)=>b?gcd(b,a%b):a,g=gcd(numerator,denominator);
   return (whole?whole+' ':'')+numerator/g+'/'+denominator/g;
  }
 }
 return formatAmount(value,precision);
}
const UNIT_ALIASES=Object.freeze({
 g:'g',gram:'g',grams:'g',kg:'kg',kilogram:'kg',kilograms:'kg',
 oz:'oz',ounce:'oz',ounces:'oz',
 cup:'cup',cups:'cup',tbsp:'tbsp',tablespoon:'tbsp',tablespoons:'tbsp',
 tsp:'tsp',teaspoon:'tsp',teaspoons:'tsp',
 ml:'ml',milliliter:'ml',milliliters:'ml',millilitre:'ml',millilitres:'ml',
 'fl oz':'fl-oz','fluid ounce':'fl-oz','fluid ounces':'fl-oz'
});
const BATCH_LINE=/^\s*(\d+\s+\d+\/\d+|\d+\s*[¼½¾⅓⅔⅛⅜⅝⅞]|\d+\/\d+|[¼½¾⅓⅔⅛⅜⅝⅞]|\d+(?:\.\d*)?|\.\d+)\s*(fluid ounces?|fl\.?\s*oz|millilit(?:er|re)s?|kilograms?|tablespoons?|teaspoons?|ounces?|grams?|cups?|tbsp|tsp|ml|kg|oz|g)\b\s+(.+?)\s*$/i;
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
  const unit=UNIT_ALIASES[rawUnit.toLowerCase().replace(/\./g,'').replace(/\s+/g,' ').trim()];
  if(!unit)return {index,original,status:'review',output:original,reason:'Unsupported measurement unit.',ingredient:''};
  const food=resolveIngredient(foodName,ingredients);
  if(!food)return {index,original,status:'review',output:original,reason:'Ingredient not matched unambiguously. Use the exact ingredient name listed on the site.',ingredient:foodName.trim()};
  try{
   const amount=parseAmount(rawAmount);
   const result=convertQuantity(amount,unit,target,{ingredient:food,standard});
   return {index,original,status:'converted',output:formatKitchenAmount(result,{fractions:fractions&&target==='cup'})+' '+(target==='cup'?(result<=1+1e-10?'cup':'cups'):'g')+' '+food.name,
     amount,result,from:unit,to:target,ingredient:food.name,ingredientId:food.id,reason:'Reference: '+food.referenceGrams+' g / '+food.referenceAmount+' '+food.referenceUnit};
  }catch(error){
   return {index,original,status:'review',output:original,reason:error.message,ingredient:food.name};
  }
 });
 return {rows,converted:rows.filter(x=>x.status==='converted').length,
         review:rows.filter(x=>x.status==='review').length,
         blank:rows.filter(x=>x.status==='blank').length,
         target,standard};
}
