import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {convertQuantity,formatAmount,unitDescription,approximateFraction,US_CUP_ML,METRIC_CUP_ML,US_TBSP_ML} from '../src/core.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const data=JSON.parse(fs.readFileSync(path.join(root,'src/ingredients.json'),'utf8'));
const byId=new Map(data.map(i=>[i.id,i]));
const dist=path.join(root,'dist');
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(dist,{recursive:true});
const base=(process.env.SITE_URL||'').trim().replace(/\/+$/,'');
const origin=/^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(base)?base:'';
const releaseRequested=process.env.CF_PAGES_BRANCH==='main'&&process.env.PUBLIC_INDEX_APPROVED==='true';
const hostname=origin?new URL(origin).hostname.toLowerCase():'';
const reservedHost=hostname==='localhost'||hostname==='127.0.0.1'||hostname==='0.0.0.0'||hostname==='example.com'||hostname.endsWith('.example')||hostname.endsWith('.invalid')||hostname.endsWith('.test')||hostname.endsWith('.localhost');
if(releaseRequested&&!origin)throw new Error('Production publication requested but SITE_URL is missing or invalid. Set the exact stable HTTPS host.');
const approvedCiFixture=process.env.CI==='true'&&process.env.SITE_URL_FIXTURE_APPROVED_FOR_CI==='true'&&hostname==='example.com';
if(releaseRequested&&reservedHost&&!approvedCiFixture)throw new Error('Production SITE_URL cannot be a placeholder or local/test domain. Set your verified public hostname.');
const publicIndex=releaseRequested&&!!origin;
const pages=[],e=s=>String(s??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#39;');
const primaryUrl=url=>url==='/cooking/grams-to-cups/'?'/':url;
const f=n=>formatAmount(n,3),link=(url,label,cls='')=>'<a href="'+e(primaryUrl(url))+'"'+(cls?' class="'+e(cls)+'"':'')+'>'+e(label)+'</a>';
const source='https://www.kingarthurbaking.com/learn/ingredient-weight-chart';
const numberValues=[25,30,50,60,75,80,100,125,150,180,200,225,250,300,350,400,450,500,600,750,1000];
// Same search intent as the homepage: keep the tool usable but direct internal SEO links to /.
const noIndexCandidatePaths=new Set(['/cooking/grams-to-cups/','/cooking/grams-to-cups/1000-grams-to-cups/','/cooking/cups-to-fluid-ounces/','/cooking/fluid-ounces-to-cups/','/cooking/recipe-scaler/','/cooking/ingredients/whole-wheat-flour/','/cooking/ingredients/coconut-flour/','/cooking/ingredients/gluten-free-flour/','/cooking/ingredients/brown-rice-cooked/','/cooking/ingredients/maple-syrup/','/cooking/ingredients/olive-oil/','/cooking/ingredients/cornstarch/','/cooking/ingredients/pumpkin-puree/','/cooking/ingredients/walnuts-chopped/','/cooking/guides/measuring-flour/','/cooking/batch-converter/']);
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
function footer(){return '<footer class="footer"><div class="container"><div class="footer-grid"><div>'+link('/','Grams & Cups','logo')+'<p>Friendly cooking measurements, grounded in referenced ingredient weights.<br>No account required; calculations stay in your browser.</p></div><nav class="footer-links" aria-label="Footer">'+link('/about/','About')+link('/privacy/','Privacy')+link('/contact/','Contact')+link('/cooking/sources-and-methods/','Sources')+link('/cooking/charts/','Print chart')+'</nav></div><div class="footer-note">© '+new Date().getUTCFullYear()+' Grams & Cups · Recipe reference estimates are not laboratory density measurements. Confirm important recipes by weighing ingredients.</div></div></footer>';}
function jsonld(obj){return '<script type="application/ld+json">'+JSON.stringify(obj).replaceAll('<','\\u003c')+'</script>';}
function doc(spec){
 const {url,title,description,body,bread=[],kind='WebPage',index=true}=spec;
 if(!url.startsWith('/')||pages.some(p=>p.url===url))throw Error('Duplicate or invalid route: '+url);
 const canonical=origin?origin+url:'';
 const eligible=index&&!noIndexCandidatePaths.has(url);
 const permitted=publicIndex&&eligible;
 const pageTitle=title+' | Grams & Cups';
 const crumbs=[{name:'Home',item:origin+'/'},...bread.map(x=>({name:x[0],item:origin+(x[1]||url)}))];
 const schema=permitted?jsonld({'@context':'https://schema.org','@type':'WebPage',name:pageTitle,url:canonical,description,inLanguage:'en',isPartOf:{'@type':'WebSite',name:'Grams & Cups',url:origin+'/'}})+(bread.length?jsonld({'@context':'https://schema.org','@type':'BreadcrumbList',itemListElement:crumbs.map((x,i)=>({'@type':'ListItem',position:i+1,name:x.name,item:x.item}))}):'')+(kind==='WebApplication'?jsonld({'@context':'https://schema.org','@type':'WebApplication',name:title,url:canonical,applicationCategory:'UtilitiesApplication',operatingSystem:'Any modern web browser',offers:{'@type':'Offer',price:'0',priceCurrency:'USD'}}):''):'';
 const html='<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="theme-color" content="#f8f7f2">'+
 '<meta name="description" content="'+e(description)+'"><meta name="robots" content="'+(permitted?'index,follow':'noindex,follow')+'">'+
 (permitted?'<link rel="canonical" href="'+e(canonical)+'">':'')+'<title>'+e(pageTitle)+'</title><meta property="og:type" content="website"><meta property="og:title" content="'+e(pageTitle)+'"><meta property="og:description" content="'+e(description)+'">'+(permitted?'<meta property="og:url" content="'+e(canonical)+'">':'')+
 '<link rel="icon" type="image/svg+xml" href="/favicon.svg"><link rel="stylesheet" href="/assets/styles.css">'+schema+
 '<script type="module" src="/assets/app.js" defer></script></head><body>'+nav()+'<main id="main">'+
 (url==='/'?'':'<div class="container">'+breadHtml(bread)+'</div>')+body+'</main>'+footer()+'</body></html>';
 writeFile(fileFor(url),html);
 pages.push({url,title,description,kind,indexCandidate:eligible,wordCount:body.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().split(' ').length});
}
function section(title,intro,contents,alt=false){return '<section class="section'+(alt?' section-alt':'')+'"><div class="container"><div class="section-head"><h2>'+e(title)+'</h2><p>'+e(intro)+'</p></div>'+contents+'</div></section>';}
function grid(items,cols=3){
 return '<div class="cards'+(cols===4?' four':'')+'">'+items.map(([url,title,desc],i)=>
 '<a class="tile" href="'+e(primaryUrl(url))+'"><span class="tile-index" aria-hidden="true">'+String(i+1).padStart(2,'0')+'</span><b>'+e(title)+'</b><p>'+e(desc)+'</p><span class="arrow" aria-hidden="true">↗</span></a>').join('')+'</div>';
}

function table(headers,rows){return '<div class="table-scroll"><table><thead><tr>'+headers.map(x=>'<th scope="col">'+e(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(r=>'<tr>'+r.map(x=>'<td>'+e(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';}
function unitSelect(label,which,selected){
 const options=units.map(u=>'<option value="'+u+'"'+(selected===u?' selected':'')+'>'+e(unitDescription(u))+'</option>').join('');
 return '<div class="field"><label for="'+which+'">'+e(label)+'</label><select id="'+which+'" data-'+which+'>'+options+'</select></div>';
}
function ingredientSelect(selected='all-purpose-flour',hidden=false){return '<div class="field full" data-density-field'+(hidden?' hidden':'')+'><label for="ingredient-choice">Ingredient</label><select id="ingredient-choice" data-ingredient>'+data.map(i=>'<option value="'+e(i.id)+'"'+(i.id===selected?' selected':'')+'>'+e(i.name)+'</option>').join('')+'</select><small>Different ingredients have different mass per cup. References reflect their stated measurement methods.</small></div>';}
function converterForm({amount=100,from='g',to='cup',ingredient='all-purpose-flour',heading='Instant conversion'}={}){
 const ref=byId.get(ingredient)||data[0];
 const massUnits=['g','kg','oz'];
 const crossDimension=massUnits.includes(from)!==massUnits.includes(to);
 const standardRelevant=from==='cup'||to==='cup';
 const quickAmounts=[50,100,200,250];
 const foodButtons=[['all-purpose-flour','Flour'],['granulated-sugar','Sugar'],['butter','Butter'],['long-grain-rice-dry','Rice']]
 .map(([id,label])=>'<button class="ingredient-chip" type="button" data-ingredient-preset="'+e(id)+'" aria-pressed="'+String(id===ingredient)+'">'+e(label)+'</button>').join('');
 const amountButtons=quickAmounts.map(n=>'<button class="amount-chip" type="button" data-amount-preset="'+n+'" aria-pressed="'+String(Number(amount)===n)+'">'+n+' '+e(from)+'</button>').join('');
 let preview='—';
 try{preview=f(convertQuantity(Number(amount),from,to,{ingredient:ref,standard:'us'}));}catch{}
 const shortUnit=({cup:'US cups',g:'g',kg:'kg',oz:'oz',ml:'mL',tbsp:'tbsp',tsp:'tsp','fl-oz':'US fl oz'})[to]||to;
 return '<div class="calc-card" id="converter"><div class="calc-top"><strong><span class="live-dot" aria-hidden="true"></span>'+e(heading)+'</strong><span class="muted">PRIVATE · INSTANT</span></div>'+
 '<form class="calc-body" data-calc novalidate><div class="form-grid">'+
 '<div class="field full"><label for="quantity">How much are you measuring?</label><input id="quantity" data-amount type="text" inputmode="decimal" autocomplete="off" spellcheck="false" value="'+e(amount)+'" aria-describedby="amount-help"><small id="amount-help">Try 1/4, 1 1/2, or 125.5.</small></div>'+
 '<div class="field full"><div class="quick-row" role="group" aria-label="Common quantities"><span class="micro-label">QUICK VALUES</span>'+amountButtons+'</div></div>'+
 ingredientSelect(ingredient,!crossDimension)+
 '<div class="field full" data-density-field'+(crossDimension?'':' hidden')+'><div class="quick-row" role="group" aria-label="Popular ingredients"><span class="micro-label">POPULAR</span>'+foodButtons+'</div></div>'+
 '<div class="unit-stage">'+unitSelect('From unit','from',from)+
 '<button class="unit-switch" type="button" data-swap aria-label="Swap from and to units" title="Swap conversion direction">⇄</button>'+
 unitSelect('To unit','to',to)+'</div>'+
 '<div class="standard-line" data-cup-standard-row'+(standardRelevant?'':' hidden')+'><label for="cup-standard">Cup standard</label><select id="cup-standard" data-standard><option value="us" selected>US · 236.588 mL</option><option value="metric">Metric · 250 mL</option></select></div>'+
 '</div>'+
 '<div class="result" role="group" aria-label="Live conversion result">'+
 '<div class="result-label">YOUR CONVERSION</div>'+
 '<div class="result-amount" aria-live="polite" aria-atomic="true"><output class="result-number" data-result>'+e(preview)+'</output><span class="result-unit" data-result-unit>'+e(shortUnit)+'</span></div>'+
 '<p class="result-text" data-result-note>Based on '+e(ref.name)+' — '+e(ref.method)+'. Approximate cooking reference.</p>'+
 '<div class="cup-meter-wrap" data-meter-wrap><div class="cup-meter" aria-hidden="true"><div class="cup-meter-fill" data-meter-fill style="width:83%"></div></div><div class="cup-meter-label" data-meter-label>Proportion of one cup</div></div>'+
 '<div class="result-meta"><span>Ingredient: <b data-meta-ingredient>'+e(ref.name)+'</b></span><span>Reference: <b data-meta-reference>'+e(ref.referenceGrams)+' g / '+e(ref.referenceAmount)+' '+e(ref.referenceUnit)+'</b></span></div>'+
 '</div>'+
 '<p data-error class="error" role="alert" hidden></p>'+
 '<div class="calc-actions"><button class="btn btn-primary" type="button" data-copy>↗ Copy result</button>'+
 '<button class="btn" type="button" data-share>Share link</button><button class="btn" type="button" data-print>Print</button>'+
 '<button class="btn btn-ghost" type="button" data-reset>Reset</button></div>'+
 '<p class="source-chip"><span data-feedback role="status"></span>'+
 '<span data-source-ingredient'+(crossDimension?'':' hidden')+'>Ingredient-based estimate from '+link(source,'King Arthur Baking’s published weight chart')+'. Actual food preparation affects measurements.</span>'+
 '<span data-source-fixed'+(crossDimension?' hidden':'')+'>This conversion uses defined units and does not require ingredient weights. '+link('/cooking/sources-and-methods/','View our measurement standards')+'.</span></p>'+
 '</form></div>';
}

function answerFor(amount,ingredient='all-purpose-flour',standard='us'){
 const i=byId.get(ingredient),cups=convertQuantity(amount,'g','cup',{ingredient:i,standard});
 return {cups,html:'<div class="seo-answer"><strong>'+e(f(amount))+' grams of '+e(i.name)+' ≈ '+e(f(cups))+' '+(standard==='us'?'US':'metric')+' cups</strong><p>Using '+e(f(i.referenceGrams))+' g per '+e(i.referenceAmount)+' '+e(i.referenceUnit)+' from '+link(i.sourceUrl,i.sourceName)+'. This is a cooking-reference estimate, not a universal grams-to-cups equation.</p></div>'};
}
function numberComparison(amount,exclude=''){const top=data.filter(i=>i.id!==exclude);return table(['Ingredient','US cups for '+amount+' g','Source grams / US cup'],top.map(i=>[i.name,f(convertQuantity(amount,'g','cup',{ingredient:i})),f(convertQuantity(1,'cup','g',{ingredient:i}))+' g']));}
function intro(title,body){return '<div class="container"><div class="page-intro"><span class="eyebrow">Cooking measurement reference</span><h1>'+e(title)+'</h1><p class="lede">'+e(body)+'</p></div></div>';}
const hubList=tools.map(t=>['/cooking/'+t[0]+'/',t[1],t[5]==='ingredient'?'Ingredient-aware conversion':'Fixed US volume units']);
const ingredientList=data.map(i=>['/cooking/ingredients/'+i.id+'/',i.name,i.method]);
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
 '<div class="compare-slider-row"><input id="compare-weight" data-compare-input type="range" min="10" max="500" step="10" value="100" aria-describedby="compare-help">'+
 '<output for="compare-weight" data-compare-grams aria-live="polite">100 g</output></div>'+
 '<div class="compare-presets" role="group" aria-label="Suggested weights">'+
 [50,100,200,250].map(n=>'<button type="button" class="compare-preset" data-compare-preset="'+n+'" aria-pressed="'+String(n===100)+'">'+n+' g</button>').join('')+
 '</div><p class="compare-hint" id="compare-help">Both values use the same weight and US customary cups.</p></div>'+
 link('/cooking/sources-and-methods/','See the measuring method','compare-source-link')+'</div>'+
 '<div class="comparison-stack" aria-label="Ingredient volume comparison">'+
 '<div class="compare-item"><small>ALL-PURPOSE FLOUR</small><div class="compare-food-icon" aria-hidden="true">F</div>'+
 '<strong><output data-compare-flour>'+e(flour100)+'</output><span class="compare-unit">US cups</span></strong>'+
 '<div class="compare-bar-track" aria-hidden="true"><div class="compare-bar-fill" data-compare-flour-bar style="width:100%"></div></div>'+
 '<span>100 g · spoon &amp; level</span></div>'+
 '<div class="compare-item"><small>GRANULATED SUGAR</small><div class="compare-food-icon" aria-hidden="true">S</div>'+
 '<strong><output data-compare-sugar>'+e(sugar100)+'</output><span class="compare-unit">US cups</span></strong>'+
 '<div class="compare-bar-track" aria-hidden="true"><div class="compare-bar-fill" data-compare-sugar-bar style="width:61%"></div></div>'+
 '<span>100 g · level cup</span></div>'+
 '<p class="compare-caption" data-compare-caption>100 g of flour needs more cup space than 100 g of granulated sugar.</p>'+
 '</div></div></section>';
 const hero='<div class="container hero"><div class="hero-grid"><div class="hero-copy">'+
 '<span class="eyebrow">THE EVERYDAY BAKING TOOLKIT</span>'+
 '<h1 class="hero-heading">Grams to cups, <em>without the guesswork.</em></h1>'+
 '<p class="lede">Not every cup weighs the same. Get the conversion that fits <strong>your ingredient</strong>, with a clear weight reference behind every answer.</p>'+
 '<a class="btn btn-primary hero-mobile-cta" href="#converter">Start converting <span aria-hidden="true">↓</span></a>'+
 '<div class="hero-points"><span>24 documented ingredients</span><span>US & metric cups</span><span>Instant local calculations</span></div>'+
 '<div class="hero-story"><div class="hero-story-symbol" aria-hidden="true">½</div><div><b>Measure less. Make more.</b><p>Precise baking starts with the right ingredient and the right cup size.</p><small>Source-backed kitchen math, beautifully simple.</small></div></div>'+
 '</div>'+converterForm({})+'</div></div>';
 const body=hero+strip+
 section('Explore by ingredient','Flour, sugar, butter and more — choose the exact food before converting by volume.',grid(ingredientList.slice(0,8),4),true)+
 comparison+
 section('A little easier in the kitchen','Save time with practical tools for recipe scaling, print-friendly reference charts and measuring fractions.',grid([
 ['/cooking/grams-to-cups/','Grams to cups','Choose an ingredient and instantly find its approximate cup equivalent'],
 ['/cooking/cups-to-grams/','Cups to grams','Bake by weight with more reliable kitchen results'],
 ['/cooking/recipe-scaler/','Recipe scaler','Scale quantities to match the number of people you are feeding'],
 ['/cooking/batch-converter/','Batch converter','Paste multiple ingredients and check the conversions side by side'],
 ['/cooking/charts/','Printable charts','Keep a source-backed reference beside your mixing bowl'],
 ['/cooking/guides/cup-sizes/','US vs metric cups','Understand the difference between cup systems'],
 ['/cooking/','All cooking tools','Browse our full collection of practical converters']
 ]))+
 section('Start with a familiar number','Look up ingredient-by-ingredient conversions without treating every food as flour.',grid(numberList.filter((_,i)=>[2,6,8,10,12,13].includes(i))),true);
 doc({url:'/',title:'Grams to Cups Converter — Accurate Ingredient-Based Cooking Measurements',description:'Convert grams to cups and cups to grams with source-backed ingredient weights, instant live answers, recipe scaler and printable kitchen charts.',body,kind:'WebPage'});
}

function hub(){
 const body=intro('Cooking measurement converters','Every ingredient has its own weight per cup. Explore all conversion directions, 24 ingredient references, popular amounts, printable charts, and practical measurement guides.')+
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
 const description=needsIngredient?'Mass-to-volume results change with food and measuring method. Select flour, sugar, butter or another referenced ingredient.':'These are fixed US kitchen-volume relationships. The ingredient selector matters only when you mix mass and volume units.';
 const body=intro(title+' Converter',description)+
 '<section class="section"><div class="container content-grid"><div>'+converterForm({amount,from,to,heading:title})+
 '<div class="panel mt-3"><h2>How the conversion works</h2><p>'+e(description)+'</p><p>For this preset, '+e(f(amount))+' '+e(unitDescription(from))+' converts to about <strong>'+e(f(value))+' '+e(unitDescription(to))+'</strong> using the shown reference.</p>'+
 (needsIngredient?'<p>For mass-to-volume quantities, this estimate is based on the selected ingredient weight per cup. Scooping method, moisture, processing and cup standard can alter the result.</p>':'<p>For fixed volume units, the defined US customary cup, tablespoon and fluid ounce are enough to calculate the answer without any ingredient density.</p>')+
 '<div class="inline-note">A mass ounce (oz) and a US fluid ounce (fl oz) are different quantities. This tool keeps their units distinct.</div></div></div>'+
 '<aside class="panel side-panel"><h3>Reference values</h3><p>1 US cup = '+e(f(US_CUP_ML))+' mL<br>1 metric cup = '+METRIC_CUP_ML+' mL<br>1 US tbsp = '+e(f(US_TBSP_ML))+' mL<br>1 US cup = 8 US fl oz</p><p>'+link('/cooking/sources-and-methods/','See methods and sources')+'</p></aside></div></section>'+
 section('Related converters','Switch direction or browse a related kitchen measurement.',grid(hubList.filter(x=>x[0]!=='/cooking/'+slug+'/').slice(0,6)),true);
 doc({url:'/cooking/'+slug+'/',title:title+' — Free Cooking Calculator',description:'Convert '+title.toLowerCase()+' with clear US or metric units, documented food weights when needed and a free interactive calculator.',body,bread:[['Cooking','/cooking/'],[title,null]],kind:'WebApplication'});
}
function numberPage(n){
 const answer=answerFor(n);
 const convenientCups=[[1/8,'1/8'],[1/4,'1/4'],[1/3,'1/3'],[1/2,'1/2'],[2/3,'2/3'],[3/4,'3/4'],[1,'1'],[1.5,'1 1/2'],[2,'2'],[3,'3'],[4,'4'],[5,'5'],[6,'6'],[8,'8']];
 const examples=['all-purpose-flour','granulated-sugar','butter','long-grain-rice-dry'].map(id=>{
   const i=byId.get(id), exactCups=convertQuantity(n,'g','cup',{ingredient:i});
   const options=convenientCups.map(([cups,label])=>({cups,label,weight:convertQuantity(cups,'cup','g',{ingredient:i})}));
   const closest=options.sort((a,b)=>Math.abs(a.weight-n)-Math.abs(b.weight-n))[0];
   const difference=closest.weight-n;
   return [i.name,f(exactCups)+' cups',closest.label+' US cup'+(closest.cups>1?'s':''),(Math.abs(difference)<0.0000001?'Exact at reference precision':f(Math.abs(difference))+' g '+(difference>0?'above':'below')+' '+n+' g')];
 });
 const body=intro('How Many Cups Is '+n+' Grams?','The answer depends on the ingredient. Compare common baking foods using documented weights, then choose a different cup standard in the calculator.')+
 '<section class="section"><div class="container content-grid"><div>'+answer.html+converterForm({amount:n,heading:n+' grams to cups'})+
 '<div class="panel mt-3"><h2>'+n+' grams: food-by-food comparison</h2><p>Compare the same '+n+' grams with 24 distinct ingredient weights. A cup of all-purpose flour weighs less than a cup of sugar, so the same mass takes up more space.</p>'+numberComparison(n)+
 '<h2>Closest common cup measures for '+n+' grams</h2><p>The exact cup estimate may not match a measuring cup in your drawer. This table compares four common foods with familiar cup fractions and shows how many grams that convenient measure differs from '+n+' grams. It is not an instruction to round blindly: when the weight matters, use a scale.</p>'+ 
 table(['Ingredient','Calculated US cups','Closest common cup measure','Weight difference'],examples)+
 '<p class="source-chip">All reference weights are linked to '+link(source,'the original published chart')+'. Rounded values are illustrative; results vary by ingredient state and measuring method.</p></div></div>'+
 '<aside class="panel side-panel"><h3>Other common weights</h3><div class="list-links">'+numberValues.filter(x=>x!==n).sort((a,b)=>Math.abs(a-n)-Math.abs(b-n)).slice(0,6).map(x=>link('/cooking/grams-to-cups/'+x+'-grams-to-cups/',x+' g','chip')).join('')+'</div><hr><h3>Ingredient examples</h3>'+link('/cooking/ingredients/all-purpose-flour/','Flour')+link('/cooking/ingredients/granulated-sugar/','Granulated sugar')+link('/cooking/ingredients/butter/','Butter')+
 ((flourNumbers.includes(n)||sugarNumbers.includes(n))?'<hr><h3>Specific weight guides</h3><div class="list-links">'+
 (flourNumbers.includes(n)?link('/cooking/ingredients/all-purpose-flour/'+n+'-grams-to-cups/',n+' g flour','chip'):'')+
 (sugarNumbers.includes(n)?link('/cooking/ingredients/granulated-sugar/'+n+'-grams-to-cups/',n+' g sugar','chip'):'')+'</div>':'')+
 '</aside></div></section>';
 doc({url:'/cooking/grams-to-cups/'+n+'-grams-to-cups/',title:n+' Grams to Cups — 24 Ingredient Comparison',description:'See '+n+' grams in US cups for flour, sugar, butter and 21 more ingredients using documented weights, with a free interactive converter.',body,bread:[['Cooking','/cooking/'],['Grams to cups','/cooking/grams-to-cups/'],[n+' grams',null]],kind:'WebApplication'});
}
function ingredientPage(i){
 const preview=convertQuantity(100,'g','cup',{ingredient:i});
 // Deep ingredient + number pages must have meaningful on-site entry points.
 const popularWeights=i.id==='all-purpose-flour'?flourNumbers:i.id==='granulated-sugar'?sugarNumbers:[];
 const values=[25,50,75,100,125,150,200,250,300,400,500];
 const cupFractions=[[1/8,'1/8 cup'],[1/4,'1/4 cup'],[1/3,'1/3 cup'],[1/2,'1/2 cup'],[2/3,'2/3 cup'],[3/4,'3/4 cup'],[1,'1 cup'],[1.5,'1 1/2 cups'],[2,'2 cups']];
 const body=intro(i.name+': Grams to Cups','Use the correct '+i.state+' reference. This weight belongs to the measuring method shown below; packed, sifted, dry and cooked ingredients are not interchangeable.')+
 '<section class="section"><div class="container content-grid"><div>'+
 '<div class="facts"><div class="fact"><strong>'+e(f(convertQuantity(1,'cup','g',{ingredient:i})))+' g</strong><span>per US cup</span></div><div class="fact"><strong>'+e(f(preview))+' cups</strong><span>per 100 grams</span></div><div class="fact"><strong>'+e(i.method)+'</strong><span>measurement method</span></div></div>'+
 '<div class="mt-3">'+converterForm({amount:100,ingredient:i.id,heading:i.name+' conversion'})+'</div>'+
 '<div class="panel mt-3"><h2>'+e(i.name)+' conversion chart</h2><p>These quantities are calculated from '+e(i.referenceGrams)+' g per '+e(i.referenceAmount)+' '+e(i.referenceUnit)+'. '+e(i.note)+'</p>'+
 table(['Grams','US cups','Metric cups'],values.map(n=>[n+' g',f(convertQuantity(n,'g','cup',{ingredient:i,standard:'us'})),f(convertQuantity(n,'g','cup',{ingredient:i,standard:'metric'}))]))+
 '<h2>'+e(i.name)+': cups to grams</h2><p>For weighing a recipe rather than filling cups, use this reverse chart. The numbers assume the same food state, measuring technique, and US cup standard as the published reference. A metric cup (250 mL) uses a different quantity.</p>'+ 
 table(['US cup amount','Approximate grams','Equivalent metric cups'],cupFractions.map(([cup,label])=>[label,f(convertQuantity(cup,'cup','g',{ingredient:i,standard:'us'}))+' g',f(cup*US_CUP_ML/METRIC_CUP_ML)+' metric cups']))+
 (popularWeights.length?'<h2>Popular '+e(i.name.toLowerCase())+' weights</h2><p>Open a specific weight to compare the exact cup estimate with practical cup fractions using the same referenced ingredient state and method.</p><div class="list-links">'+popularWeights.map(n=>link('/cooking/ingredients/'+i.id+'/'+n+'-grams-to-cups/',n+' g '+i.name,'chip')).join('')+'</div>':'')+
 '<div class="inline-note">These are estimates from the original reference pair, not separate laboratory weighings. For precise baking, weigh ingredients directly in grams when the recipe supplies a mass.</div>'+ 
 '<p class="source-chip">Original published entry: <strong>'+e(i.sourceEntry)+'</strong> · '+link(i.sourceUrl,i.sourceName)+' · reference checked '+e(i.reviewedAt)+'. These cooking reference weights are approximate.</p></div></div>'+
 '<aside class="panel side-panel"><h3>Measurement context</h3><p><b>Food state:</b> '+e(i.state)+'</p><p><b>Method:</b> '+e(i.method)+'</p><p>'+e(i.note)+'</p><div class="inline-note">For repeatable baking, follow the weight written in your recipe and use a scale if available.</div>'+link('/cooking/sources-and-methods/','About the data')+'</aside></div></section>'+
 section('Related ingredients','Compare volume with foods that have different weights per cup.',grid(ingredientList.filter(x=>x[0]!=='/cooking/ingredients/'+i.id+'/').slice(0,6)),true);
 doc({url:'/cooking/ingredients/'+i.id+'/',title:i.name+' Grams to Cups & Weight Chart',description:'Convert '+i.name.toLowerCase()+' between grams and US or metric cups using a cited weight chart, measuring notes and practical quantities.',body,bread:[['Cooking','/cooking/'],[i.name,null]],kind:'WebApplication'});
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
 doc({url:'/cooking/ingredients/'+i.id+'/'+n+'-grams-to-cups/',title:n+' Grams '+i.name+' to Cups — Measured Reference',description:'Convert '+n+' g of '+i.name.toLowerCase()+' to cups using the documented measuring method, compare cup fractions and check the source.',body,bread:[['Cooking','/cooking/'],[i.name,'/cooking/ingredients/'+i.id+'/'],[n+' grams',null]],kind:'WebApplication'});
}
function chartPage(type){
 const chosen=type==='flour'?data.filter(i=>/flour/.test(i.id)):type==='sugar'?data.filter(i=>/sugar/.test(i.id)):data;
 const rows=chosen.map(i=>[i.name,f(convertQuantity(.25,'cup','g',{ingredient:i}))+' g',f(convertQuantity(.5,'cup','g',{ingredient:i}))+' g',f(convertQuantity(1,'cup','g',{ingredient:i}))+' g',i.method]);
 const title=type==='flour'?'Flour Cups to Grams Chart':type==='sugar'?'Sugar Cups to Grams Chart':'Printable Cooking Conversion Chart';
 const body=intro(title,'A print-friendly kitchen reference based on published ingredient weights. Different preparation and packing methods change the result; use the listed method.')+
 '<section class="section"><div class="container"><div class="panel"><h2>Measured US cup portions</h2>'+
 '<p>Find the specific food you use, then print the reference chart or export the visible rows. These values are approximations from the ingredient measurement source.</p>'+
 '<div data-chart><div class="chart-toolbar"><div class="field"><label for="chart-filter">Find an ingredient</label>'+
 '<input id="chart-filter" type="search" data-chart-filter placeholder="Search flour, sugar, butter…" autocomplete="off"></div>'+
 '<div class="chart-tools"><span class="chart-count" role="status" data-chart-count>'+chosen.length+' of '+chosen.length+' ingredients shown</span>'+
 '<button class="btn" type="button" data-chart-download>Download CSV</button></div></div>'+
 '<div data-chart-table>'+table(['Ingredient','1/4 cup','1/2 cup','1 cup','Method'],rows)+'</div>'+
 '<p class="chart-empty" data-chart-empty hidden>No matching ingredients. Try another search.</p></div>'+
 '<p class="source-chip">Source: '+link(source,'King Arthur Baking Ingredient Weight Chart')+'. The listed methods and ingredient states matter.</p>'+
 '<div class="calc-actions"><button class="btn btn-primary" type="button" data-chart-print>Print this chart</button>'+link('/cooking/guides/cup-sizes/','Cup-size guide','btn')+'</div></div></div></section>'+
 section('Other chart formats','Choose a focused chart to reduce confusion.',grid([['/cooking/charts/','All foods','24 source-backed ingredient entries'],['/cooking/charts/flour/','Flour','Compare different flours'],['/cooking/charts/sugar/','Sugar','Compare packing and processing']],3),true);
 doc({url:'/cooking/charts/'+(type?type+'/':''),title,description:'Print a cups to grams chart for '+(type||'24 kitchen ingredients')+' with sourced measurements and ingredient-specific method notes.',body,bread:[['Cooking','/cooking/'],['Charts',type?'/cooking/charts/':null],...(type?[[title,null]]:[])],kind:'WebPage'});
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
 '<small>Examples: 120 g all-purpose flour · ½ cup butter · 2 tbsp honey. “Flour” alone is not specific enough for a reliable weight-to-volume conversion.</small></div>'+
 '<div class="form-grid mt-3"><div class="field"><label for="batch-target">Convert all lines to</label><select id="batch-target" data-batch-target><option value="cup">US cups</option><option value="g">Grams (g)</option></select></div>'+
 '<div class="field"><label for="batch-standard">Cup standard</label><select id="batch-standard" data-batch-standard><option value="us">US · 236.588 mL</option><option value="metric">Metric · 250 mL</option></select></div></div>'+
 '<div class="batch-options"><label class="toggle-option"><input type="checkbox" data-batch-fraction checked> Show familiar cup fractions when exact</label></div>'+
 '<div class="calc-actions"><button class="btn btn-primary" type="button" data-batch-run>Convert list</button><button class="btn" type="button" data-batch-copy>Copy results</button>'+
 '<button class="btn" type="button" data-batch-csv>Download CSV</button><button class="btn btn-ghost" type="button" data-batch-clear>Clear</button></div>'+
 '<p class="error" role="alert" data-batch-error hidden></p><p class="batch-feedback" data-batch-feedback role="status"></p><div class="batch-summary" role="status" data-batch-summary>Results appear below as you type.</div>'+
 '<div class="table-scroll batch-result-table"><table><thead><tr><th scope="col">Original line</th><th scope="col">Conversion / review</th></tr></thead><tbody data-batch-results></tbody></table></div>'+
 '<p class="source-chip">Ingredient weights from '+link(source,'King Arthur Baking’s ingredient weight chart')+'. Original lines are preserved if an ingredient or unit cannot be safely identified. Your text stays in your browser.</p>'+
 '</form></div>'+
 '<div class="panel mt-3"><h2>How the batch converter protects accuracy</h2>'+
 '<p>Every mass-to-volume result depends on the exact ingredient and its original published reference weight. Packed brown sugar differs from loose brown sugar; sifted sugar differs from unsifted. Ambiguous names are flagged instead of silently converted.</p>'+
 '<p>The tool supports fractional quantities, grams, ounces, cups, teaspoons, tablespoons and milliliters. Each row is processed locally; you can export both the converted lines and any review warnings for your recipe notes.</p>'+
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
 '<div class="field full"><label for="recipe-lines">One ingredient per line</label><textarea id="recipe-lines" data-recipe-lines spellcheck="false">200 g all-purpose flour\n1 1/2 cups milk\n2 tbsp honey\n1/4 tsp salt</textarea><small>Start each line with a quantity. Unicode fractions like ½ and 1½ work. Unsupported lines remain unchanged and are flagged for review.</small></div></div>'+
 '<div class="batch-options"><label class="toggle-option"><input type="checkbox" data-recipe-fraction checked> Show common cup fractions when exact (e.g., 2 1/4)</label></div>'+
 '<div class="calc-actions"><button class="btn btn-primary" type="submit">Scale recipe</button><button class="btn" type="button" data-download-csv>Download CSV</button><button class="btn" type="button" data-recipe-print>Print</button></div>'+
 '<p class="error" data-recipe-error role="alert" hidden></p><div class="result recipe-results"><div class="result-label">Scaled ingredient list</div><pre data-recipe-output aria-live="polite"></pre></div></form></div>'+
 '<div class="panel mt-3"><h2>What this scaler does</h2><p>Amounts are multiplied by the new servings divided by the original servings. It preserves unit labels and ingredient text instead of guessing whether two ingredients share a density. Review lines that cannot be parsed safely.</p><p>Cooking time, pan size, rise time, and heat transfer do not necessarily scale in proportion with ingredient amounts. Use your recipe instructions for those decisions.</p></div></div>'+
 '<aside class="panel side-panel"><h3>Also useful</h3>'+link('/cooking/batch-converter/','Batch ingredient converter')+link('/cooking/grams-to-cups/','Grams to cups')+link('/cooking/charts/','Printable conversion chart')+'</aside></div></section>';
 doc({url:'/cooking/recipe-scaler/',title:'Recipe Scaler — Adjust Ingredient Quantities Free',description:'Scale recipe quantities and serving sizes in your browser, preserve ingredient text and export a CSV without accounts or paid APIs.',body,bread:[['Cooking','/cooking/'],['Recipe scaler',null]],kind:'WebApplication'});
}
function halfPage(){
 const body=intro('Half a Measurement Calculator','Find half of a decimal or a kitchen fraction, including 1 1/2 and 3/4, without confusing volume and ingredient weight.')+
 '<section class="section"><div class="container content-grid"><div><form class="calc-card" data-half-form><div class="calc-top"><strong><span class="live-dot"></span>Half a quantity</strong></div><div class="calc-body"><div class="field"><label for="half-quantity">Amount to halve</label><input id="half-quantity" data-half-input type="text" value="3/4" inputmode="decimal"></div><div class="result"><span class="result-label">Half of your amount</span><output class="result-number" data-half-result aria-live="polite">0.375</output></div><p class="error" role="alert" data-half-error hidden></p></div></form>'+
 '<div class="panel mt-3"><h2>Common half-measurements</h2>'+table(['Original quantity','Half'],[['1 cup','1/2 cup'],['3/4 cup','3/8 cup'],['2/3 cup','1/3 cup'],['1/2 cup','1/4 cup'],['1/4 cup','1/8 cup']])+'<p>The calculator halves a number; the same numerical rule applies whether you are measuring grams, cups, or teaspoons.</p></div></div>'+
 '<aside class="panel side-panel"><h3>Measure fractions</h3>'+link('/cooking/guides/measuring-odd-cups/','Odd cup amounts')+link('/cooking/recipe-scaler/','Scale a whole recipe')+'</aside></div></section>';
 doc({url:'/cooking/half-a-measurement/',title:'Half of a Measurement — Fractions Calculator',description:'Calculate half of kitchen fractions such as 3/4, 2/3 and 1 1/2; see a practical table and an interactive fraction calculator.',body,bread:[['Cooking','/cooking/'],['Half a measurement',null]],kind:'WebApplication'});
}
function methodology(){
 const body=intro('Sources, Methods and Measurement Limitations','We make our recipe references transparent. Mass-to-volume estimates require a defined food, state, measuring method and cup standard.')+
 '<section class="section"><div class="container content-grid"><div><div class="panel"><h2>Primary reference</h2><p>'+link(source,'King Arthur Baking Ingredient Weight Chart')+' provides the published ingredient measurement pairs used in our 24-item reference set. We store the original number of grams and the original volume per ingredient, and compute other quantities from those values.</p>'+
 '<h2>How cups are calculated</h2><p>When a source gives a weight per cup, grams-to-cups is grams divided by that weight. For a half-cup or tablespoon source, we first convert its original volume to US milliliters and calculate a per-volume reference ratio.</p>'+
 '<p><strong>US customary cup:</strong> '+US_CUP_ML+' mL. <strong>Metric cup:</strong> '+METRIC_CUP_ML+' mL. <strong>US tablespoon:</strong> '+US_TBSP_ML+' mL. Metric cup baking weights are proportional estimates from US recipe references, not separate experimental measurements.</p>'+
 '<h2>Important limitations</h2><p>Recipe chart weights are not necessarily physical density at a specified temperature. For example, the cited chart assigns 227 g per cup to water while a physical 236.588 mL cup of water weighs about 236.6 g near ordinary room conditions. We explicitly label the former as a recipe-reference value.</p>'+
 '<p>Packed brown sugar, unsifted confectioners sugar, and uncooked rice are distinct states. We do not apply one state’s weight to another. For repeatability, use the weight printed in the original recipe and prefer a scale.</p>'+
 '<h2>Source entries used by this website</h2><p>The table below reproduces the identifying entry names and original measurement pairs used for each ingredient. These are the specific published references, not universal averages across brands or food states.</p>'+ table(['Our ingredient','Original chart entry','Original weight / volume','Measurement condition'],data.map(i=>[i.name,i.sourceEntry,f(i.referenceGrams)+' g / '+f(i.referenceAmount)+' '+(i.referenceUnit==='tablespoon'?'US tablespoon':'US cup'),i.method]))+ '<p class="source-chip">Source checked '+e(data[0].reviewedAt)+': '+link(source,'King Arthur Baking Ingredient Weight Chart')+'. Review the original source when applying measurements to another brand or recipe.</p>'+ '<h2>Corrections and privacy</h2><p>All calculations are local in the browser. We do not collect the recipe lines typed into the scaler. If a reference changes, the source and review date in the data file must be updated with a matching test.</p></div></div>'+
 '<aside class="panel side-panel"><h3>Browse referenced foods</h3>'+data.slice(0,9).map(i=>link('/cooking/ingredients/'+i.id+'/',i.name)).join('')+'</aside></div></section>';
 doc({url:'/cooking/sources-and-methods/',title:'Ingredient Weight Sources and Conversion Methodology',description:'Learn how grams to cups estimates use cited ingredient weights, US and metric cup sizes, measurement states and clear uncertainty notes.',body,bread:[['Cooking','/cooking/'],['Sources and methods',null]]});
}
function infoPage(slug,title,bodyText){
 const body=intro(title,bodyText)+
 '<section class="section"><div class="container"><div class="panel"><h2>Helpful information</h2><p>'+e(bodyText)+'</p><p>Our calculators use cited ingredient weights, local JavaScript calculations and no account system. The source measurements and conversion methodology are disclosed on '+link('/cooking/sources-and-methods/','the methodology page')+'.</p>'+
 (slug==='contact'?'<p>For corrections, use the repository issue tracker: '+link('https://github.com/garrison2025/Grams-to-Cups/issues','Grams-to-Cups GitHub issues')+'. Please do not post private information.</p>':'')+
 (slug==='privacy'?'<p>The conversion inputs and recipe scaler remain in the browser. We do not add analytics, advertising scripts, trackers, logins or cloud storage in this release. A future advertising integration would require updating this policy and any legally required consent controls before it is enabled.</p>':'')+'</div></div></section>';
 doc({url:'/'+slug+'/',title,description:bodyText.slice(0,155),body,bread:[[title,null]]});
}
home();hub();
for(const t of tools)toolPage(t);
halfPage();recipePage();batchPage();
for(const n of numberValues)numberPage(n);
for(const i of data)ingredientPage(i);
for(const n of flourNumbers)ingredientNumberPage(byId.get('all-purpose-flour'),n);
for(const n of sugarNumbers)ingredientNumberPage(byId.get('granulated-sugar'),n);
for(const type of ['','flour','sugar'])chartPage(type);
for(const guide of ['measuring-flour','cup-sizes','measuring-odd-cups'])guidePage(guide);
methodology();
infoPage('about','About Grams & Cups','Grams & Cups is a free, independent kitchen measurement reference that helps home bakers use grams, cups and spoon measurements more carefully.');
infoPage('privacy','Privacy Policy','We aim to minimize data collection. The calculator and recipe scaler are local-first browser tools; there is no account, analytics platform or ad network in the current code.');
infoPage('contact','Contact and Corrections','Found a questionable food weight or broken conversion? Report the exact ingredient, source, and expected result in the public repository issue tracker.');
writeFile('404.html','<!doctype html><html lang="en"><meta charset="utf-8"><meta name="robots" content="noindex"><title>Page not found | Grams & Cups</title><link rel="stylesheet" href="/assets/styles.css"><main class="container section"><h1>Page not found</h1><p>That page does not exist. Try the conversion tools or the ingredient directory.</p>'+link('/cooking/','Browse cooking tools','btn btn-primary')+'</main></html>');
writeFile('favicon.svg','<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#122e27"/><path d="M18 20h28l-4 26H22z" fill="none" stroke="#eaf2ad" stroke-width="4" stroke-linejoin="round"/><path d="M21 29h22M24 38h16" stroke="#f8f7f2" stroke-width="3" stroke-linecap="round"/></svg>');
for(const [src,dst] of [['public/styles.css','assets/styles.css'],['public/app.js','assets/app.js'],['src/core.mjs','assets/core.mjs'],['src/ingredients.json','assets/ingredients.json']]){const out=path.join(dist,dst);fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(path.join(root,src),out);}
if(!publicIndex)writeFile('_headers','/*\n  X-Robots-Tag: noindex\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n');
else writeFile('_headers','/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n  Permissions-Policy: camera=(), microphone=(), geolocation=()\n');
writeFile('robots.txt','User-agent: *\nAllow: /\n'+(publicIndex?'Sitemap: '+origin+'/sitemap.xml\n':''));
if(publicIndex)writeFile('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'+pages.filter(p=>p.indexCandidate).map(p=>'<url><loc>'+e(origin+p.url)+'</loc></url>').join('')+'</urlset>');
writeFile('site-manifest.json',JSON.stringify({origin:origin||null,publicIndex,generatedAt:new Date().toISOString(),pages},null,2));
if(pages.length!==81)throw Error('Expected 81 total pages including the standalone batch tool; found '+pages.length);
console.log('Generated '+pages.length+' static pages ('+pages.filter(p=>p.indexCandidate).length+' index candidates), publish approved='+publicIndex);
