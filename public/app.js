import {convertQuantity,formatAmount,parseAmount,approximateFraction,unitDescription,scaleRecipe,csvCell} from './core.mjs';
const $=(selector,root=document)=>root.querySelector(selector);
const $$=(selector,root=document)=>[...root.querySelectorAll(selector)];
const ingredients=await fetch('/assets/ingredients.json').then(r=>r.ok?r.json():Promise.reject(new Error('Ingredient data unavailable'))).catch(()=>[]);
const byId=new Map(ingredients.map(i=>[i.id,i]));
const setText=(element,value)=>{if(element)element.textContent=String(value)};
function announce(element,message){if(element){element.hidden=false;setText(element,message)}}
function normalizeUnit(value){return value==='cup'?'cup':value}
const shortLabel=(unit,standard)=>{
 const labels={g:'g',kg:'kg',oz:'oz',cup:standard==='metric'?'metric cups':'US cups',tbsp:'tbsp',tsp:'tsp',ml:'mL','fl-oz':'US fl oz'};
 return labels[unit]||unit;
};
function renderCalculator(form){
 const result=$('[data-result]',form),note=$('[data-result-note]',form),error=$('[data-error]',form);
 const from=$('[data-from]',form)?.value||'g',to=$('[data-to]',form)?.value||'cup';
 const standard=$('[data-standard]',form)?.value||'us';
 const ingredient=byId.get($('[data-ingredient]',form)?.value)||null;
 const isCrossDimension=(['g','kg','oz'].includes(from))!==(['g','kg','oz'].includes(to));
 const choices=$$('[data-amount-preset]',form);
 const presetValues=from==='cup'?[.25,.5,1,2]:['tbsp','tsp','fl-oz','oz'].includes(from)?[1,2,4,8]:from==='kg'?[.1,.25,.5,1]:[50,100,200,250];
 choices.forEach((b,i)=>{
  const value=presetValues[i];
  if(value===undefined)return;
  b.dataset.amountPreset=String(value);
  b.textContent=String(value)+' '+(from==='cup'?'cup':shortLabel(from,standard));
  let active=false;
  try{active=Math.abs(parseAmount($('[data-amount]',form)?.value)-value)<1e-9}catch{}
  b.setAttribute('aria-pressed',String(active));
 });
 $$('[data-ingredient-preset]',form).forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.ingredientPreset===ingredient?.id)));
 try{
  const amount=$('[data-amount]',form).value;
  const n=convertQuantity(amount,from,to,{ingredient,standard});
  const decimals=n>=10000?1:n<.01?5:3;
  setText(result,formatAmount(n,decimals));
  setText($('[data-result-unit]',form),shortLabel(to,standard));
  const fraction=(to==='cup'||to==='tbsp')?approximateFraction(n):'';
  const cupSize=standard==='metric'?'metric':'US';
  const refText=ingredient?formatAmount(ingredient.referenceGrams)+' g per '+formatAmount(ingredient.referenceAmount)+' '+(ingredient.referenceUnit==='cup'?'US cup':'US tablespoon'):'';
  const context=isCrossDimension
    ?'Based on '+refText+' of '+ingredient?.name+'. This is an approximate recipe measurement.'
    :'These units have a defined conversion; an ingredient reference is not needed.';
  setText(note,(fraction?'Approximately '+fraction+' '+shortLabel(to,standard)+'. ':'')+context);
  setText($('[data-meta-ingredient]',form),isCrossDimension?ingredient?.name:'Standard units');
  setText($('[data-meta-reference]',form),isCrossDimension?refText:'Defined unit relationship');
  const wrap=$('[data-meter-wrap]',form);
  if(wrap){
   const shown=to==='cup'&&n>0&&n<=1;
   wrap.hidden=!shown;
   if(shown){
    const percent=Math.round(n*100);
    const bar=$('[data-meter-fill]',form);
    if(bar)bar.style.width=Math.max(0,Math.min(100,percent))+'%';
    setText($('[data-meter-label]',form),percent+'% of one '+cupSize+' cup');
   }
  }
  if(error)error.hidden=true;
  return {n,amount,from,to,ingredient,standard,unit:unitDescription(to,standard),context};
 }catch(ex){
  setText(result,'—');
  setText($('[data-result-unit]',form),'');
  setText(note,'Enter a valid quantity and choose an ingredient where needed.');
  if($('[data-meter-wrap]',form))$('[data-meter-wrap]',form).hidden=true;
  announce(error,ex.message);
  return null;
 }
}
for(const form of $$('[data-calc]')){
 const update=()=>renderCalculator(form);
 const params=new URLSearchParams(location.search);
 for(const [key,selector] of [['amount','[data-amount]'],['ingredient','[data-ingredient]'],['standard','[data-standard]'],['from','[data-from]'],['to','[data-to]']]){
  const el=$(selector,form),v=params.get(key);
  if(el&&v&&v.length<80&&(el.tagName==='INPUT'||[...el.options].some(o=>o.value===v)))el.value=v;
 }
 $$('input,select',form).forEach(el=>{el.addEventListener('input',update);el.addEventListener('change',update)});
 $$('[data-amount-preset]',form).forEach(button=>button.addEventListener('click',()=>{
  $('[data-amount]',form).value=button.dataset.amountPreset;update();
 }));
 $$('[data-ingredient-preset]',form).forEach(button=>button.addEventListener('click',()=>{
  $('[data-ingredient]',form).value=button.dataset.ingredientPreset;update();
 }));
 $('[data-swap]',form)?.addEventListener('click',()=>{
  const from=$('[data-from]',form),to=$('[data-to]',form);
  [from.value,to.value]=[to.value,from.value];update();
 });
 $('[data-reset]',form)?.addEventListener('click',()=>{
  form.reset();setText($('[data-feedback]',form),'');update();
 });
 $('[data-copy]',form)?.addEventListener('click',async()=>{
  const d=update();if(!d)return;
  const text=d.amount+' '+unitDescription(d.from,d.standard)+' of '+(d.ingredient?.name||'the measurement')+' ≈ '+formatAmount(d.n,4)+' '+d.unit+'. '+d.context;
  try{await navigator.clipboard.writeText(text);setText($('[data-feedback]',form),'Copied conversion and its context.')}
  catch{setText($('[data-feedback]',form),'Clipboard unavailable. Select the displayed result to copy it.')}
 });
 $('[data-share]',form)?.addEventListener('click',async()=>{
  const d=update();if(!d)return;
  const u=new URL(location.href);u.search='';
  for(const [k,v] of [['amount',d.amount],['ingredient',d.ingredient?.id],['standard',d.standard],['from',d.from],['to',d.to]])if(v)u.searchParams.set(k,v);
  try{
   if(navigator.share)await navigator.share({title:document.title,url:u.href});
   else{await navigator.clipboard.writeText(u.href);setText($('[data-feedback]',form),'Shareable link copied.');}
  }catch(ex){if(ex.name!=='AbortError')setText($('[data-feedback]',form),'Sharing unavailable. You can copy the page URL.')}
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
