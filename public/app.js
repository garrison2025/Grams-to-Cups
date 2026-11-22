import {convertQuantity,formatAmount,parseAmount,approximateFraction,calculateKitchenFractions,unitDescription,scaleRecipe,csvCell,batchConvertIngredients} from './core.mjs';
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
 for(const field of $$('[data-density-field]',form))field.hidden=!isCrossDimension;
 const cupStandard=$('[data-cup-standard-row]',form);
 if(cupStandard)cupStandard.hidden=!(from==='cup'||to==='cup');
 const ingredientSource=$('[data-source-ingredient]',form),fixedSource=$('[data-source-fixed]',form);
 if(ingredientSource)ingredientSource.hidden=!isCrossDimension;
 if(fixedSource)fixedSource.hidden=isCrossDimension;
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
  setText($('[data-meta-kind]',form),isCrossDimension?'Ingredient':'Conversion');
  setText($('[data-meta-ingredient]',form),isCrossDimension?ingredient?.name:'Fixed units');
  setText($('[data-meta-reference]',form),isCrossDimension?refText:'Defined unit relationship');
  const wrap=$('[data-meter-wrap]',form);
  if(wrap){
   const shown=to==='cup'&&n>0&&n<=1;
   wrap.hidden=!shown;
   if(shown){
    const percent=Math.round(n*100);
    const bar=$('[data-meter-fill]',form);
    if(bar)bar.style.width=(percent===0?0.5:Math.max(0,Math.min(100,percent)))+'%';
    setText($('[data-meter-label]',form),percent===0?'Less than 1% of one '+cupSize+' cup':percent+'% of one '+cupSize+' cup');
   }
  }
  if(error)error.hidden=true;
  return {n,amount,from,to,ingredient,standard,isCrossDimension,unit:unitDescription(to,standard),context};
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
 const live=$('[data-live-result]',form);
 let spokenTimer=null;
 const update=(announceChange=false)=>{
  const conversion=renderCalculator(form);
  if(announceChange&&live){
   if(spokenTimer!==null)clearTimeout(spokenTimer);
   spokenTimer=null;
   if(conversion){
    const displayed=$('[data-result]',form)?.textContent||'';
    const label=$('[data-result-unit]',form)?.textContent||'';
    const food=conversion.isCrossDimension?' for '+conversion.ingredient?.name:'';
    const message='Conversion result: '+displayed+' '+label+food;
    spokenTimer=setTimeout(()=>{setText(live,message);spokenTimer=null},320);
   }else setText(live,'');
  }
  return conversion;
 };
 const params=new URLSearchParams(location.search);
 for(const [key,selector] of [['amount','[data-amount]'],['ingredient','[data-ingredient]'],['standard','[data-standard]'],['from','[data-from]'],['to','[data-to]']]){
  const el=$(selector,form),v=params.get(key);
  if(el&&v&&v.length<80&&(el.tagName==='INPUT'||[...el.options].some(o=>o.value===v)))el.value=v;
 }
 $$('input,select',form).forEach(el=>{el.addEventListener('input',()=>update(true));el.addEventListener('change',()=>update(true))});
 $$('[data-amount-preset]',form).forEach(button=>button.addEventListener('click',()=>{
  $('[data-amount]',form).value=button.dataset.amountPreset;update(true);
 }));
 $$('[data-ingredient-preset]',form).forEach(button=>button.addEventListener('click',()=>{
  $('[data-ingredient]',form).value=button.dataset.ingredientPreset;update(true);
 }));
 $('[data-swap]',form)?.addEventListener('click',()=>{
  const from=$('[data-from]',form),to=$('[data-to]',form);
  [from.value,to.value]=[to.value,from.value];update(true);
 });
 $('[data-reset]',form)?.addEventListener('click',()=>{
  form.reset();setText($('[data-feedback]',form),'');update(true);
 });
 $('[data-copy]',form)?.addEventListener('click',async()=>{
  const d=update();if(!d)return;
  const text=d.amount+' '+unitDescription(d.from,d.standard)+(d.isCrossDimension?' of '+d.ingredient?.name:'')+' ≈ '+formatAmount(d.n,4)+' '+d.unit+'. '+d.context;
  try{await navigator.clipboard.writeText(text);setText($('[data-feedback]',form),'Copied conversion and its context.')}
  catch{setText($('[data-feedback]',form),'Clipboard unavailable. Select the displayed result to copy it.')}
 });
 $('[data-share]',form)?.addEventListener('click',async()=>{
  const d=update();if(!d)return;
  const u=new URL(location.href);u.search='';
  for(const [k,v] of [['amount',d.amount],['ingredient',d.isCrossDimension?d.ingredient?.id:null],['standard',d.standard],['from',d.from],['to',d.to]])if(v)u.searchParams.set(k,v);
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
  try{latest=scaleRecipe($('[data-recipe-lines]',form).value,$('[data-old-servings]',form).value,$('[data-new-servings]',form).value,{fractions:!!$('[data-recipe-fraction]',form)?.checked});
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

/* Local recipe list conversion. Rows use textContent rather than injecting user text as HTML. */
for(const form of $$('[data-batch]')){
 const input=$('[data-batch-lines]',form),target=$('[data-batch-target]',form),
       standard=$('[data-batch-standard]',form),fraction=$('[data-batch-fraction]',form),
       tbody=$('[data-batch-results]',form),summary=$('[data-batch-summary]',form),
       error=$('[data-batch-error]',form);
 let latest=null;
 const compute=()=>{
  try{
   const cupsChoice=target.querySelector('option[value="cup"]');
   if(cupsChoice)cupsChoice.textContent=standard.value==='metric'?'Metric cups':'US cups';
   latest=batchConvertIngredients(input.value,{ingredients,target:target.value,standard:standard.value,fractions:fraction.checked});
   tbody.replaceChildren();
   for(const item of latest.rows){
    if(item.status==='blank')continue;
    const tr=document.createElement('tr');
    tr.className=item.status==='review'?'batch-review-row':'batch-converted-row';
    const original=document.createElement('td'),result=document.createElement('td');
    const text=document.createElement('span');
    text.textContent=item.original;
    original.appendChild(text);
    const badge=document.createElement('span');
    badge.className='batch-status '+(item.status==='converted'?'is-converted':'is-review');
    badge.textContent=item.status==='converted'?'Converted':'Needs review';
    result.appendChild(badge);
    const value=document.createElement('div');
    value.className='batch-row-value';
    value.textContent=item.output;
    result.appendChild(value);
    if(item.status==='review'){
      const why=document.createElement('small');
      why.className='batch-row-warning';
      why.textContent=item.reason;
      result.appendChild(why);
    }
    tr.append(original,result);
    tbody.appendChild(tr);
   }
   summary.textContent=latest.converted+' converted · '+latest.review+' need review · '+latest.blank+' blank';
   error.hidden=true;
   return latest;
  }catch(ex){
   latest=null;
   tbody.replaceChildren();
   summary.textContent='No valid results yet.';
   announce(error,ex.message);
   return null;
  }
 };
 for(const control of [input,target,standard,fraction]){
  control.addEventListener('input',compute);
  control.addEventListener('change',compute);
 }
 $('[data-batch-run]',form)?.addEventListener('click',compute);
 $('[data-batch-clear]',form)?.addEventListener('click',()=>{
  input.value='';
  setText($('[data-batch-feedback]',form),'');
  compute();
  input.focus();
 });
 $('[data-batch-copy]',form)?.addEventListener('click',async()=>{
  const results=compute();if(!results||results.converted+results.review===0)return;
  const text=results.rows.filter(row=>row.status!=='blank')
   .map(row=>row.output+(row.status==='review'?' [NEEDS REVIEW: '+row.reason+']':'')).join('\n');
  try{await navigator.clipboard.writeText(text);setText($('[data-batch-feedback]',form),'Copied list, including review warnings.');}
  catch{setText($('[data-batch-feedback]',form),'Clipboard unavailable. Select the table results to copy them.');}
 });
 $('[data-batch-csv]',form)?.addEventListener('click',()=>{
  const results=compute();if(!results||results.converted+results.review===0)return;
  const cells=[['Original','Converted / unchanged','Status','Reference or review reason'],
   ...results.rows.filter(row=>row.status!=='blank').map(row=>[row.original,row.output,row.status,row.reason])];
  const text=cells.map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+text],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='batch-ingredient-conversions.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 compute();
}

// A complete kitchen fraction calculator, exact for common rational quantities.
for(const form of $$('[data-fraction-arithmetic]')){
 const first=$('[data-fraction-first]',form),second=$('[data-fraction-second]',form),
       operation=$('[data-fraction-operation]',form),result=$('[data-fraction-result]',form),
       decimal=$('[data-fraction-decimal]',form),error=$('[data-fraction-error]',form);
 const run=()=>{
  try{
   const answer=calculateKitchenFractions(first.value,operation.value,second.value);
   setText(result,answer.fraction);
   setText(decimal,(answer.exact?'Decimal equivalent: ':'Rounded decimal: ')+answer.decimal);
   if(error)error.hidden=true;
  }catch(ex){
   setText(result,'—');
   setText(decimal,'Enter valid positive fractions to combine.');
   announce(error,ex.message);
  }
 };
 for(const control of [first,second,operation]){
  control.addEventListener('input',run);
  control.addEventListener('change',run);
 }
 run();
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


/* Compare published ingredient weights without uploading data or fabricating a universal density. */
for(const root of $$('[data-compare]')){
 const slider=$('[data-compare-input]',root);
 const flour=byId.get('all-purpose-flour'),sugar=byId.get('granulated-sugar');
 if(!slider||!flour||!sugar)continue;
 const update=()=>{
  const grams=Number(slider.value);
  const flourCups=convertQuantity(grams,'g','cup',{ingredient:flour,standard:'us'});
  const sugarCups=convertQuantity(grams,'g','cup',{ingredient:sugar,standard:'us'});
  const max=Math.max(flourCups,sugarCups);
  setText($('[data-compare-grams]',root),formatAmount(grams,0)+' g');
  setText($('[data-compare-flour]',root),formatAmount(flourCups,3));
  setText($('[data-compare-sugar]',root),formatAmount(sugarCups,3));
  const flourBar=$('[data-compare-flour-bar]',root),sugarBar=$('[data-compare-sugar-bar]',root);
  if(flourBar)flourBar.style.width=(flourCups/max*100).toFixed(1)+'%';
  if(sugarBar)sugarBar.style.width=(sugarCups/max*100).toFixed(1)+'%';
  setText($('[data-compare-caption]',root),formatAmount(grams,0)+' g of flour uses about '+formatAmount(flourCups/sugarCups,2)+'× as many US cups as the same weight of granulated sugar.');
  slider.setAttribute('aria-valuetext',formatAmount(grams,0)+' grams');
  $$('[data-compare-preset]',root).forEach(button=>button.setAttribute('aria-pressed',String(Number(button.dataset.comparePreset)===grams)));
 };
 slider.addEventListener('input',update);
 $$('[data-compare-preset]',root).forEach(button=>button.addEventListener('click',()=>{slider.value=button.dataset.comparePreset;update()}));
 update();
}
/* The chart is useful as an interactive lookup as well as a printable source table. */
for(const chart of $$('[data-chart]')){
 const search=$('[data-chart-filter]',chart),table=$('[data-chart-table] table',chart);
 if(!table||!search)continue;
 const rows=$$('tbody tr',table),head=$$('thead th',table).map(th=>th.textContent.trim());
 const update=()=>{
  const query=search.value.trim().toLowerCase();
  let visible=0;
  for(const row of rows){
   row.hidden=!!query&&!row.cells[0].textContent.toLowerCase().includes(query);
   if(!row.hidden)visible++;
  }
  setText($('[data-chart-count]',chart),visible+' of '+rows.length+' ingredients shown');
  const empty=$('[data-chart-empty]',chart);
  if(empty)empty.hidden=visible!==0;
 };
 search.addEventListener('input',update);
 $('[data-chart-download]',chart)?.addEventListener('click',()=>{
  const included=[...rows].filter(row=>!row.hidden).map(row=>[...row.cells].map(td=>td.textContent.trim()));
  const content=[head,...included].map(row=>row.map(csvCell).join(',')).join('\r\n');
  const url=URL.createObjectURL(new Blob(['\ufeff'+content],{type:'text/csv;charset=utf-8'}));
  const a=document.createElement('a');a.href=url;a.download='cooking-conversion-chart.csv';a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 update();
}
