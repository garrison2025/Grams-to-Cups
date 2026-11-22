import {convertQuantity,formatAmount,parseAmount,approximateFraction,unitDescription,scaleRecipe,csvCell} from './core.mjs';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const ingredients=await fetch('/assets/ingredients.json').then(r=>r.ok?r.json():Promise.reject(new Error('Ingredient data unavailable'))).catch(()=>[]);
const byId=new Map(ingredients.map(i=>[i.id,i]));
const setText=(element,value)=>{if(element)element.textContent=String(value)};
function announce(element,message){if(element){element.hidden=false;setText(element,message)}}
function normalizeUnit(value){return value==='cup'?'cup':value}
function renderCalculator(form){
 const result=$('[data-result]',form),note=$('[data-result-note]',form),error=$('[data-error]',form);
 try{
  const amount=$('[data-amount]',form).value;
  const from=$('[data-from]',form).value,to=$('[data-to]',form).value;
  const ingredient=byId.get($('[data-ingredient]',form)?.value)||null;
  const standard=$('[data-standard]',form)?.value||'us';
  const n=convertQuantity(amount,normalizeUnit(from),normalizeUnit(to),{ingredient,standard});
  const decimals= n>=10000?1:3,unit=unitDescription(to,standard);
  setText(result,formatAmount(n,decimals)+' '+unit);
  const fraction=to==='cup'||to==='tbsp'?approximateFraction(n):'';
  const context=ingredient?'Based on '+formatAmount(ingredient.referenceGrams)+' g / '+formatAmount(ingredient.referenceAmount)+' '+(ingredient.referenceUnit==='cup'?'US cup':'US tablespoon')+' of '+ingredient.name+'.':'Fixed-volume or mass conversion.';
  setText(note, (fraction?'About '+fraction+' '+unit+'. ':'')+context+(ingredient?' Approximate cooking reference.':''));
  if(error)error.hidden=true;
  return {n,amount,from,to,ingredient,standard,unit,context};
 }catch(e){setText(result,'—');setText(note,'Choose a valid amount and ingredient where required.');announce(error,e.message);return null}
}
for(const form of $$('[data-calc]')){
 const controls=$$('input,select',form),update=()=>renderCalculator(form);
 const params=new URLSearchParams(location.search);
 for(const [key,selector] of [['amount','[data-amount]'],['ingredient','[data-ingredient]'],['standard','[data-standard]'],['from','[data-from]'],['to','[data-to]']]){
  const el=$(selector,form),v=params.get(key);
  if(el&&v&&v.length<80&&(el.tagName==='INPUT'||[...el.options].some(o=>o.value===v)))el.value=v;
 }
 controls.forEach(el=>{el.addEventListener('input',update);el.addEventListener('change',update)});
 $('[data-swap]',form)?.addEventListener('click',()=>{
  const from=$('[data-from]',form),to=$('[data-to]',form);[from.value,to.value]=[to.value,from.value];update();
 });
 $('[data-reset]',form)?.addEventListener('click',()=>{
  form.reset();update();
 });
 $('[data-copy]',form)?.addEventListener('click',async()=>{
  const d=update();if(!d)return;
  const text=d.amount+' '+unitDescription(d.from,d.standard)+' of '+(d.ingredient?.name||'the selected measurement')+' ≈ '+formatAmount(d.n,4)+' '+d.unit+'. '+d.context;
  try{await navigator.clipboard.writeText(text);setText($('[data-feedback]',form),'Copied result and source context.')}
  catch{setText($('[data-feedback]',form),'Copy unavailable in this browser. Select the result text to copy it.')}
 });
 $('[data-share]',form)?.addEventListener('click',async()=>{
  const d=update();if(!d)return;
  const u=new URL(location.href);u.search='';
  for(const [k,v] of [['amount',d.amount],['ingredient',d.ingredient?.id],['standard',d.standard],['from',d.from],['to',d.to]])if(v)u.searchParams.set(k,v);
  try{if(navigator.share)await navigator.share({title:document.title,url:u.href});else{await navigator.clipboard.writeText(u.href);setText($('[data-feedback]',form),'Link copied.')}}catch(e){if(e.name!=='AbortError')setText($('[data-feedback]',form),'Sharing unavailable; copy the address bar URL.')}
 });
 $('[data-print]',form)?.addEventListener('click',()=>window.print());
 update();
}
for(const form of $$('[data-recipe]')){
 const out=$('[data-recipe-output]',form),error=$('[data-recipe-error]',form);
 let latest=null;
 const compute=()=>{
  try{latest=scaleRecipe($('[data-recipe-lines]',form).value,$('[data-old-servings]',form).value,$('[data-new-servings]',form).value);
  out.textContent=latest.rows.map(r=>r.scaled+(r.ok?'':'  [check manually]')).join('\n');
  if(error){error.hidden=latest.unparsed===0;error.textContent=latest.unparsed?latest.unparsed+' line(s) could not be safely parsed and were left unchanged.':''}
  }catch(e){latest=null;out.textContent='';announce(error,e.message)}
 };
 form.addEventListener('submit',event=>{event.preventDefault();compute()});
 $$('input,textarea',form).forEach(el=>el.addEventListener('input',compute));
 $('[data-download-csv]',form)?.addEventListener('click',()=>{
  compute();if(!latest)return;
  const text=['Original,Scaled,Parsed',...latest.rows.map(r=>[csvCell(r.original),csvCell(r.scaled),csvCell(r.ok?'yes':'needs review')].join(','))].join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='scaled-recipe.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 $('[data-recipe-print]',form)?.addEventListener('click',()=>window.print());
 compute();
}
for(const form of $$('[data-half-form]')){
 const input=$('[data-half-input]',form),output=$('[data-half-result]',form),error=$('[data-half-error]',form);
 const run=()=>{try{const v=parseAmount(input.value)/2;setText(output,formatAmount(v,4)+(approximateFraction(v)?' (about '+approximateFraction(v)+')':''));if(error)error.hidden=true;}catch(e){setText(output,'—');announce(error,e.message)}};
 input.addEventListener('input',run);run();
}
const toggle=$('[data-nav-toggle]'),nav=$('[data-nav]');
if(toggle&&nav){
 toggle.addEventListener('click',()=>{const open=nav.classList.toggle('is-open');toggle.setAttribute('aria-expanded',String(open))});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){nav.classList.remove('is-open');toggle.setAttribute('aria-expanded','false')}});
}
for(const filter of $$('[data-directory-filter]'))filter.addEventListener('input',()=>{
 const q=filter.value.trim().toLowerCase();
 for(const item of $$('[data-filter-item]'))item.hidden=!item.textContent.toLowerCase().includes(q);
});

for(const button of $$('[data-chart-print]'))button.addEventListener('click',()=>window.print());
