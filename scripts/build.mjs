import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {convertQuantity,formatAmount,unitDescription,approximateFraction,suggestKitchenMeasures,US_CUP_ML,METRIC_CUP_ML,US_TBSP_ML} from '../src/core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'src/ingredients.json'),'utf8'));
const byId=new Map(data.map(i=>[i.id,i]));
// Preserve Appendix A's 24 content pages; extra verified ingredients belong
// in the calculators, batch converter, and charts, not speculative SEO URLs.
const pageIngredients=data.filter(i=>!['bread-flour','cocoa-unsweetened','unbleached-cake-flour'].includes(i.id));
if(pageIngredients.length!==24||data.length!==27)throw Error('Ingredient inventory needs page-policy review.');
const dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
// The independently owned production domain is authoritative. Cloudflare
// injects CF_PAGES_BRANCH during Pages builds. Only main can become indexable;
// all preview branches and local builds stay noindex. Explicit "false" remains
// a safe emergency opt-out for publication.
const productionOrigin='https://gramstocupscalculator.com';
const pagesMain=process.env.CF_PAGES_BRANCH==='main';
const base=(process.env.SITE_URL||(pagesMain?productionOrigin:'')).trim().replace(/\/+$/,'');
const origin=/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)?base:'';
const releaseRequested=pagesMain&&process.env.PUBLIC_INDEX_APPROVED!=='false';
const hostname=origin?new URL(origin).hostname.toLowerCase():'';
if(hostname==='convertunits.cc'||hostname.endsWith('.convertunits.cc'))
 throw new Error('Grams-to-Cups is an independent website: do not use the other project domain for SITE_URL.');
const reservedHost=hostname==='localhost'||hostname==='127.0.0.1'||hostname==='0.0.0.0'||hostname==='example.com'||hostname.endsWith('.example')||hostname.endsWith('.invalid')||hostname.endsWith('.test')||hostname.endsWith('.localhost');
if(releaseRequested&&!origin)throw new Error('Production publication requested but SITE_URL is missing or invalid. Set the exact stable HTTPS host.');
const approvedCiFixture=process.env.CI==='true'&&process.env.SITE_URL_FIXTURE_APPROVED_FOR_CI==='true'&&hostname==='example.com';
if(releaseRequested&&reservedHost&&!approvedCiFixture)throw new Error('Production SITE_URL cannot be a placeholder or local/test domain. Set your verified public hostname.');
if(releaseRequested&&origin!==productionOrigin&&!approvedCiFixture)
 throw new Error('Production must publish with canonical https://gramstocupscalculator.com (or the explicit approved CI fixture).');
const publicIndex=releaseRequested&&!!origin;
const pages=[],e=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const primaryUrl=url=>url==='/cooking/grams-to-cups/'?'/':url;
const f=n=>formatAmount(n,3),link=(url,label,cls='')=>'<a href="'+e(primaryUrl(url))+'"'+(cls?' class="'+e(cls)+'"':'')+'>'+e(label)+'</a>';
const source='https://www.kingarthurbaking.com/learn/ingredient-weight-chart';
const volumeSource='https://nvlpubs.nist.gov/nistpubs/Legacy/LC/nbslettercircular1098.pdf';
const contactEmail='contact@gramstocupscalculator.com';
const numberValues=[25,30,50,60,75,80,100,125,150,180,200,225,250,300,350,400,450,500,600,750,1000];
// Same search intent as the homepage: keep the tool usable but direct internal SEO links to /.
const noIndexCandidatePaths=new Set(['/cooking/grams-to-cups/','/cooking/grams-to-cups/1000-grams-to-cups/','/cooking/cups-to-fluid-ounces/','/cooking/fluid-ounces-to-cups/','/cooking/recipe-scaler/','/cooking/ingredients/whole-wheat-flour/','/cooking/ingredients/coconut-flour/','/cooking/ingredients/gluten-free-flour/','/cooking/ingredients/brown-rice-cooked/','/cooking/ingredients/maple-syrup/','/cooking/ingredients/olive-oil/','/cooking/ingredients/cornstarch/','/cooking/ingredients/pumpkin-puree/','/cooking/ingredients/walnuts-chopped/','/cooking/guides/measuring-flour/','/cooking/batch-converter/']);
// Source-grounded editorial decisions for the independent Grams-to-Cups site.
// These do NOT alter features: weak SEO targets remain usable but are excluded from indexing.
const editorialDecisionSource=JSON.parse(fs.readFileSync(path.join(root,'research/seo-21-editorial-decisions.json'),'utf8'));
if(editorialDecisionSource.decisions.length!==21||new Set(editorialDecisionSource.decisions.map(x=>x.url)).size!==21)throw Error('All 21 editorial URL decisions must be complete and unique.');
for(const row of editorialDecisionSource.decisions){
 if(!['approved-index','functional-noindex'].includes(row.decision)||!row.rationale?.trim())throw Error('Missing editorial release disposition for '+row.url);
 if(row.decision==='functional-noindex')noIndexCandidatePaths.add(row.url);
}

const flourNumbers=[100,125,150,200,250,300,400,500],sugarNumbers=[100,200];
const tools=[
['grams-to-cups','Grams to Cups','g','cup',100,'ingredient'],
['cups-to-grams','Cups to Grams','cup','g',1,'ingredient'],
['grams-to-tablespoons','Grams to Tablespoons','g','tbsp',50,'ingredient'],
['tablespoons-to-grams','Tablespoons to Grams','tbsp','g',4,'ingredient'],
['ml-to-cups','Milliliters to Cups','ml','cup',250,'fixed'],
['tablespoons-to-cups','Tablespoons to Cups','tbsp','cup',4,'fixed'],
['cups-to-tablespoons','Cups to Tablespoons','cup','tbsp',0.5,'fixed'],
['tablespoons-to-ml','Tablespoons to Milliliters','tbsp','ml',2,'fixed'],
['ml-to-tablespoons','Milliliters to Tablespoons','ml','tbsp',30,'fixed'],
['cups-to-fluid-ounces','Cups to US Fluid Ounces','cup','fl-oz',1,'fixed'],
['fluid-ounces-to-cups','US Fluid Ounces to Cups','fl-oz','cup',8,'fixed']
];
const units=['g','cup','tbsp','ml','tsp','fl-oz','oz','kg'];
function writeFile(relative,body){const p=path.join(dist,relative);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,body);}
function fileFor(url){return url==='/'?'index.html':url.slice(1)+'index.html';}
function breadHtml(items){return '<nav class="breadcrumbs" aria-label="Breadcrumb">'+link('/','Home')+items.map(x=>' <span aria-hidden="true">/</span> '+(x[1]?link(x[1],x[0]):'<strong>'+e(x[0])+'</strong>')).join('')+'</nav>';}
function nav(){return '<a class="skip" href="#main">Skip to main content</a><header class="site-header"><div class="container header-inner">'+
'<a class="logo" href="/" aria-label="Grams and Cups home"><span class="logo-symbol" aria-hidden="true">⅓</span><span>Grams <span class="logo-word-accent">&amp;</span> Cups</span></a>'+
'<button type="button" class="nav-toggle" aria-label="Toggle navigation" aria-expanded="false" aria-controls="main-nav" data-nav-toggle>☰</button>'+
'<nav id="main-nav" class="main-nav" data-nav aria-label="Primary navigation">'+link('/cooking/grams-to-cups/','Converter')+link('/cooking/#ingredients','Ingredients')+link('/cooking/charts/','Charts')+link('/cooking/recipe-scaler/','Recipe scaler')+link('/cooking/sources-and-methods/','Our sources','nav-cta')+'</nav></div></header>';}
function footer(){return '<footer class="footer"><div class="container"><div class="footer-grid"><div>'+link('/','Grams & Cups','logo')+'<p>Friendly cooking measurements, grounded in referenced ingredient weights.<br>No account required; calculations stay in your browser.<br>Contact: <a href="mailto:contact@gramstocupscalculator.com">contact@gramstocupscalculator.com</a></p></div><nav class="footer-links" aria-label="Footer">'+link('/about/','About')+link('/privacy/','Privacy')+link('/contact/','Contact')+link('/cooking/sources-and-methods/','Sources')+link('/cooking/charts/','Print chart')+'</nav></div><div class="footer-note">© '+new Date().getUTCFullYear()+' Grams & Cups · Recipe reference estimates are not laboratory density measurements. Confirm important recipes by weighing ingredients.</div></div></footer>';}
function jsonld(obj){return '<script type="application/ld+json">'+JSON.stringify(obj).replaceAll('<','\\u003c')+'</script>';}
function doc(spec){
 const {url,title,description,body,bread=[],kind='WebPage',index=true}=spec;
 if(!url.startsWith('/')||pages.some(p=>p.url===url))throw Error('Duplicate or invalid route: '+url);
 const canonical=origin?origin+url:'';
 const eligible=index&&!noIndexCandidatePaths.has(url);
 const permitted=publicIndex&&eligible;
 const pageTitle=title+' | Grams & Cups';
 const crumbs=[{name:'Home',item:origin+'/'},...bread.filter(x=>!x[1]||primaryUrl(x[1])!=='/')
  .map(x=>({name:x[0],item:origin+(x[1]||url)}))];
 // The visible source-linked answer is the basis of the citation. Avoid false
 // Recipe, FAQ rich-result, Review or organization claims for a calculator.
 const sourceReferenced=url==='/'||
  /^\/cooking\/(?:grams-to-cups|cups-to-grams|grams-to-tablespoons|tablespoons-to-grams)\/$/.test(url)||/^\/cooking\/grams-to-cups\/\d+-grams-to-cups\/$/.test(url)||
  /^\/cooking\/ingredients\/[^/]+\/$/.test(url)||
  /^\/cooking\/ingredients\/[^/]+\/\d+-grams-to-cups\/$/.test(url)||
  /^\/cooking\/charts\//.test(url);
 const websiteId=origin+'/#website',pageId=canonical+'#webpage',appId=canonical+'#calculator';
 const webpage={'@context':'https://schema.org','@type':'WebPage','@id':pageId,
  name:pageTitle,url:canonical,description,inLanguage:'en',
  isPartOf:{'@id':websiteId}};
 if(kind==='WebApplication')webpage.mainEntity={'@id':appId};
 if(url==='/cooking/sources-and-methods/')webpage.citation=[source,volumeSource];
 if(sourceReferenced){
  webpage.citation=source;
  webpage.about={'@type':'Thing',name:title};
 }
 const schema=permitted?
  (url==='/'?jsonld({'@context':'https://schema.org','@type':'WebSite','@id':websiteId,name:'Grams & Cups',url:origin+'/',inLanguage:'en'}):'')+
  jsonld(webpage)+
  (bread.length?jsonld({'@context':'https://schema.org','@type':'BreadcrumbList','@id':canonical+'#breadcrumbs',
   itemListElement:crumbs.map((x,i)=>({'@type':'ListItem',position:i+1,name:x.name,item:x.item}))}):'')+
  (kind==='WebApplication'?jsonld({'@context':'https://schema.org','@type':'WebApplication','@id':appId,
   name:title,url:canonical,description,applicationCategory:'UtilitiesApplication',
   operatingSystem:'Any modern web browser',isAccessibleForFree:true,
   offers:{'@type':'Offer',price:'0',priceCurrency:'USD'}}):''):'';

 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f8f7f2">'+
 '<meta name="description" content="'+e(description)+'"><meta name="robots" content="'+(permitted?'index,follow':'noindex,follow')+'">'+
 (permitted?'<link rel="canonical" href="'+e(canonical)+'">':'')+'<title>'+e(pageTitle)+'</title>'+
 (permitted&&url==='/'&&origin===productionOrigin?'<meta name="google-site-verification" content="5U3A9UOS0g5EKSXt9Bc7JcdGziKzL10f2XXB8kPFldk">':'')+
 '<meta property="og:type" content="website"><meta property="og:site_name" content="Grams &amp; Cups"><meta property="og:locale" content="en_US">'+
 '<meta property="og:title" content="'+e(pageTitle)+'"><meta property="og:description" content="'+e(description)+'">'+
 '<meta name="twitter:card" content="summary"><meta name="twitter:title" content="'+e(pageTitle)+'"><meta name="twitter:description" content="'+e(description)+'">'+
 (permitted?'<meta property="og:url" content="'+e(canonical)+'">':'')+
 '<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/assets/styles.css">'+
 '<noscript><style>@media(max-width:780px){.header-inner{flex-wrap:wrap}.nav-toggle{display:none}.main-nav{display:flex;position:static;flex:1 1 100%;visibility:visible;opacity:1;pointer-events:auto;transform:none;transition:none;box-shadow:none;padding:9px 0 16px}}</style></noscript>'+schema+
 '<script type="module" src="/assets/app.js" defer></script></head><body>'+nav()+'<main id="main">'+
 (url==='/'?'':'<div class="container">'+breadHtml(bread)+'</div>')+body+'</main>'+footer()+(permitted?'<script defer src="/assets/optional-analytics.js" data-ga4-id="G-RE4SF27SM3"></script>':'')+'</body></html>';
 writeFile(fileFor(url),html);
 pages.push({url,title,description,kind,indexCandidate:eligible,wordCount:body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().split(' ').length});
}
function section(title,intro,contents,alt=false){return '<section class="section'+(alt?' section-alt':'')+'"><div class="container"><div class="section-head"><h2>'+e(title)+'</h2><p>'+e(intro)+'</p></div>'+contents+'</div></section>';}
function ingredientCardType(url){
 const prefix='/cooking/ingredients/';
 if(!url.startsWith(prefix)||!url.endsWith('/'))return null;
 const id=url.slice(prefix.length,-1);
 if(!id||id.includes('/')||!byId.has(id))return null;
 if(id.includes('flour'))return ['flour','Flour','F'];
 if(id.includes('sugar'))return ['sugar','Sugar','S'];
 if(['butter','milk-fresh','sour-cream','cream-cheese'].includes(id))return ['dairy','Dairy','D'];
 if(id.includes('rice')||id.includes('oats'))return ['grains','Grains','G'];
 if(id.includes('oil'))return ['oils','Oils','O'];
 if(id.includes('honey')||id.includes('syrup'))return ['sweeteners','Sweeteners','S'];
 return ['other','Other','·'];
}
function grid(items,cols=3){
 return '<div class="cards'+(cols===4?' four':'')+'">'+items.map(([url,title,desc],i)=>{
 const category=ingredientCardType(url);
 const top=category?
  '<span class="tile-leading"><span class="tile-index" aria-hidden="true">'+e(category[2])+'</span><span class="tile-kind">'+e(category[1])+'</span></span>':
  '<span class="tile-index" aria-hidden="true">'+String(i+1).padStart(2,'0')+'</span>';
 return '<a class="tile"'+(category?' data-food-group="'+e(category[0])+'"':'')+
  ' href="'+e(primaryUrl(url))+'">'+top+'<h3 class="tile-title">'+e(title)+'</h3><p>'+e(desc)+
  '</p><span class="arrow" aria-hidden="true">↗</span></a>';
 }).join('')+'</div>';
}

function table(headers,rows,{rowIds=null,stacked=false}={}){
 const role=name=>stacked?' role="'+name+'"':'';
 return '<div class="table-shell'+(stacked?' table-shell-stacked':'')+'"><div class="table-scroll" tabindex="0" role="region" aria-label="Cooking conversion table"><table'+role('table')+'><thead'+role('rowgroup')+'><tr'+role('row')+'>'+
 headers.map(x=>'<th scope="col"'+role('columnheader')+'>'+e(x)+'</th>').join('')+'</tr></thead><tbody'+role('rowgroup')+'>'+
 rows.map((r,index)=>'<tr'+role('row')+(rowIds?.[index]?' data-chart-food-id="'+e(rowIds[index])+'"':'')+'>'+
 r.map((x,i)=>i===0?'<th scope="row"'+role('rowheader')+'>'+e(x)+'</th>':'<td'+role('cell')+'>'+(stacked?'<span class="stacked-cell-label" aria-hidden="true">'+e(headers[i])+'</span>':'')+e(x)+'</td>').join('')+'</tr>').join('')+
 '</tbody></table></div><p class="table-scroll-hint" hidden>↔ Scroll to view the other columns</p></div>';
}
function unitSelect(label,which,selected){
 const options=units.map(u=>'<option value="'+u+'"'+(selected===u?' selected':'')+'>'+e(unitDescription(u))+'</option>').join('');
 return '<div class="field"><label for="'+which+'">'+e(label)+'</label><select id="'+which+'" data-'+which+'>'+options+'</select></div>';
}
function ingredientSelect(selected='all-purpose-flour',hidden=false){
 const options=data.map(i=>'<option value="'+e(i.id)+'"'+(i.id===selected?' selected':'')+'>'+e(i.name)+'</option>').join('');
 return '<div class="field" data-density-field'+(hidden?' hidden':'')+'>'+
 '<div class="ingredient-picker" data-ingredient-picker hidden><label for="ingredient-search-calc">Ingredient</label>'+
 '<input id="ingredient-search-calc" type="text" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="calc-ingredient-suggestions" data-ingredient-search placeholder="Search ingredients" autocomplete="off" spellcheck="false">'+
 '<ul id="calc-ingredient-suggestions" class="ingredient-options" role="listbox" aria-label="Ingredients" hidden>'+data.map(i=>'<li role="option" id="calc-food-'+e(i.id)+'" data-ingredient-option="'+e(i.id)+'">'+e(i.name)+'</li>').join('')+'</ul>'+
 '<p class="ingredient-options ingredient-no-match" data-ingredient-empty role="status" hidden>No matching ingredient.</p></div>'+
 '<div class="ingredient-fallback" data-ingredient-fallback><label for="ingredient-choice">Ingredient</label>'+
 '<select id="ingredient-choice" data-ingredient>'+options+'</select></div></div>';
}

const measureStepIcon='<span class="measure-vessel"><span class="measure-fill"></span></span><span data-step-label></span>';
function measureSteps(guide){
 const steps=(guide?.steps||[]).map(step=>{
  const label=(step.count>1?step.count+' × ':'')+step.label;
  return '<li class="measure-step" data-step-kind="'+step.kind+'" style="--measure-fill:'+step.fill+'"><span class="measure-vessel"><span class="measure-fill"></span></span><span data-step-label>'+e(label)+'</span></li>';
 }).join('');
 return '<ul class="measure-steps" data-measure-steps aria-hidden="true">'+steps+'</ul>'+
  '<template data-measure-step-template><li class="measure-step">'+measureStepIcon+'</li></template>';
}
function converterForm({amount=100,from='g',to='cup',ingredient='all-purpose-flour',heading='Instant conversion'}={}){
 const ref=byId.get(ingredient)||data[0];
 const massUnits=['g','kg','oz'];
 const crossDimension=massUnits.includes(from)!==massUnits.includes(to);
 const standardRelevant=from==='cup'||to==='cup';
 const quickAmounts=[50,100,200,250];
 const foodButtons=[['all-purpose-flour','Flour'],['granulated-sugar','Sugar'],['butter','Butter'],['long-grain-rice-dry','Rice']]
 .map(([id,label])=>'<button class="ingredient-chip" type="button" data-ingredient-preset="'+e(id)+'" aria-pressed="'+String(id===ingredient)+'">'+e(label)+'</button>').join('');
 const amountButtons=quickAmounts.map(n=>'<button class="amount-chip" type="button" data-amount-preset="'+n+'" aria-pressed="'+String(Number(amount)===n)+'">'+n+' '+e(from)+'</button>').join('');
 let preview='—',previewValue=null;
 try{previewValue=convertQuantity(Number(amount),from,to,{ingredient:ref,standard:'us'});preview=f(previewValue);}catch{}
 const showMeter=to==='cup'&&previewValue>0&&previewValue<=1;
 const meterPercent=showMeter?Math.round(previewValue*100):0;
 const referenceText=f(ref.referenceGrams)+' g per '+f(ref.referenceAmount)+' '+(ref.referenceUnit==='cup'?'US cup':'US tablespoon');
 const guide=to==='cup'&&previewValue>0?suggestKitchenMeasures(previewValue,{ingredient:crossDimension?ref:null,standard:'us'}):null;
 const cupsOnly=to==='cup'&&previewValue>0?suggestKitchenMeasures(previewValue,{ingredient:crossDimension?ref:null,standard:'us',allowSpoons:false}):null;
 const guideDifference=guide?'Primary option · '+measureReferenceDifference(guide):'';
 const cupDifference=cupsOnly?'Cups only · '+measureReferenceDifference(cupsOnly):'';
 const initialNote=crossDimension?(ref.id==='water'?'Recipe chart method: King Arthur Baking lists 227 g per US cup of water. This differs from a physical-capacity estimate of about 1 g/mL.':'Based on '+referenceText+' of '+ref.name+'. This is an approximate recipe measurement.'):
  'These units have a defined conversion; an ingredient reference is not needed.';
 const shortUnit=shortUnitLabel(to);
 return '<div class="calc-card conversion-card" id="converter"><div class="calc-top"><strong>'+e(heading)+'</strong><span class="conversion-direction"><span data-advanced-label>'+e(shortUnitLabel(from))+' → '+e(shortUnitLabel(to))+'</span>'+
 '<button class="unit-switch" type="button" data-swap aria-label="Swap from and to units" title="Swap conversion direction">⇄</button></span></div>'+
 '<form class="calc-body calc-workbench" data-calc novalidate>'+
 '<div class="calc-fields"><div class="calc-main-fields">'+
 '<div class="field amount-field"><label for="quantity">Amount <span data-amount-unit>'+e(shortUnitLabel(from))+'</span></label><input id="quantity" data-amount type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="'+e(amount)+'" aria-describedby="amount-help"><small class="sr-only" id="amount-help">You can enter decimals or fractions, such as 125.5 or 1/4.</small></div>'+
 ingredientSelect(ingredient,!crossDimension)+'</div>'+
 '<div class="quick-row calc-quantity-presets" role="group" aria-label="Common quantities">'+amountButtons+'</div></div>'+
 '<div class="calc-readout">'+
 '<div class="result" role="group" aria-label="Live conversion result">'+
 '<div class="result-label">YOUR CONVERSION</div>'+
 '<div class="result-amount"><output class="result-number" data-result>'+e(preview)+'</output><span class="result-unit" data-result-unit>'+e(shortUnit)+'</span></div>'+
 '<span class="sr-only" role="status" aria-live="polite" aria-atomic="true" data-live-result></span>'+
 '<p class="result-text" data-result-note>'+e(initialNote)+'</p>'+
 '<div class="cup-meter-wrap" data-meter-wrap'+(showMeter?'':' hidden')+'><div class="cup-meter" aria-hidden="true"><div class="cup-meter-fill" data-meter-fill style="width:'+(showMeter?(meterPercent===0?0.5:meterPercent):0)+'%"></div></div><div class="cup-meter-label" data-meter-label>'+(showMeter?(meterPercent===0?'Less than 1%':meterPercent+'%')+' of one US cup':'')+'</div></div>'+
 '<div class="measure-guide" data-measure-guide'+(guide?'':' hidden')+'><span class="measure-guide-label">HOW TO MEASURE</span>'+
 '<strong class="sr-only" data-measure-summary>'+e(guide?.instruction||'')+'</strong>'+measureSteps(guide)+
 '<p data-measure-alternative'+(!cupsOnly||cupsOnly.instruction===guide?.instruction?' hidden':'')+'>Cups only: '+e(cupsOnly?.instruction||'')+' — '+e(cupDifference)+'</p>'+
 '<p data-measure-error>'+e(guideDifference)+'</p>'+
 '<small>Use level measures and the stated food preparation; for precise baking, weigh the requested grams.</small></div>'+
 '<div class="result-meta"><span><span data-meta-kind>'+(crossDimension?'Ingredient':'Conversion')+'</span>: <b data-meta-ingredient>'+e(crossDimension?ref.name:'Fixed units')+'</b></span><span>Reference: <b data-meta-reference>'+e(crossDimension?referenceText:'Defined unit relationship')+'</b></span></div>'+
 '</div>'+
 '<p data-error class="error" role="alert" hidden></p>'+
 '<div class="calc-actions"><button class="btn btn-primary" type="button" data-copy><span data-copy-label>Copy result</span></button>'+
 '<button class="btn" type="button" data-share>Share link</button><button class="btn" type="button" data-print>Print</button>'+
 '<button class="btn btn-ghost" type="button" data-reset>Reset</button></div>'+
 '<p class="calc-feedback" data-feedback role="status"></p>'+
 '<div class="field" data-share-fallback hidden><label for="converter-share-link">Copy this share link</label><input id="converter-share-link" data-share-url type="url" readonly spellcheck="false"></div></div>'+
 '<div class="calc-extras">'+
 '<div class="quick-row calc-food-presets" role="group" aria-label="Popular ingredients" data-density-field'+(crossDimension?'':' hidden')+'>'+foodButtons+'</div>'+
 '<div class="standard-line" data-water-mode-row'+(crossDimension&&ref.id==='water'?'':' hidden')+'><label for="water-mode">Water measurement method</label><select id="water-mode" data-water-mode><option value="recipe" selected>Recipe chart · 227 g per US cup</option><option value="capacity">Physical capacity · approximately 1 g/mL</option></select><small>Water density varies with temperature.</small></div>'+
 '<div class="standard-line" data-cup-standard-row'+(standardRelevant?'':' hidden')+'><label for="cup-standard">Cup standard</label><select id="cup-standard" data-standard><option value="us" selected>US · 236.588 mL</option><option value="metric">Metric · 250 mL</option></select></div>'+
 '<details class="advanced-units" data-advanced-units><summary>More conversion units</summary><div class="advanced-inner"><div class="unit-stage">'+unitSelect('From unit','from',from)+unitSelect('To unit','to',to)+'</div></div></details>'+
 '<p class="source-chip">'+
 '<span data-source-ingredient'+(crossDimension?'':' hidden')+'>Ingredient-based estimate from '+link(source,'King Arthur Baking’s published weight chart')+'. Actual food preparation affects measurements.</span>'+
 '<span data-source-fixed'+(crossDimension?' hidden':'')+'>This conversion uses defined units and does not require ingredient weights. '+link('/cooking/sources-and-methods/','View our measurement standards')+'.</span>'+
 '<span data-source-capacity hidden>Capacity-based water estimate: approximately 1 g per mL, varying with temperature. This is <strong>not</strong> the 227 g per US cup published recipe reference.</span></p>'+
 '</div></form></div>';
}

const shortUnitLabel=unit=>({g:'g',kg:'kg',oz:'oz',cup:'US cups',ml:'mL',tbsp:'tbsp',tsp:'tsp','fl-oz':'US fl oz'})[unit]||unit;

function answerFor(amount,ingredient='all-purpose-flour',standard='us'){
 const i=byId.get(ingredient),cups=convertQuantity(amount,'g','cup',{ingredient:i,standard});
 const usCups=convertQuantity(amount,'g','cup',{ingredient:i,standard:'us'});
 const metricCups=convertQuantity(amount,'g','cup',{ingredient:i,standard:'metric'});
 const gramsPerUsCup=convertQuantity(1,'cup','g',{ingredient:i,standard:'us'});
 const basis=f(i.referenceGrams)+' g per '+f(i.referenceAmount)+' '+(i.referenceUnit==='cup'?'US cup':'US tablespoon');
 return {cups,html:'<div class="seo-answer"><strong>'+e(f(amount))+' grams of '+e(i.name)+' ≈ '+e(f(cups))+' '+(standard==='us'?'US':'metric')+' cups</strong>'+
 '<p>For '+e(i.state)+' measured by '+e(i.method)+', '+e(f(amount))+' g works out to about '+e(f(cups))+' '+(standard==='us'?'US':'metric')+' cups. The calculation scales '+e(basis)+' from '+link(i.sourceUrl,i.sourceName)+'. This is an ingredient-specific cooking estimate, not a universal mass-to-volume equation.</p>'+
 '<div class="answer-evidence" data-answer-evidence><p><b>Calculation:</b> '+e(f(amount))+' g ÷ '+e(f(gramsPerUsCup))+' g per US cup ≈ '+e(f(usCups))+' US cups. With a 250 mL metric cup, the same amount is approximately <b>'+e(f(metricCups))+' metric cups</b> (US cup: '+e(f(US_CUP_ML))+' mL).</p>'+
 '<p><b>Reference and scope:</b> '+e(i.sourceEntry)+' ('+e(i.state)+'; '+e(i.method)+'). Original published pair: '+e(basis)+'. '+link(i.sourceUrl,'View the original weight chart')+'. Reference checked '+e(i.reviewedAt)+'. These are proportional recipe estimates, not individual laboratory measurements.</p></div></div>'};
}
function numberComparison(amount,exclude=''){const top=data.filter(i=>i.id!==exclude);return table(['Ingredient','US cups for '+amount+' g','Reference g per US cup','Food state and measuring method'],top.map(i=>[i.name,f(convertQuantity(amount,'g','cup',{ingredient:i})),f(convertQuantity(1,'cup','g',{ingredient:i}))+' g',i.state+' · '+i.method]));}
function intro(title,body){return '<div class="container"><div class="page-intro"><span class="eyebrow">Cooking measurement reference</span><h1>'+e(title)+'</h1><p class="lede">'+e(body)+'</p></div></div>';}
const hubList=tools.map(t=>['/cooking/'+t[0]+'/',t[1],t[5]==='ingredient'?'Ingredient-aware conversion':'Fixed US volume units']);
const ingredientList=pageIngredients.map(i=>['/cooking/ingredients/'+i.id+'/',i.name,i.method]);
const numberList=numberValues.map(n=>['/cooking/grams-to-cups/'+n+'-grams-to-cups/',n+' grams to cups','Compare flour, sugar, butter and more']);
function home(){
 const flour=byId.get('all-purpose-flour'),sugar=byId.get('granulated-sugar');
 const flour100=f(convertQuantity(100,'g','cup',{ingredient:flour}));
 const sugar100=f(convertQuantity(100,'g','cup',{ingredient:sugar}));
 const popular=[100,200,250,300,500].map(n=>['/cooking/grams-to-cups/'+n+'-grams-to-cups/',n+' g to cups']);
 const strip='<div class="home-ticker"><div class="container home-ticker-inner"><b>POPULAR CONVERSIONS</b>'+popular.map(([u,l])=>link(u,l)).join('')+'</div></div>';
 const comparison='<section class="comparison-showcase" data-compare><div class="container comparison-grid"><div class="comparison-copy">'+
 '<span class="kicker">EXPLORE THE DIFFERENCE</span><h2>Same weight.<br><em>Different volume.</em></h2>'+
 '<p>Flour and sugar occupy different amounts of space at the same weight. Change the amount below to see how their cup equivalents compare.</p>'+
 '<div class="compare-controls"><label for="compare-weight">Weight to compare</label>'+
 '<div class="compare-slider-row"><input id="compare-weight" data-compare-input type="range" min="10" max="500" step="10" value="100" aria-describedby="compare-help" aria-valuetext="100 grams">'+
 '<output for="compare-weight" data-compare-grams aria-live="polite">100 g</output></div>'+
 '<div class="compare-presets" role="group" aria-label="Suggested weights">'+
 [50,100,200,250].map(n=>'<button type="button" class="compare-preset" data-compare-preset="'+n+'" aria-pressed="'+String(n===100)+'">'+n+' g</button>').join('')+
 '</div><p class="compare-hint" id="compare-help">Both values use the same weight and US customary cups.</p></div>'+
 link('/cooking/sources-and-methods/','See the measuring method','compare-source-link')+'</div>'+
 '<div class="comparison-stack" aria-label="Ingredient volume comparison">'+
 '<div class="compare-item"><small>ALL-PURPOSE FLOUR</small><div class="compare-food-icon" aria-hidden="true">F</div>'+
 '<strong><output data-compare-flour>'+e(flour100)+'</output><span class="compare-unit">US cups</span></strong>'+
 '<div class="compare-bar-track" aria-hidden="true"><div class="compare-bar-fill" data-compare-flour-bar style="width:100%"></div></div>'+
 '<span><span data-compare-weight>100 g</span> · spoon &amp; level</span></div>'+
 '<div class="compare-item"><small>GRANULATED SUGAR</small><div class="compare-food-icon" aria-hidden="true">S</div>'+
 '<strong><output data-compare-sugar>'+e(sugar100)+'</output><span class="compare-unit">US cups</span></strong>'+
 '<div class="compare-bar-track" aria-hidden="true"><div class="compare-bar-fill" data-compare-sugar-bar style="width:61%"></div></div>'+
 '<span><span data-compare-weight>100 g</span> · level cup</span></div>'+
 '<p class="compare-caption" data-compare-caption>100 g of flour needs more cup space than 100 g of granulated sugar.</p>'+
 '</div></div></section>';
 const hero='<div class="container hero"><div class="hero-copy">'+
 '<h1 class="hero-heading">Grams to <em>cups.</em></h1>'+
 '<p class="lede">Convert grams to US or metric cups for '+data.length+' ingredients, from all-purpose flour to sugar and butter.</p>'+
 '</div>'+converterForm({})+'</div>';
 const homeAnswer='<section class="section section-answer"><div class="container"><div class="panel"><h2>How many cups is 100 grams?</h2>'+
 '<p><strong>100 grams of spoon-and-leveled all-purpose flour is about '+e(flour100)+' US cups.</strong> The referenced flour measure is 120 g per US cup. By comparison, 100 g of granulated sugar is about '+e(sugar100)+' US cups using its 198 g per US cup reference. The same mass does not correspond to one universal cup amount.</p>'+
 '<h3>How to convert grams to US cups</h3><p>To convert grams to US cups, divide the grams by the ingredient’s grams per US cup. For example, 100 ÷ 120 ≈ '+e(flour100)+' US cups of all-purpose flour.</p>'+
 '<p>Choose the correct ingredient and food state above, and select US (236.588 mL) or metric (250 mL) cups. Values are scaled from the '+link(source,'published ingredient weight chart')+'; for precise baking, use the gram weight stated in the recipe. '+link('/cooking/sources-and-methods/','Read our calculation method')+'. For step-by-step examples, open '+link('/cooking/ingredients/all-purpose-flour/100-grams-to-cups/','100 g all-purpose flour to cups')+' or '+link('/cooking/ingredients/granulated-sugar/100-grams-to-cups/','100 g granulated sugar to cups')+'.</p></div></div></section>';
 const body=hero+homeAnswer+strip+
 section('Explore by ingredient','Flour, sugar, butter and more — choose the exact food before converting by volume.',grid(ingredientList.slice(0,8),4),true)+
 comparison+
 section('A little easier in the kitchen','Save time with practical tools for recipe scaling, print-friendly reference charts and measuring fractions.',grid([
 ['/cooking/grams-to-cups/','Grams to cups','Choose an ingredient and instantly find its approximate cup equivalent'],
 ['/cooking/cups-to-grams/','Cups to grams','Bake by weight with more reliable kitchen results'],
 ['/cooking/recipe-scaler/','Recipe scaler','Scale quantities to match the number of people you are feeding'],
 ['/cooking/half-a-measurement/','Kitchen fraction calculator','Halve measures or combine 1/2 + 1/4 with exact fraction answers'],
 ['/cooking/batch-converter/','Batch converter','Paste multiple ingredients and check the conversions side by side'],
 ['/cooking/charts/','Printable charts','Keep a source-backed reference beside your mixing bowl'],
 ['/cooking/guides/cup-sizes/','US vs metric cups','Understand the difference between cup systems'],
 ['/cooking/','All cooking tools','Browse our full collection of practical converters']
 ]))+
 section('Start with a familiar number','Look up ingredient-by-ingredient conversions without treating every food as flour.',grid(numberList.filter((_,i)=>[2,6,8,10,12,13].includes(i))),true);
 doc({url:'/',title:'Grams to Cups Calculator',description:'Convert grams to US or metric cups for '+data.length+' ingredients, including flour, sugar and butter. Get measuring fractions and see the source for each weight.',body,kind:'WebApplication'});
}

function hub(){
 const body=intro('Cooking measurement converters','Every ingredient has its own weight per cup. Explore all conversion directions, 24 detailed ingredient pages and three additional tool references, popular amounts, printable charts, and practical measurement guides.')+
 section('All cooking converters','Ingredient-aware mass and volume tools, plus fixed-volume conversions.',grid(hubList.concat([['/cooking/batch-converter/','Batch ingredient converter','Convert an entire ingredient list with explicit food references'],['/cooking/recipe-scaler/','Recipe scaler','Adjust every quantity for new serving sizes'],['/cooking/half-a-measurement/','Half a measurement','Fraction and amount calculator']])))+
 '<div id="ingredients"></div>'+section('Browse 24 ingredients','The name and measurement state matter. Packed sugar and dry rice do not convert like flour.','<div data-directory><div class="field" style="margin-bottom:18px"><label for="ingredient-search">Find an ingredient</label><input id="ingredient-search" type="search" placeholder="Search flour, sugar, butter…" data-directory-filter autocomplete="off"></div>'+grid(ingredientList,4).replaceAll('class="tile"','class="tile" data-filter-item')+'</div>',true)+
 section('Convert a specific weight','Select an amount, then compare multiple ingredients using referenced weights.',grid(numberList,4))+
 section('Charts and measuring guides','Practical tools with sources and printable results.',grid([['/cooking/charts/','All conversion charts','A print-friendly table of basic weights'],['/cooking/charts/flour/','Flour conversion chart','All-purpose, whole wheat, coconut and more'],['/cooking/charts/sugar/','Sugar conversion chart','Packed, granulated and unsifted varieties'],['/cooking/guides/measuring-flour/','Measuring flour','Avoid volume errors from compaction'],['/cooking/guides/cup-sizes/','Cup sizes','US vs metric cooking standards'],['/cooking/guides/measuring-odd-cups/','Odd cup amounts','Make 2/3 or 1/8 cup from common tools']]));
 doc({url:'/cooking/',title:'Cooking Measurement Converters & Ingredient Charts',description:'Explore ingredient-specific grams to cups, cups to grams, weight charts, recipe scaling and cited kitchen measurements.',body,bread:[['Cooking measurements',null]]});
}
function toolPage(t){
 const [slug,title,from,to,amount,type]=t,ingredient='all-purpose-flour';
 const needsIngredient=type==='ingredient';
 const value=convertQuantity(amount,from,to,{ingredient:byId.get(ingredient)});
 const example=f(amount)+' '+unitDescription(from)+' ≈ '+f(value)+' '+unitDescription(to);
 const metaDescription=example+(needsIngredient?' for spooned-and-leveled all-purpose flour. Select an ingredient to convert using its published weight.':' using US customary units. Use the calculator to convert your own cooking measurements.');
 const description=needsIngredient?'Mass-to-volume results change with food and measuring method. Select flour, sugar, butter or another referenced ingredient.':'These are fixed US kitchen-volume relationships. The ingredient selector matters only when you mix mass and volume units.';
 const body=intro(title+' Converter',description)+
 '<section class="section"><div class="container content-grid"><div>'+converterForm({amount,from,to,heading:title})+
 '<div class="panel mt-3"><h2>Conversion answer and calculation</h2><p>'+e(description)+'</p><p><strong>'+e(f(amount))+' '+e(unitDescription(from))+' = approximately '+e(f(value))+' '+e(unitDescription(to))+'</strong>'+(needsIngredient?' for spooned-and-leveled all-purpose flour, based on 120 g per US cup. Different foods give different answers.':' using defined US customary volume units. An ingredient weight is not needed for this direction.')+'</p>'+
 (needsIngredient?'<p>For mass-to-volume quantities, this estimate is based on the selected ingredient weight per cup. Scooping method, moisture, processing and cup standard can alter the result.</p>':'<p>For fixed volume units, the defined US customary cup, tablespoon and fluid ounce are enough to calculate the answer without any ingredient density.</p>')+
 '<div class="inline-note">A mass ounce (oz) and a US fluid ounce (fl oz) are different quantities. This tool keeps their units distinct.</div></div></div>'+
 '<aside class="panel side-panel"><h3>Reference values</h3><p>1 US cup = '+e(f(US_CUP_ML))+' mL<br>1 metric cup = '+METRIC_CUP_ML+' mL<br>1 US tbsp = '+e(f(US_TBSP_ML))+' mL<br>1 US cup = 8 US fl oz</p><p>'+link('/cooking/sources-and-methods/','See methods and sources')+'</p></aside></div></section>'+
 section('Related converters','Switch direction or browse a related kitchen measurement.',grid(hubList.filter(x=>x[0]!=='/cooking/'+slug+'/').slice(0,6)),true);
 doc({url:'/cooking/'+slug+'/',title:slug==='grams-to-cups'?'Grams to Cups — Legacy Converter':title+' Calculator',description:metaDescription,body,bread:[['Cooking','/cooking/'],[title,null]],kind:'WebApplication'});
}
function measureReferenceDifference(plan){
 if(!plan)return 'No practical combination; use a kitchen scale';
 const delta=plan.differenceGrams??plan.differenceMl;
 const unit=plan.differenceGrams===null?'mL':'g';
 const difference=Math.abs(delta)<.01?'Under 0.01 '+unit:
  f(Math.abs(delta))+' '+unit+' '+(delta>0?'above':'below')+' target';
 return difference+' ('+(Math.abs(plan.percentError)<.0005?'0':f(Math.abs(plan.percentError)))+'% difference)'+
  (Math.abs(plan.percentError)>=5?' · Prefer a kitchen scale':'');
}
function quickAnswerFor(n){
 const rows=['all-purpose-flour','granulated-sugar','butter'].map(id=>{
  const food=byId.get(id),cups=convertQuantity(n,'g','cup',{ingredient:food});
  const measure=suggestKitchenMeasures(cups,{ingredient:food});
  return [food.name,f(cups)+' US cups',measure?.instruction||'Use a kitchen scale',
   measureReferenceDifference(measure)];
 });
 return '<div class="panel quick-answer-panel"><h2>'+n+' grams to cups: quick answers</h2>'+
 '<p>Flour, sugar and butter weigh differently. These are referenced US cup estimates, not a universal weight-to-volume formula. Verify the matching food state and measuring method in the complete reference table below before using a result.</p>'+
 table(['Ingredient','Calculated US cups','Practical cup fills','Reference weight difference'],rows,{stacked:true})+
 '<p class="source-chip">Source: '+link(source,'King Arthur Baking Ingredient Weight Chart')+
 '. Exact baking weights are best measured on a scale. Select metric cups in the calculator below.</p></div>';
}
function numberPage(n){
 const answer=answerFor(n);
 // The detailed comparison uses the same optimizer as the quick answer and
 // live calculator. Never resurrect the old nearest-SINGLE-cup lookup.
 const examples=['all-purpose-flour','granulated-sugar','butter','long-grain-rice-dry'].map(id=>{
  const food=byId.get(id),exactCups=convertQuantity(n,'g','cup',{ingredient:food});
  const measure=suggestKitchenMeasures(exactCups,{ingredient:food});
  return [food.name,f(exactCups)+' cups',
   measure?.instruction||'Use a kitchen scale',measureReferenceDifference(measure)];
 });
 const body=intro('How Many Cups Is '+n+' Grams?','The answer depends on the ingredient. Compare common baking foods using documented weights, then choose a different cup standard in the calculator.')+
 '<section class="section"><div class="container content-grid"><div>'+answer.html+quickAnswerFor(n)+converterForm({amount:n,heading:n+' grams to cups'})+
 '<div class="panel mt-3"><h2>'+n+' grams: food-by-food comparison</h2><p>Compare the same '+n+' grams with '+data.length+' distinct ingredient weights. A cup of all-purpose flour weighs less than a cup of sugar, so the same mass takes up more space.</p>'+numberComparison(n)+
 '<p class="inline-note">Water in this comparison uses the recipe chart value of 227 g per US cup. It is not the physical-capacity estimate of about 1 g/mL. '+link('/cooking/ingredients/water/','Compare water methods')+'.</p>'+
 '<h2>Closest common cup measures for '+n+' grams</h2><p>These practical combinations use the very same measuring algorithm as the quick answers above, not a separate single-cup rounding rule. Every estimate shows its own reference weight difference; use a scale when precision matters.</p>'+ 
 '<div data-common-measures>'+table(['Ingredient','Calculated US cups','Practical cup combination','Weight difference'],examples)+'</div>'+
 '<p class="source-chip">All reference weights are linked to '+link(source,'the original published chart')+'. Rounded values are illustrative; results vary by ingredient state and measuring method.</p></div></div>'+
 '<aside class="panel side-panel"><h3>Other common weights</h3><div class="list-links">'+numberValues.filter(x=>x!==n).sort((a,b)=>Math.abs(a-n)-Math.abs(b-n)).slice(0,6).map(x=>link('/cooking/grams-to-cups/'+x+'-grams-to-cups/',x+' g','chip')).join('')+'</div><hr><h3>Ingredient examples</h3>'+link('/cooking/ingredients/all-purpose-flour/','Flour')+link('/cooking/ingredients/granulated-sugar/','Granulated sugar')+link('/cooking/ingredients/butter/','Butter')+
 ((flourNumbers.includes(n)||sugarNumbers.includes(n))?'<hr><h3>Specific weight guides</h3><div class="list-links">'+
 (flourNumbers.includes(n)?link('/cooking/ingredients/all-purpose-flour/'+n+'-grams-to-cups/',n+' g flour','chip'):'')+
 (sugarNumbers.includes(n)?link('/cooking/ingredients/granulated-sugar/'+n+'-grams-to-cups/',n+' g sugar','chip'):'')+'</div>':'')+
 '</aside></div></section>';
 doc({url:'/cooking/grams-to-cups/'+n+'-grams-to-cups/',title:n+' Grams to Cups for Flour, Sugar & More',description:n+' g of all-purpose flour is about '+f(answer.cups)+' US cups. Compare sugar, butter and '+(data.length-3)+' other ingredients, with US and metric cup options.',body,bread:[['Cooking','/cooking/'],['Grams to cups','/cooking/grams-to-cups/'],[n+' grams',null]],kind:'WebApplication'});
}
function ingredientPage(i){
 const preview=convertQuantity(100,'g','cup',{ingredient:i});
 // Deep ingredient + number pages must have meaningful on-site entry points.
 const popularWeights=i.id==='all-purpose-flour'?flourNumbers:i.id==='granulated-sugar'?sugarNumbers:[];
 const values=[25,50,75,100,125,150,200,250,300,400,500];
 const cupFractions=[[1/8,'1/8 cup'],[1/4,'1/4 cup'],[1/3,'1/3 cup'],[1/2,'1/2 cup'],[2/3,'2/3 cup'],[3/4,'3/4 cup'],[1,'1 cup'],[1.5,'1 1/2 cups'],[2,'2 cups']];
 const waterPanel=i.id==='water'?'<div class="panel mt-3" data-water-explanation><h2>Water: recipe chart weight or actual cup capacity?</h2>'+
 '<p><strong>The recipe chart lists 227 g per US cup.</strong> A standard US cup is 236.588 mL. At approximately 1 g per mL, a separate physical-volume estimate is about 236.588 g per US cup or 250 g per metric cup. Actual water density changes with temperature. Both methods are estimates serving different purposes.</p>'+
 table(['Water measure','Published recipe reference','Capacity estimate (≈1 g/mL)'],[
 ['1 US cup','227 g',f(US_CUP_ML)+' g'],
 ['1 metric cup',f(convertQuantity(1,'cup','g',{ingredient:i,standard:'metric'}))+' g','250 g'],
 ['100 g water',f(convertQuantity(100,'g','cup',{ingredient:i}))+' US cups',f(convertQuantity(100,'g','cup',{ingredient:i,waterMode:'capacity'}))+' US cups']])+
 '<p>Select the appropriate <strong>Water measurement method</strong> below. The recipe value is from '+link(i.sourceUrl,'the King Arthur Baking chart')+'; the ~1 g/mL capacity approximation is not from that published recipe chart.</p></div>':'';
 const body=intro(i.name+': Grams to Cups','Use the correct '+i.state+' reference. This weight belongs to the measuring method shown below; packed, sifted, dry and cooked ingredients are not interchangeable.')+
 '<section class="section"><div class="container content-grid"><div>'+
 '<div class="facts"><div class="fact"><strong>'+e(f(convertQuantity(1,'cup','g',{ingredient:i})))+' g</strong><span>per US cup'+(i.id==='water'?' · recipe chart':'')+'</span></div><div class="fact"><strong>'+e(f(preview))+' cups</strong><span>per 100 grams'+(i.id==='water'?' · recipe chart':'')+'</span></div><div class="fact"><strong>'+e(i.method)+'</strong><span>measurement method</span></div></div>'+
 '<div class="panel mt-3"><h2>How many grams are in one US cup of '+e(i.name.toLowerCase())+'?</h2>'+
 '<p>One US cup of '+e(i.name.toLowerCase())+' is approximately <strong>'+e(f(convertQuantity(1,'cup','g',{ingredient:i})))+' grams</strong> using the cited '+e(i.referenceGrams)+' g per '+e(i.referenceAmount)+' '+(i.referenceUnit==='cup'?'US cup':'US tablespoon')+' reference. Conversely, 100 grams is about <strong>'+e(f(preview))+' US cups</strong>. This estimate applies to '+e(i.state)+' measured by '+e(i.method)+', not to every preparation or brand. Source: '+link(i.sourceUrl,i.sourceName)+'.</p>'+
 '<p class="ingredient-evidence" data-ingredient-evidence><strong>For a metric cup:</strong> 100 g ≈ '+e(f(convertQuantity(100,'g','cup',{ingredient:i,standard:'metric'})))+' metric cups, while 1 metric cup ≈ '+e(f(convertQuantity(1,'cup','g',{ingredient:i,standard:'metric'})))+' g. These values scale the same published recipe reference from a '+e(f(US_CUP_ML))+' mL US cup to a 250 mL metric cup; they are not separate measurements. '+link('/cooking/guides/cup-sizes/','Compare cup standards')+'.</p></div>'+
 waterPanel+'<div class="mt-3">'+converterForm({amount:100,ingredient:i.id,heading:i.name+' conversion'})+'</div>'+
 '<div class="panel mt-3"><h2>'+e(i.name)+' conversion chart</h2><p>These quantities are calculated from '+e(i.referenceGrams)+' g per '+e(i.referenceAmount)+' '+e(i.referenceUnit)+'. '+e(i.note)+'</p>'+
 table(['Grams','US cups','Metric cups'],values.map(n=>[n+' g',f(convertQuantity(n,'g','cup',{ingredient:i,standard:'us'})),f(convertQuantity(n,'g','cup',{ingredient:i,standard:'metric'}))]))+
 '<h2>'+e(i.name)+': cups to grams</h2><p>For weighing a recipe rather than filling cups, use this reverse chart. The numbers assume the same food state, measuring technique, and US cup standard as the published reference. A metric cup (250 mL) uses a different quantity.</p>'+ 
 table(['US cup amount','Approximate grams','Equivalent metric cups'],cupFractions.map(([cup,label])=>[label,f(convertQuantity(cup,'cup','g',{ingredient:i,standard:'us'}))+' g',f(cup*US_CUP_ML/METRIC_CUP_ML)+' metric cups']))+
 (popularWeights.length?'<h2>Popular '+e(i.name.toLowerCase())+' weights</h2><p>Open a specific weight to compare the exact cup estimate with practical cup fractions using the same referenced ingredient state and method.</p><div class="list-links">'+popularWeights.map(n=>link('/cooking/ingredients/'+i.id+'/'+n+'-grams-to-cups/',n+' g '+i.name,'chip')).join('')+'</div>':'')+
 '<div class="inline-note">These are estimates from the original reference pair, not separate laboratory weighings. For precise baking, weigh ingredients directly in grams when the recipe supplies a mass.</div>'+ 
 '<p class="source-chip">Original published entry: <strong>'+e(i.sourceEntry)+'</strong> · '+link(i.sourceUrl,i.sourceName)+' · reference checked '+e(i.reviewedAt)+'. These cooking reference weights are approximate.</p></div></div>'+
 '<aside class="panel side-panel"><h3>Measurement context</h3><p><b>Food state:</b> '+e(i.state)+'</p><p><b>Method:</b> '+e(i.method)+'</p><p>'+e(i.note)+'</p><div class="inline-note">For repeatable baking, follow the weight written in your recipe and use a scale if available.</div>'+link('/cooking/sources-and-methods/','About the data')+'</aside></div></section>'+
 section('Related ingredients','Compare volume with foods that have different weights per cup.',grid(ingredientList.filter(x=>x[0]!=='/cooking/ingredients/'+i.id+'/').slice(0,6)),true);
 doc({url:'/cooking/ingredients/'+i.id+'/',title:i.name+' Grams to Cups & Weight Chart',description:'One US cup of '+i.name.toLowerCase()+' weighs about '+f(convertQuantity(1,'cup','g',{ingredient:i}))+' g. Convert grams and US or metric cups with a cited weight chart.',body,bread:[['Cooking','/cooking/'],[i.name,null]],kind:'WebApplication'});
}
function ingredientNumberPage(i,n){
 const result=answerFor(n,i.id),cups=result.cups;
 const fractions=[0.25,1/3,0.5,2/3,0.75,1,1.5,2];
 const body=intro(n+' Grams of '+i.name+' to Cups','This is a specific '+i.state+' conversion, not a generic grams-to-cups formula. It assumes the documented '+i.method+' method.')+
 '<section class="section"><div class="container content-grid"><div>'+result.html+
 converterForm({amount:n,ingredient:i.id,heading:'Convert '+n+' g of '+i.name})+
 '<div class="panel mt-3"><h2>Match the result to a measuring cup</h2><p>'+n+' grams is about '+f(cups)+' US cups; compare this amount with common kitchen cup portions, calculated from the same ingredient reference.</p>'+
 table(['Cup measure','Approximate weight','Difference from '+n+' g'],fractions.map(c=>{const g=convertQuantity(c,'cup','g',{ingredient:i});return [f(c)+' US cup',f(g)+' g',f(Math.abs(g-n))+' g '+(g>=n?'over':'under')]}))+
 '<p>'+e(i.note)+' Source: '+link(i.sourceUrl,i.sourceName)+'.</p></div></div><aside class="panel side-panel"><h3>More about '+e(i.name)+'</h3>'+
 link('/cooking/ingredients/'+i.id+'/','Ingredient reference')+link('/cooking/grams-to-cups/'+n+'-grams-to-cups/','Compare '+n+' g across foods')+link('/cooking/guides/measuring-flour/','Measuring technique')+'</aside></div></section>';
 doc({url:'/cooking/ingredients/'+i.id+'/'+n+'-grams-to-cups/',title:n+' Grams of '+i.name+' to Cups',description:n+' g of '+i.name.toLowerCase()+' is about '+f(cups)+' US cups. See the metric cup equivalent, measuring method and closest common cup portions.',body,bread:[['Cooking','/cooking/'],[i.name,'/cooking/ingredients/'+i.id+'/'],[n+' grams',null]],kind:'WebApplication'});
}
function chartPage(type){
 const chosen=type==='flour'?data.filter(i=>/flour/.test(i.id)):type==='sugar'?data.filter(i=>/sugar/.test(i.id)):data;
 const hasWater=chosen.some(i=>i.id==='water'),chartId='chart-'+(type||'all');
 const rows=chosen.map(i=>[
  i.name,
  f(convertQuantity(.25,'cup','g',{ingredient:i}))+' g',
  f(convertQuantity(.5,'cup','g',{ingredient:i}))+' g',
  f(convertQuantity(1,'cup','g',{ingredient:i}))+' g',i.method]);
 const title=type==='flour'?'Flour Cups to Grams Chart':type==='sugar'?'Sugar Cups to Grams Chart':'Printable Cooking Conversion Chart';
 const body=intro(title,'Choose US or metric cups, select a custom quantity, and print or export the same source-backed results. Preparation methods affect ingredient weights.')+
 '<section class="section"><div class="container"><div class="panel"><h2>Measured US cup portions</h2>'+
 '<p>Start with 1/4 cup and 1/2 cup, then customize the third column. The original table uses US cups (236.588 mL). Values are approximate cooking references, not independently measured densities.</p>'+
 '<div data-chart><div class="chart-settings">'+
 '<div class="field"><label for="'+chartId+'-standard">Cup standard</label><select id="'+chartId+'-standard" data-chart-standard><option value="us">US cup · 236.588 mL</option><option value="metric">Metric cup · 250 mL</option></select></div>'+
 '<div class="field"><label for="'+chartId+'-custom">Custom cup amount</label><input id="'+chartId+'-custom" data-chart-custom value="1" inputmode="decimal" autocomplete="off" spellcheck="false" aria-describedby="'+chartId+'-custom-help"><small id="'+chartId+'-custom-help">Use 1/3, 1, 1.5 or 2 cups (maximum 1,000).</small></div>'+
 (hasWater?'<div class="field"><label for="'+chartId+'-water">Water measurement basis</label><select id="'+chartId+'-water" data-chart-water-mode><option value="recipe">Recipe chart: 227 g / US cup</option><option value="capacity">Physical capacity: approximately 1 g/mL</option></select></div>':'')+
 '</div><noscript><style>.chart-settings{display:none!important}</style><p class="inline-note">JavaScript is off: this static table shows the default US cup quantities, which remain available for printing.</p></noscript>'+
 '<p class="chart-context" data-chart-context>Shown in US cups (236.588 mL), using published ingredient-specific weights. '+
 (hasWater?'Water currently uses the 227 g per US cup recipe chart value, not a physical 1 g/mL capacity estimate.':'Preparation and packing methods matter.')+
 '</p><p class="error" role="alert" data-chart-error hidden></p>'+
 '<div class="chart-toolbar"><div class="field"><label for="'+chartId+'-filter">Find an ingredient</label>'+
 '<input id="'+chartId+'-filter" type="search" data-chart-filter placeholder="Search flour, sugar, butter…" autocomplete="off"></div>'+
 '<div class="chart-tools"><span class="chart-count" role="status" data-chart-count>'+chosen.length+' of '+chosen.length+' ingredients shown</span>'+
 '<button class="btn" type="button" data-chart-download>Download CSV</button></div></div>'+
 '<div data-chart-table>'+table(['Ingredient','1/4 US cup','1/2 US cup','1 US cup','Method'],rows,{rowIds:chosen.map(i=>i.id)})+'</div>'+
 '<p class="chart-empty" data-chart-empty hidden>No matching ingredients. Try another search.</p></div>'+
 '<p class="source-chip">Recipe weight values: '+link(source,'King Arthur Baking Ingredient Weight Chart')+
 (hasWater?'. Water also offers a separate, approximate physical-capacity mode; its 1 g/mL estimate is not supplied by the recipe chart.':'. Preparation and packing methods matter.')+'</p>'+
 '<div class="calc-actions"><button class="btn btn-primary" type="button" data-chart-print>Print this chart</button>'+link('/cooking/guides/cup-sizes/','Cup-size guide','btn')+'</div></div></div></section>'+
 section('Other chart formats','Choose a focused chart to reduce confusion.',grid([['/cooking/charts/','All foods',data.length+' source-backed ingredient entries'],['/cooking/charts/flour/','Flour','Compare different flours'],['/cooking/charts/sugar/','Sugar','Compare packing and processing']],3),true);
 doc({url:'/cooking/charts/'+(type?type+'/':''),title,description:'Print a cups to grams chart for '+(type||data.length+' kitchen ingredients')+' with US or metric cup options, custom quantities, cited weights and ingredient-specific methods.',body,bread:[['Cooking','/cooking/'],['Charts',type?'/cooking/charts/':null],...(type?[[title,null]]:[])],kind:'WebPage'});
}
function guidePage(slug){
 const guides={
 'measuring-flour':{title:'How to Measure Flour Without Packing It',desc:'Why scooping and spooning flour can produce different weights and why weighing is more reliable.',parts:[
 ['Check the flour type','All-purpose, whole wheat, coconut and gluten-free flour have different weight references. Find the exact flour called for in your recipe rather than assuming one cup has a universal mass.'],
 ['Use the method stated by the source','If using a dry measuring cup, gently spoon flour into the cup and level with a straight edge. Avoid tapping the cup or compressing the flour unless a recipe asks for it.'],
 ['Use grams when accuracy matters','A scale bypasses the variability of cup filling. King Arthur Baking lists approximately 120 grams per US cup for all-purpose flour and 113 grams per US cup for whole wheat flour.']]},
 'cup-sizes':{title:'US Cups vs Metric Cups: Which One Is Correct?',desc:'A US customary cup is 236.588 mL; a metric cup is 250 mL. Choose the standard that matches the recipe.',parts:[
 ['Identify the recipe origin','US cookbooks generally use the customary cup; other countries often use a metric cup. The word cup alone does not specify one universal volume.'],
 ['Keep the ingredient reference explicit','We scale cited grams-per-US-cup estimates proportionally when showing metric cups. For powders, this is an approximation, not a new laboratory density measurement.'],
 ['Check tablespoons and fluid ounces','A US tablespoon is 14.78676478125 mL and a US cup has eight US fluid ounces. Australian tablespoons may use 20 mL; do not silently substitute that standard.']]},
 'measuring-odd-cups':{title:'How to Measure 2/3, 1/8 and Other Cup Amounts',desc:'Practical combinations for odd cup fractions without guessing density or confusing tablespoons.',parts:[
 ['Build 2/3 of a cup','Use two 1/3-cup measures if available. You can also use a marked liquid cup when the ingredient can be measured by liquid volume.'],
 ['Make 1/8 of a US cup','One US cup contains 16 US tablespoons, so 1/8 US cup equals two US tablespoons. Use level spoons for dry ingredients.'],
 ['Distinguish weight from volume','Even when two recipes both ask for 1/2 cup, the grams differ for flour, packed brown sugar, and butter. Select the ingredient before converting to mass.']]}
 };
 const g=guides[slug],content='<div class="panel">'+g.parts.map((p,i)=>'<section><h2>'+(i+1)+'. '+e(p[0])+'</h2><p>'+e(p[1])+'</p></section>').join('')+
 '<div class="inline-note">Reference values: '+link('/cooking/sources-and-methods/','our source and measurement policy')+'. Kitchen measurements are approximate for compressible ingredients.</div></div>';
 const body=intro(g.title,g.desc)+'<section class="section"><div class="container content-grid"><div>'+content+'</div><aside class="panel side-panel"><h3>Helpful tools</h3>'+link('/cooking/grams-to-cups/','Grams to cups')+link('/cooking/charts/','Print a chart')+link('/cooking/recipe-scaler/','Recipe scaler')+'</aside></div></section>';
 doc({url:'/cooking/guides/'+slug+'/',title:g.title,description:g.desc,body,bread:[['Cooking','/cooking/'],[g.title,null]]});
}

function batchPage(){
 const defaultList='120 g all-purpose flour\n198 g granulated sugar\n½ cup butter\n2 tbsp honey\n200 g flour';
 const body=intro('Batch Ingredient Converter','Paste a kitchen ingredient list and convert each supported item to cups or grams. Unclear ingredient names stay unchanged and are flagged for manual review — never guessed.')+
 '<section class="section"><div class="container content-grid"><div>'+
 '<div class="calc-card"><div class="calc-top"><strong><span class="live-dot" aria-hidden="true"></span>Convert an ingredient list</strong><span class="muted">UP TO 100 LINES · LOCAL ONLY</span></div>'+
 '<form class="calc-body" data-batch novalidate>'+
 '<div class="field full"><label for="batch-list">Ingredients — one amount, unit and exact ingredient per line</label>'+
 '<textarea id="batch-list" rows="8" maxlength="16000" data-batch-lines spellcheck="false">'+e(defaultList)+'</textarea>'+
 '<small>Examples: 120 g all-purpose flour · ½ US cup butter · 2 tbsp honey. Specify US cup or metric cup when copying a labeled amount; unqualified “cup” uses the selected cup standard. “Flour” alone is not a specific enough food state.</small></div>'+
 '<div class="form-grid mt-3"><div class="field"><label for="batch-target">Convert all lines to</label><select id="batch-target" data-batch-target><option value="cup">US cups</option><option value="g">Grams (g)</option></select></div>'+
 '<div class="field"><label for="batch-standard">Cup standard</label><select id="batch-standard" data-batch-standard><option value="us">US · 236.588 mL</option><option value="metric">Metric · 250 mL</option></select></div></div>'+
 '<div class="batch-options"><label class="toggle-option"><input type="checkbox" data-batch-fraction checked> Show familiar cup fractions when exact</label></div>'+
 '<p class="batch-review-help">Unrecognized lines stay unchanged until you select an exact published food in the results below.</p>'+ 
 '<div class="calc-actions"><button class="btn btn-primary" type="button" data-batch-run>Convert list</button><button class="btn" type="button" data-batch-copy>Copy results</button>'+
 '<button class="btn" type="button" data-batch-csv>Download CSV</button><button class="btn btn-ghost" type="button" data-batch-clear>Clear</button></div>'+
 '<p class="error" role="alert" data-batch-error hidden></p><p class="batch-feedback" data-batch-feedback role="status"></p><div class="batch-summary" role="status" data-batch-summary>Results appear below as you type.</div>'+
 '<div class="table-shell"><div class="table-scroll batch-result-table" tabindex="0" role="region" aria-label="Batch conversion results"><table><thead><tr><th scope="col">Original line</th><th scope="col">Conversion / review</th></tr></thead><tbody data-batch-results></tbody></table></div><p class="table-scroll-hint" hidden>↔ Scroll to compare original and converted lines</p></div>'+
 '<p class="source-chip">Ingredient weights from '+link(source,'King Arthur Baking’s ingredient weight chart')+'. Original lines are preserved if an ingredient or unit cannot be safely identified. Your text stays in your browser.</p>'+
 '</form></div>'+
 '<div class="panel mt-3"><h2>How the batch converter protects accuracy</h2>'+
 '<p>Every mass-to-volume result depends on the exact ingredient and its original published reference weight. Packed brown sugar differs from loose brown sugar; sifted sugar differs from unsifted. Ambiguous names are flagged instead of silently converted.</p>'+
 '<p>The tool supports fractional quantities, grams, ounces, US cups, metric cups, teaspoons, tablespoons and milliliters. Explicit input cup labels take precedence over the selected result cup standard, so a US cup pasted into a metric conversion is not silently treated as 250 mL. Unqualified cups use the selected standard. Each row is processed locally; export converted lines and any review warnings for your recipe notes.</p>'+
 '<div class="inline-note">This is a measurement assistant, not recipe rewriting. Keep ingredient temperature, packaging and the original cooking instructions in mind when substituting volume for weight.</div></div></div>'+
 '<aside class="panel side-panel"><h3>Related tools</h3>'+
 link('/cooking/recipe-scaler/','Scale serving sizes')+
 link('/cooking/ingredients/all-purpose-flour/','All-purpose flour weight')+
 link('/cooking/ingredients/granulated-sugar/','Granulated sugar weight')+
 link('/cooking/charts/','Print food weight chart')+
 link('/cooking/sources-and-methods/','Data and measurement methods')+
 '<div class="inline-note">For best accuracy, write explicit names such as “all-purpose flour” and “packed brown sugar.”</div></aside></div></section>';
 doc({url:'/cooking/batch-converter/',title:'Batch Ingredient Converter — Cups, Grams & Recipe Lists',description:'Paste an ingredient list and convert supported foods to cups or grams with exact fraction support, warnings for ambiguous items and a local CSV export.',body,bread:[['Cooking','/cooking/'],['Batch ingredient converter',null]],kind:'WebApplication',index:false});
}

function recipePage(){
 const body=intro('Free Recipe Scaler','Increase or decrease serving amounts using browser-local calculations. This tool changes quantities but does not guess missing ingredients or replace a baker’s judgment.')+
 '<section class="section"><div class="container content-grid"><div><div class="calc-card"><div class="calc-top"><strong><span class="live-dot"></span>Scale your recipe</strong><span class="muted">No upload · No account</span></div>'+
 '<form class="calc-body" data-recipe><div class="form-grid"><div class="field"><label for="old-servings">Original servings</label><input id="old-servings" data-old-servings type="text" value="4" inputmode="decimal"></div><div class="field"><label for="new-servings">New servings</label><input id="new-servings" data-new-servings type="text" value="6" inputmode="decimal"></div>'+
 '<div class="field full"><label for="recipe-lines">One ingredient per line</label><textarea id="recipe-lines" data-recipe-lines spellcheck="false">200 g all-purpose flour\n1 1/2 cups milk\n2 tbsp honey\n1/4 tsp salt</textarea><small>Start each line with a quantity. Fractions like ½, 1½ and 1 ¹⁄₂ work. Simple ranges such as 1–2 cups scale both ends; ambiguous compound lines remain unchanged for manual review.</small></div></div>'+
 '<div class="batch-options"><label class="toggle-option"><input type="checkbox" data-recipe-fraction checked> Show common cup fractions when exact (e.g., 2 1/4)</label></div>'+
 '<div class="calc-actions"><button class="btn btn-primary" type="submit">Scale recipe</button><button class="btn" type="button" data-download-csv>Download CSV</button><button class="btn" type="button" data-recipe-print>Print</button></div>'+
 '<p class="error" data-recipe-error role="alert" hidden></p><div class="result recipe-results"><div class="result-label">Scaled ingredient list</div><pre data-recipe-output aria-live="polite"></pre></div></form></div>'+
 '<div class="panel mt-3"><h2>What this scaler does</h2><p>Amounts are multiplied by the new servings divided by the original servings. It preserves unit labels and ingredient text instead of guessing whether two ingredients share a density. Review lines that cannot be parsed safely.</p><p>Cooking time, pan size, rise time, and heat transfer do not necessarily scale in proportion with ingredient amounts. Use your recipe instructions for those decisions.</p></div></div>'+
 '<aside class="panel side-panel"><h3>Also useful</h3>'+link('/cooking/batch-converter/','Batch ingredient converter')+link('/cooking/grams-to-cups/','Grams to cups')+link('/cooking/charts/','Printable conversion chart')+'</aside></div></section>';
 doc({url:'/cooking/recipe-scaler/',title:'Recipe Scaler — Adjust Ingredient Quantities Free',description:'Scale recipe quantities and serving sizes in your browser, preserve ingredient text and export a CSV without accounts or paid APIs.',body,bread:[['Cooking','/cooking/'],['Recipe scaler',null]],kind:'WebApplication'});
}
function halfPage(){
 const fractionWidget='<div class="calc-card mt-3"><div class="calc-top"><strong><span class="live-dot" aria-hidden="true"></span>Add, subtract, multiply or divide fractions</strong></div>'+
 '<form class="calc-body" data-fraction-arithmetic novalidate><p class="muted">Combine kitchen measurements using exact fractions when practical. For example, 1/2 + 1/4 = 3/4.</p>'+
 '<div class="fraction-grid"><div class="field"><label for="fraction-first">First quantity</label><input id="fraction-first" data-fraction-first type="text" value="1/2" inputmode="decimal" autocomplete="off"></div>'+
 '<div class="field"><label for="fraction-operation">Operation</label><select id="fraction-operation" data-fraction-operation><option value="+">Add (+)</option><option value="-">Subtract (−)</option><option value="*">Multiply (×)</option><option value="/">Divide (÷)</option></select></div>'+
 '<div class="field"><label for="fraction-second">Second quantity</label><input id="fraction-second" data-fraction-second type="text" value="1/4" inputmode="decimal" autocomplete="off"></div></div>'+
 '<div class="result mt-3"><span class="result-label">Combined measurement</span><output class="result-number" data-fraction-result aria-live="polite">3/4</output><p class="result-text" data-fraction-decimal>Decimal equivalent: 0.75</p></div>'+
 '<p class="error" role="alert" data-fraction-error hidden></p><p class="source-chip">Supports mixed quantities such as 1 1/2 and Unicode ½. Results are exact as fractions when a useful small denominator exists; otherwise the displayed decimal is rounded. Subtraction cannot produce a negative kitchen quantity.</p></form></div>';
 const body=intro('Half a Measurement & Kitchen Fraction Calculator','Halve a kitchen quantity or combine fractions such as 1/2 + 1/4, without confusing volume and ingredient weight.')+
 '<section class="section"><div class="container content-grid"><div><form class="calc-card" data-half-form><div class="calc-top"><strong><span class="live-dot"></span>Half a quantity</strong></div><div class="calc-body"><div class="field"><label for="half-quantity">Amount to halve</label><input id="half-quantity" data-half-input type="text" value="3/4" inputmode="decimal"></div><div class="result"><span class="result-label">Half of your amount</span><output class="result-number" data-half-result aria-live="polite">0.375</output></div><p class="error" role="alert" data-half-error hidden></p></div></form>'+
 fractionWidget+
 '<div class="panel mt-3"><h2>Common half-measurements</h2>'+table(['Original quantity','Half'],[['1 cup','1/2 cup'],['3/4 cup','3/8 cup'],['2/3 cup','1/3 cup'],['1/2 cup','1/4 cup'],['1/4 cup','1/8 cup']])+'<p>The same numerical rules apply to grams, cups, tablespoons and teaspoons, but converting mass to volume still requires an ingredient-specific weight reference.</p></div></div>'+
 '<aside class="panel side-panel"><h3>Measure fractions</h3>'+link('/cooking/guides/measuring-odd-cups/','Odd cup amounts')+link('/cooking/recipe-scaler/','Scale a whole recipe')+'</aside></div></section>';
 doc({url:'/cooking/half-a-measurement/',title:'Half of a Measurement — Fractions Calculator',description:'Halve measurements and add, subtract, multiply or divide kitchen fractions like 1/2 + 1/4. Free exact-fraction and decimal answers in your browser.',body,bread:[['Cooking','/cooking/'],['Half a measurement',null]],kind:'WebApplication'});
}
function methodology(){
 const body=intro('Sources, Methods and Measurement Limitations','We make our recipe references transparent. Mass-to-volume estimates require a defined food, state, measuring method and cup standard.')+
 '<section class="section"><div class="container content-grid"><div><div class="panel"><h2>Primary reference</h2><p>'+link(source,'King Arthur Baking Ingredient Weight Chart')+' provides the published ingredient measurement pairs used in our '+data.length+'-item reference set. We store the original number of grams and the original volume per ingredient, and compute other quantities from those values.</p>'+
 '<h2>How to convert grams to cups</h2><ol><li>Find the published weight for the specific ingredient and how it was measured.</li><li>Express that weight per US cup. Double a half-cup weight, or multiply a tablespoon weight by 16.</li><li>For US cups, divide the grams by the resulting grams per cup. For metric cups, multiply the US cup result by '+f(US_CUP_ML)+' ÷ '+METRIC_CUP_ML+'.</li></ol>'+
 '<p><strong>Example:</strong> '+e(byId.get('all-purpose-flour').referenceGrams)+' g of spoon-and-leveled all-purpose flour is 1 US cup, or about '+f(US_CUP_ML/METRIC_CUP_ML)+' metric cups. To convert cups back to grams, multiply by the grams per cup for the chosen cup standard.</p>'+
 '<p><strong>US customary cup:</strong> '+US_CUP_ML+' mL. <strong>Metric cup:</strong> '+METRIC_CUP_ML+' mL. <strong>US tablespoon:</strong> '+US_TBSP_ML+' mL. Metric cup baking weights are scaled from US recipe references. For the US customary cup, see the volume conversion table in '+link(volumeSource,'NIST Letter Circular 1098')+'.</p>'+
 '<h2>Important limitations</h2><p>Recipe chart weights are not necessarily physical density at a specified temperature. For example, the cited chart assigns 227 g per cup to water while a physical 236.588 mL cup of water weighs about 236.6 g near ordinary room conditions. We explicitly label the former as a recipe-reference value.</p>'+
 '<p>Packed brown sugar, unsifted confectioners sugar, and uncooked rice are distinct states. We do not apply one state’s weight to another. For repeatability, use the weight printed in the original recipe and prefer a scale.</p>'+
 '<h2>How to verify a quoted conversion</h2><p>A complete cooking answer needs the ingredient, food state, cup standard, source weight, and measurement method. For example, 100 g of spooned-and-leveled all-purpose flour is about '+e(f(convertQuantity(100,'g','cup',{ingredient:byId.get('all-purpose-flour')})))+' US cups: 100 g divided by 120 g per US cup. The same 100 g is about '+e(f(convertQuantity(100,'g','cup',{ingredient:byId.get('all-purpose-flour'),standard:'metric'})))+' metric cups using a 250 mL metric cup. The source is '+link(source,'King Arthur Baking’s Ingredient Weight Chart')+', not an independent measurement made by this website.</p>'+
 '<p>We report the date on which our reference entries were checked, not a claim that the publisher updated its chart on that date. Rounded display values are estimates. Do not cite a result without its food state or infer that sugar, rice, oil, or water shares flour’s grams-per-cup value. '+link('/contact/','Report a questionable value')+'.</p>'+
 '<h2>Source entries used by this website</h2><p>The table below reproduces the identifying entry names and original measurement pairs used for each ingredient. These are the specific published references, not universal averages across brands or food states.</p>'+ table(['Our ingredient','Original chart entry','Original weight / volume','Measurement condition'],data.map(i=>[i.name,i.sourceEntry,f(i.referenceGrams)+' g / '+f(i.referenceAmount)+' '+(i.referenceUnit==='tablespoon'?'US tablespoon':'US cup'),i.method]))+ '<p class="source-chip">Source checked '+e(data[0].reviewedAt)+': '+link(source,'King Arthur Baking Ingredient Weight Chart')+'. Review the original source when applying measurements to another brand or recipe.</p>'+ '<h2>Corrections and privacy</h2><p>All calculations are local in the browser. We do not collect the recipe lines typed into the scaler. If an ingredient weight looks wrong, '+link('/contact/','send a correction')+' with the food, quantity, cup standard and a published source if available.</p></div></div>'+
 '<aside class="panel side-panel"><h3>Browse referenced foods</h3>'+data.slice(0,9).map(i=>link('/cooking/ingredients/'+i.id+'/',i.name)).join('')+'</aside></div></section>';
 doc({url:'/cooking/sources-and-methods/',title:'Ingredient Weight Sources and Conversion Methodology',description:'Learn how grams to cups estimates use cited ingredient weights, US and metric cup sizes, measurement states and clear uncertainty notes.',body,bread:[['Cooking','/cooking/'],['Sources and methods',null]]});
}
function infoPage(slug,title,description,sectionTitle,contents){
 const body=intro(title,description)+
 '<section class="section"><div class="container"><div class="panel"><h2>'+e(sectionTitle)+'</h2>'+contents+'</div></div></section>';
 doc({url:'/'+slug+'/',title,description,body,bread:[[title,null]]});
}
home();hub();
for(const t of tools)toolPage(t);
halfPage();recipePage();batchPage();
for(const n of numberValues)numberPage(n);
for(const i of pageIngredients)ingredientPage(i);
for(const n of flourNumbers)ingredientNumberPage(byId.get('all-purpose-flour'),n);
for(const n of sugarNumbers)ingredientNumberPage(byId.get('granulated-sugar'),n);
for(const type of ['','flour','sugar'])chartPage(type);
for(const guide of ['measuring-flour','cup-sizes','measuring-odd-cups'])guidePage(guide);
methodology();
infoPage('about','About Grams & Cups','Grams & Cups is a free, independent kitchen measurement reference that helps home bakers use grams, cups and spoon measurements more carefully.',
 'How Grams & Cups works',
 '<h3>Ingredient weights and cup sizes</h3><p>We use published recipe weights to estimate mass-to-volume conversions for specific ingredients. The '+link('/cooking/sources-and-methods/','methodology page')+' lists the original measurements, cup sizes and limitations.</p>'+
 '<h3>Calculators in your browser</h3><p>You can convert measurements, adjust recipe quantities and print kitchen charts without creating an account.</p>');
infoPage('privacy','Privacy Policy','We aim to minimize data collection. The calculator and recipe scaler are local-first browser tools; there is no account or ad network; optional analytics requires your consent.',
 'How the site handles your data',
 '<h3>Calculator and recipe inputs</h3><p>The amounts and recipe text you enter are processed in your browser. The tools do not require an account or upload these inputs to cloud storage. If you create a converter share link, its selected amount, units and ingredient can appear in the URL.</p>'+
 '<h3>Analytics and advertising</h3><p>Optional Google Analytics measures visits and traffic sources only after you accept analytics. It may use cookies and technical browser information. The integration sends the canonical page and recognized AI referral source, not recipe text, quantities or shared URL parameters. Rejecting or withdrawing consent via Analytics preferences does not affect the tools. No advertising is included. See <a href="https://policies.google.com/privacy">Google privacy policy</a>.</p>');
infoPage('contact','Contact and Corrections','Ask a question about a conversion, report a bug, or suggest a correction to a published ingredient weight.',
 'Questions and corrections',
 '<h3>Email</h3><p>Email <!--email_off-->'+link('mailto:'+contactEmail,contactEmail)+'<!--/email_off--> with the ingredient, quantity and selected cup standard. Include the result you expected and a published reference if you have one.</p>'+
 '<h3>Public bug reports</h3><p>For a public bug report, use '+link('https://github.com/garrison2025/Grams-to-Cups/issues','Grams-to-Cups GitHub issues')+'. Keep private details in email.</p>');
writeFile('404.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page not found | Grams & Cups</title><link rel="stylesheet" href="/assets/styles.css"><main class="container section"><h1>Page not found</h1><p>That page does not exist. Try the conversion tools or the ingredient directory.</p>'+link('/cooking/','Browse cooking tools','btn btn-primary')+'</main></html>');
writeFile('favicon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#122e27"/><path d="M18 20h28l-4 26H22z" fill="none" stroke="#eaf2ad" stroke-width="4" stroke-linejoin="round"/><path d="M21 29h22M24 38h16" stroke="#f8f7f2" stroke-width="3" stroke-linecap="round"/></svg>');
for(const [src,dst] of [['public/styles.css','assets/styles.css'],['public/app.js','assets/app.js'],['public/optional-analytics.js','assets/optional-analytics.js'],['src/core.mjs','assets/core.mjs'],['src/ingredients.json','assets/ingredients.json']]){const out=path.join(dist,dst);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(path.join(root,src),out);}
// Cloudflare Pages supports absolute-URL scoped _headers rules. This keeps
// pages.dev and branch-preview hosts unindexed even after the canonical custom
// domain serves indexable HTML. Domain redirect is additionally recommended.
const commonHeaders='/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n';
const pagesDevNoindex='\nhttps://grams-to-cups.pages.dev/*\n  X-Robots-Tag: noindex\n\nhttps://:version.grams-to-cups.pages.dev/*\n  X-Robots-Tag: noindex\n';
writeFile('_headers',commonHeaders+(publicIndex?'':'  X-Robots-Tag: noindex\n')+pagesDevNoindex);
writeFile('robots.txt','User-agent: *\nAllow: /\n'+(publicIndex?'Sitemap: '+origin+'/sitemap.xml\n':''));
if(publicIndex)writeFile('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pages.filter(p=>p.indexCandidate).map(p=>'<url><loc>'+e(origin+p.url)+'</loc></url>').join('')+'</urlset>');
writeFile('site-manifest.json',JSON.stringify({origin:origin||null,publicIndex,generatedAt:new Date().toISOString(),pages},null,2));
if(pages.length!==81)throw Error('Expected 81 total pages including the standalone batch tool; found '+pages.length);
console.log('Generated '+pages.length+' static pages ('+pages.filter(p=>p.indexCandidate).length+' index candidates), publish approved='+publicIndex);
