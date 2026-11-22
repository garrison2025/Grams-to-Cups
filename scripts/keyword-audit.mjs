import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {parseSemrushNumber,parseSemrushKD,csvSafeCell} from '../src/seo-evidence.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const input=fs.readFileSync(path.join(root,'research/semrush-us-2300-sample.csv'),'utf8');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'dist/site-manifest.json'),'utf8'));
const index=new Map(manifest.pages.map(page=>[page.url,page]));

function csvRows(text){
 const records=[];let row=[],field='',inQuotes=false;
 for(let i=0;i<text.length;i++){
  const c=text[i];
  if(c==='"'){if(inQuotes&&text[i+1]==='"'){field+='"';i++;}else inQuotes=!inQuotes;}
  else if(!inQuotes&&c===','){row.push(field);field='';}
  else if(!inQuotes&&(c==='\n'||c==='\r')){
   if(c==='\r'&&text[i+1]==='\n')i++;
   row.push(field);field='';
   if(row.some(x=>x!==''))records.push(row);
   row=[];
  }else field+=c;
 }
 if(inQuotes)throw new Error('Unclosed quoted CSV field');
 if(field!==''||row.length){row.push(field);if(row.some(x=>x!==''))records.push(row)}
 return records;
}
const [headers,...records]=csvRows(input);
const required=['competitor','keyword','observed_position_or_serp','estimated_us_keyword_traffic','us_volume','semrush_kd','ranking_url','site_target_suggestion'];
const fields=Object.fromEntries(headers.map((name,i)=>[name,i]));
for(const name of required)assert.ok(name in fields,'Missing field '+name);
assert.equal(records.length,2300,'Semrush sample unexpectedly changed; rerun analysis before publishing SEO changes');
for(const line of records)assert.equal(line.length,headers.length,'Malformed CSV row');
const val=(r,name)=>r[fields[name]];
const csvEscape=csvSafeCell;
const quotedRows=rows=>rows.map(row=>row.map(csvEscape).join(',')).join('\r\n')+'\r\n';
const isMassWeight=x=>/(?:\bgrams?\b|\bgm\b|\b\d+\s*g\b|\bounces?\b|\boz\b|\bpounds?\b|\blb\b|\bkilograms?\b|\bkg\b)/i.test(x);
const num=parseSemrushNumber;
const canonical=url=>url==='/cooking/grams-to-cups/'?'/':url;

function classifyUnmapped(text){
 const q=text.toLowerCase().replace(/[.,]/g,' ').replace(/\s+/g,' ').trim();
 const c=!!q.match(/\bcups?\b/),g=!!q.match(/\b(?:grams?|gm|gr)\b|\b\d+\s*g\b/);
 const tbsp=/\b(?:tablespoons?|tbsp)\b/.test(q),ml=/\b(?:ml|millilit(?:ers?|res?))\b/.test(q);
 const ounces=/\b(?:oz|ounces?|fl oz|fluid ounces?)\b/.test(q);
 const temperature=/\b(?:celsius|fahrenheit|kelvin)\b|\b(?:\d+\s*[cf]\s+(?:to|in|as)\s*[cf])\b/.test(q);
 if(temperature)return {status:'outside_core_scope',reason:'Temperature conversion; deliberately excluded from focused food mass-volume SEO'};
 if(c&&ounces&&!/\bfluid\b|\bfl\b/.test(q))return {status:'ambiguous_oz_intent',reason:'Cup-to-oz can mean mass or US fluid ounces; do not automatically create a landing'};
 if((g||isMassWeight(q))&&ounces&&!c)return {status:'supported_without_target_page',reason:'Mass ounces ↔ grams calculator supports this; independent SEO page not justified in core cluster'};
 if(/\b(?:quarts?|gallons?|liters?|litres?|pints?|pounds?|lb|kilograms?|kg)\b/.test(q))
   return {status:'outside_core_scope',reason:'Other volume or mass conversion cluster beyond core grams ↔ cups'};
 if(c&&ml)return {status:'supported_without_target_page',reason:'Existing calculator supports cups ↔ mL; no dedicated indexed page approved'};
 if(g&&tbsp)return {status:'candidate_existing_page',reason:'Related to grams ↔ tablespoons; review ingredient-dependent intent before manual mapping'};
 if(c&&tbsp)return {status:'candidate_existing_page',reason:'Related to cups ↔ tablespoons; direction needs manual verification'};
 if(c&&!g)return {status:'needs_intent_review',reason:'Cup measurement query lacking a clear ingredient or grams conversion'};
 if(g&&!c)return {status:'needs_intent_review',reason:'Mass measurement query without enough evidence for this core landing'};
 return {status:'outside_or_unclear',reason:'Not safely attributable to the scoped grams ↔ cups keyword clusters'};
}

const reviewHeader=['competitor','keyword','position_raw','us_volume','kd','sample_keyword_traffic','ranking_url','original_suggested_url','consolidated_target','page_index_eligible','decision','decision_reason'];
const detailed=[reviewHeader],stats={records:records.length,sourceCounts:{},uniqueTerms:0,initiallyUnmapped:0,primaryTargetConsolidated:0,decisions:{},indexCandidates:manifest.pages.filter(p=>p.indexCandidate).length};
const uniqueTerms=new Set(),grouped=new Map(),outOfScope=[];
for(const row of records){
 const competitor=val(row,'competitor'),keyword=val(row,'keyword'),suggested=val(row,'site_target_suggestion').trim();
 stats.sourceCounts[competitor]=(stats.sourceCounts[competitor]||0)+1;
 uniqueTerms.add(keyword.toLowerCase().trim());
 let target=suggested?canonical(suggested):'';
 let decision,reason,eligible='';
 if(suggested==='/cooking/grams-to-cups/')stats.primaryTargetConsolidated++;
 if(suggested){
  assert.ok(index.has(target),'Suggested URL not in generated website: '+target);
  eligible=index.get(target).indexCandidate?'yes':'no';
  if(eligible==='yes'){decision='heuristic_mapped_needs_review';reason=target==='/'?'Primary keyword assigned to homepage, avoiding duplicate tool landing':'Provisional matching URL; verify exact search intent and uniqueness';}
  else{decision='usable_page_noindex';reason='Working tool or page does not have independent SEO approval';}
 }else{
  stats.initiallyUnmapped++;
  const unclassified=classifyUnmapped(keyword);decision=unclassified.status;reason=unclassified.reason;
 }
 stats.decisions[decision]=(stats.decisions[decision]||0)+1;
 const kd=parseSemrushKD(val(row,'semrush_kd')),traffic=num(val(row,'estimated_us_keyword_traffic')),vol=num(val(row,'us_volume'));
 if(target){
  const group=grouped.get(target)||{rows:0,unique:new Set(),lowKdRows:0,trafficSampleSum:0,candidates:[]};
  group.rows++;group.unique.add(keyword.toLowerCase().trim());
  if(kd!==null&&kd<=29)group.lowKdRows++;
  if(traffic!==null)group.trafficSampleSum+=traffic;
  group.candidates.push({kw:keyword,kd,vol,traffic,competitor});
  grouped.set(target,group);
 }else{outOfScope.push({kw:keyword,decision,traffic,vol,kd,competitor})}
 detailed.push([competitor,keyword,val(row,'observed_position_or_serp'),val(row,'us_volume'),val(row,'semrush_kd'),val(row,'estimated_us_keyword_traffic'),val(row,'ranking_url'),suggested,target,eligible,decision,reason]);
}
stats.uniqueTerms=uniqueTerms.size;
const pageHeader=['url','index_candidate','keyword_rows_mapped','distinct_sample_keywords','kd_le29_rows','sum_of_sample_traffic_NOT_SITE_TRAFFIC','top_sample_keyword','top_keyword_us_volume','top_keyword_kd','top_keyword_competitor','evidence_status'];
const pageReport=[pageHeader];
for(const page of manifest.pages){
 const group=grouped.get(page.url);
 const best=group?.candidates.slice().sort((a,b)=>(b.traffic??-1)-(a.traffic??-1))[0];
 pageReport.push([page.url,page.indexCandidate?'yes':'no',group?.rows||0,group?.unique.size||0,group?.lowKdRows||0,group?.trafficSampleSum||0,best?.kw||'',best?.vol??'',best?.kd??'',best?.competitor||'',!page.indexCandidate?'noindex_tool_or_unverified_page':group?'has_provisional_keyword_evidence':'no_sample_mapping_do_not_infer_zero_demand']);
}
assert.equal(stats.records,2300);
assert.equal(stats.indexCandidates,62,'Editorial production index decisions unexpectedly changed');
const targetUrl=pageReport.find(x=>x[0]==='/');
assert.ok(targetUrl&&targetUrl[2]>0,'Core keyword must link to homepage');
assert.ok(!index.get('/cooking/grams-to-cups/').indexCandidate,'Duplicate core converter URL must remain noindex');

// Strict numerical page evidence: a separate SEO landing is justified by a real
// observed numeric search phrase, never solely by being able to generate a URL.
const numericReport=[['grams','target_url','observed_keyword_rows','unique_search_phrases','minimum_semrush_kd','sample_traffic_rows_sum_not_site_traffic','index_candidate','decision','strongest_sample_keyword']];
for(const page of manifest.pages.filter(p=>/^\/cooking\/grams-to-cups\/\d+-grams-to-cups\/$/.test(p.url))){
 const amount=Number(page.url.match(/\/(\d+)-grams-to-cups\/$/)[1]);
 const numericPattern=new RegExp('\\b'+amount+'\\s*(?:grams?|g)\\s*(?:(?:to|in|into)\\s*)?(?:a\\s*)?cups?\\b','i');
 const matched=records.filter(row=>numericPattern.test(val(row,'keyword')));
 const kd=matched.map(row=>parseSemrushKD(val(row,'semrush_kd'))).filter(x=>x!==null);
 const minKd=kd.length?Math.min(...kd):null;
 const traffic=matched.reduce((sum,row)=>sum+(num(val(row,'estimated_us_keyword_traffic'))||0),0);
 const unique=new Set(matched.map(row=>val(row,'keyword').toLowerCase().trim())).size;
 assert.ok(matched.length>0,'Numeric page has no directly observed competitor keyword: '+page.url);
 const decision=minKd!==null&&minKd<=29?'observed_low_kd_candidate':'observed_but_not_low_kd_keep_unindexed';
 if(decision==='observed_but_not_low_kd_keep_unindexed')assert.equal(page.indexCandidate,false,'Unverified high-KD numeric page cannot auto-index: '+page.url);
 else assert.equal(page.indexCandidate,true,'Observed low-KD numeric route should be eligible: '+page.url);
 const strongest=matched.slice().sort((a,b)=>(num(val(b,'estimated_us_keyword_traffic'))||0)-(num(val(a,'estimated_us_keyword_traffic'))||0))[0];
 numericReport.push([amount,page.url,matched.length,unique,minKd??'',traffic,page.indexCandidate?'yes':'no',decision,val(strongest,'keyword')]);
}
assert.equal(numericReport.length,22,'Expected 21 tested numeric SEO candidates');


// Secondary ingredient-intent evidence complements, but never rewrites, the original
// Semrush-to-target suggestions. Exact food identifiers protect against matching
// peanut butter as dairy butter, cooked rice as dry rice, or loose as packed sugar.
const foodRules=[
 ['butter',/\bbutter\b/i,/\b(?:peanut|almond|cashew|sunflower|cocoa|cookie|nut)\s+butter\b/i],
 ['sour-cream',/\bsour cream\b/i,null],
 ['cream-cheese',/\bcream cheese\b/i,null],
 ['coconut-oil',/\bcoconut oil\b/i,null],
 ['granulated-sugar',/\b(?:granulated (?:white )?sugar|white granulated sugar)\b/i,null],
 ['whole-wheat-flour',/\bwhole[\s-]wheat flour\b/i,null],
 ['almond-flour',/\btoasted almond flour\b/i,null],
 ['brown-sugar-packed',/\b(?:packed brown sugar|brown sugar(?:\s*,)?\s*packed)\b/i,null],
 ['powdered-sugar-unsifted',/\b(?:unsifted (?:powdered|icing|confectioners'?|confectioner's) sugar|confectioners'? sugar unsifted)\b/i,null],
 ['rolled-oats',/\b(?:rolled oats|old[\s-]fashioned oats|quick[\s-]cooking oats)\b/i,null],
 ['long-grain-rice-dry',/\b(?:dry long[\s-]grain rice|uncooked long[\s-]grain rice)\b/i,null],
 ['milk-fresh',/\bfresh milk\b/i,null],
 ['honey',/\bhoney\b/i,null],
 ['olive-oil',/\bolive oil\b/i,null],
 ['vegetable-oil',/\bvegetable oil\b/i,null],
 ['cornstarch',/\bcornstarch\b/i,null],
 ['coconut-flour',/\bcoconut flour\b/i,null],
 ['gluten-free-flour',/\bgluten[\s-]free (?:all[\s-]purpose )?flour\b/i,null],
 ['pumpkin-puree',/\bpumpkin pur[eé]e\b/i,null],
 ['walnuts-chopped',/\bchopped walnuts\b/i,null],
 ['maple-syrup',/\bmaple syrup\b/i,null]
];
const unitIntent=/\b(?:cup|cups|grams?|g|gm|oz|ounces?|tbsp|tablespoons?|tsp|teaspoons?|ml|milliliters?|millilitres?)\b/i;
const excludeIntent=/\b(?:substitute|substitution|replacement|calorie|calories|nutrition|health|benefits|recipe ideas|storage)\b/i;
const secondaryHeader=['food_url','ingredient_id','keyword','competitor','us_volume','semrush_kd','sample_keyword_traffic','original_site_target','status'];
const secondaryRows=[secondaryHeader],foodEvidence=new Map();
for(const [id,match,exclude] of foodRules){
 const target='/cooking/ingredients/'+id+'/';
 assert.ok(index.has(target),'Food evidence target is absent: '+target);
 const matches=records.filter(row=>{
  const keyword=val(row,'keyword');
  return match.test(keyword)&&unitIntent.test(keyword)&&!excludeIntent.test(keyword)&&!(exclude&&exclude.test(keyword));
 });
 const unique=new Set(matches.map(row=>val(row,'keyword').toLowerCase().trim()));
 const low=matches.filter(row=>{const kd=parseSemrushKD(val(row,'semrush_kd'));return kd!==null&&kd<=29});
 foodEvidence.set(target,{count:matches.length,distinct:unique.size,lowKd:low.length,
  strongest:matches.slice().sort((a,b)=>(num(val(b,'estimated_us_keyword_traffic'))||0)-(num(val(a,'estimated_us_keyword_traffic'))||0))[0]});
 for(const row of matches)secondaryRows.push([target,id,val(row,'keyword'),val(row,'competitor'),
 val(row,'us_volume'),val(row,'semrush_kd'),val(row,'estimated_us_keyword_traffic'),
 val(row,'site_target_suggestion'),'secondary_exact_food_intent_review_required']);
}
pageReport[0].push('secondary_food_keyword_rows','secondary_food_distinct_phrases','secondary_food_kd_le29_rows','secondary_food_top_keyword');
for(const row of pageReport.slice(1)){
 const food=foodEvidence.get(row[0]);
 row.push(food?.count||0,food?.distinct||0,food?.lowKd||0,food?.strongest?val(food.strongest,'keyword'):'');
 if(row[10]==='no_sample_mapping_do_not_infer_zero_demand'&&food?.count)
  row[10]='secondary_food_intent_found_not_automatically_verified';
}
const secondaryFoodCount=[...foodEvidence.values()].filter(x=>x.count>0).length;

const out=path.join(root,'reports');
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'seo-keyword-decisions.csv'),'\ufeff'+quotedRows(detailed));
const keywordToUrl=[['keyword','competitor','source_observed_position','source_us_volume','source_kd',
 'source_keyword_traffic_not_our_site','competitor_ranking_url','original_heuristic_url',
 'provisional_target_url_not_verified_rank','target_index_eligible','status','evidence_limitations'],
 ...detailed.slice(1).map(x=>[x[1],x[0],x[2],x[3],x[4],x[5],x[6],x[7],x[8],x[9],x[10],x[11]])];
assert.equal(keywordToUrl.length,2301,'A source-true keyword-to-URL ledger must contain all 2300 rows');
fs.writeFileSync(path.join(out,'keyword-to-url.csv'),'\ufeff'+quotedRows(keywordToUrl));
fs.writeFileSync(path.join(out,'seo-page-evidence.csv'),'\ufeff'+quotedRows(pageReport));
fs.writeFileSync(path.join(out,'seo-numeric-intent.csv'),'\ufeff'+quotedRows(numericReport));
fs.writeFileSync(path.join(out,'seo-ingredient-intent.csv'),'\ufeff'+quotedRows(secondaryRows));
fs.writeFileSync(path.join(out,'seo-summary.json'),JSON.stringify({...stats,mappedPageCount:grouped.size,pagesMissingMapping:pageReport.slice(1).filter(x=>x[1]==='yes'&&Number(x[2])===0).length,secondaryFoodPagesObserved:secondaryFoodCount,pagesMissingBothPrimaryAndSecondary:pageReport.slice(1).filter(x=>x[1]==='yes'&&Number(x[2])===0&&Number(x[11])===0).length},null,2)+'\n');
console.log('SEO evidence audit passed:',stats.records,'source keyword observations,',stats.uniqueTerms,'distinct phrases,',stats.indexCandidates,'index candidates.');
console.log('Keyword review decisions:',JSON.stringify(stats.decisions));
console.log('Numerical keyword evidence:',numericReport.length-1,'validated pages; low-KD eligible:',numericReport.slice(1).filter(x=>x[6]==='yes').length);
const uncovered=pageReport.slice(1).filter(x=>x[1]==='yes'&&Number(x[2])===0).map(x=>x[0]);
console.log('Index candidates without mapping evidence in submitted export:',uncovered.length,JSON.stringify(uncovered.slice(0,30)));
console.log('Secondary ingredient intent evidence: '+secondaryFoodCount+' food pages with observed matching unit queries; editorial verification still required.');
const additionalObserved=pageReport.slice(1).filter(row=>row[1]==='yes'&&Number(row[2])===0&&Number(row[11])>0);
console.log('Previously unmapped index candidates with secondary exact food evidence:',additionalObserved.length,JSON.stringify(additionalObserved.map(row=>({url:row[0],rows:row[11],lowKd:row[13]}))));
console.log('Reports written to reports/ (not included in the public site build).');
