/**
 * Reconcile every one of the original 76 Appendix A URL candidates with the
 * actual generated site and the partial Semrush evidence. This is an audit,
 * not a page factory or automatic permission to publish programmatic pages.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {csvSafeCell} from '../src/seo-evidence.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(file)=>fs.readFileSync(path.join(root,file),'utf8');
const baseline=JSON.parse(read('research/seo-76-candidate-baseline.json'));
const manifest=JSON.parse(read('dist/site-manifest.json'));
const index=new Map(manifest.pages.map(p=>[p.url,p]));
const candidates=baseline.candidates;

function parseCSV(source){
 const text=source.replace(/^\ufeff/,'');
 const rows=[];let row=[],cell='',inside=false;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){
   if(inside&&text[i+1]==='"'){cell+='"';i++;}
   else inside=!inside;
  }else if(ch===','&&!inside){row.push(cell);cell='';}
  else if((ch==='\r'||ch==='\n')&&!inside){
   if(ch==='\r'&&text[i+1]==='\n')i++;
   row.push(cell);cell='';
   if(row.some(Boolean))rows.push(row);
   row=[];
  }else cell+=ch;
 }
 assert.equal(inside,false,'Unclosed quote in generated page evidence CSV');
 if(cell||row.length){row.push(cell);if(row.some(Boolean))rows.push(row);}
 return rows;
}

assert.equal(candidates.length,76,'Source appendix has exactly 76 candidates');
assert.equal(manifest.pages.length,81,'Unexpected current site size');
assert.equal(new Set(candidates.map(x=>x.url)).size,76,'Duplicate planned URLs');
assert.deepEqual(candidates.map(x=>x.id),Array.from({length:76},(_,i)=>i+1),'Original candidate order changed');
const families={Hub:1,Tool:13,Number:21,Ingredient:24,'Ingredient × Number':10,Guide:6,Methodology:1};
for(const [name,expected] of Object.entries(families))
 assert.equal(candidates.filter(c=>c.family===name).length,expected,'Incorrect Appendix A family '+name);

const [header,...evidence]=parseCSV(read('reports/seo-page-evidence.csv'));
const ix=name=>{const i=header.indexOf(name);assert.ok(i!==-1,'Missing page SEO column '+name);return i;};
const urlIx=ix('url'),mappedIx=ix('keyword_rows_mapped'),secondaryIx=ix('secondary_food_keyword_rows');
const evidenceByUrl=new Map(evidence.map(row=>[row[urlIx],row]));
assert.equal(evidenceByUrl.size,81,'SEO evidence report must include every generated page');
const output=[[
 'plan_id','family','planned_url','primary_keyword','plan_us_search_volume','plan_primary_kd',
 'plan_competitor_count','route_exists','eligible_for_production_index','canonical_target_if_published',
 'partial_sample_keyword_rows_mapped','secondary_exact_ingredient_intent_rows',
 'source_sample_ranking_evidence','source_screenshot_page_evidence','source_release_condition',
 'evidence_class','editorial_decision'
]];
const count={candidateCount:76,indexCandidates:0,noindexSupport:0,
 primarySampleMapped:0,secondaryOnlyMapped:0,planOnlyEstimate:0,withoutKeywordObservation:0};
for(const item of candidates){
 assert.ok(item.url.startsWith('/')&&item.url.endsWith('/'),'Invalid planned URL '+item.id);
 assert.equal(typeof item.primaryKeyword,'string');
 for(const k of ['primaryUSVolume','primaryKD']){
  assert.ok(item[k]===null||(Number.isInteger(item[k])&&item[k]>=0),'Unverified metric should be null: '+item.id+' '+k);
 }
 assert.ok(Number.isInteger(item.observedCompetitorCount)&&item.observedCompetitorCount>=0);
 for(const field of ['sampleRankingEvidence','screenshotPageEvidence','sourceDisposition'])
  assert.ok(typeof item[field]==='string'&&item[field].length>0,'Original Appendix A evidence missing: '+item.id+' '+field);
 if(item.observedCompetitorCount===0)
  assert.equal(item.sampleRankingEvidence,'无精确主词排名','No claimed ranking when source competitor count is zero');
 const page=index.get(item.url);
 assert.ok(page,'Appendix A route missing: #'+item.id+' '+item.url);
 const observed=evidenceByUrl.get(item.url);
 assert.ok(observed,'No evidence report row for '+item.url);
 const mapped=Number(observed[mappedIx]),secondary=Number(observed[secondaryIx]);
 assert.ok(Number.isInteger(mapped)&&mapped>=0&&Number.isInteger(secondary)&&secondary>=0);
 const eligible=!!page.indexCandidate;
 const primaryRoute=item.url==='/cooking/grams-to-cups/'?'/':item.url;
 const canonical=eligible?item.url:item.url==='/cooking/grams-to-cups/'?'/':'';
 const evidenceClass=mapped>0?'mapped_keyword_sample_heuristic':
   secondary>0?'strict_secondary_food_sample_review':
   item.primaryUSVolume!==null?'plan_primary_keyword_estimate_only':
   'no_matching_keyword_in_partial_sample';
 let decision;
 if(item.url==='/cooking/grams-to-cups/'){
  assert.equal(eligible,false,'Homepage must be sole core grams-to-cups canonical');
  assert.ok(index.get('/').indexCandidate,'Primary homepage is not index eligible');
  decision='functional_page_noindex_primary_keyword_consolidated_to_home';
 }else if(item.url==='/cooking/grams-to-cups/1000-grams-to-cups/'){
  assert.equal(eligible,false,'KD37 1000g must not auto-index');
  decision='functional_page_noindex_unqualified_numeric_keyword';
 }else if(!eligible)decision='functional_support_page_noindex';
 else decision='candidate_for_index_pending_editorial_review_not_verified_ranking';
 if(eligible)count.indexCandidates++;else count.noindexSupport++;
 if(mapped>0)count.primarySampleMapped++;
 else if(secondary>0)count.secondaryOnlyMapped++;
 else if(item.primaryUSVolume!==null)count.planOnlyEstimate++;
 else count.withoutKeywordObservation++;
 output.push([item.id,item.family,item.url,item.primaryKeyword,item.primaryUSVolume??'',
  item.primaryKD??'',item.observedCompetitorCount,'yes',eligible?'yes':'no',canonical,
  mapped,secondary,item.sampleRankingEvidence,item.screenshotPageEvidence,
  item.sourceDisposition,evidenceClass,decision]);
 // Even when a candidate is usable but noindex, never turn a simulated
 // Semrush primary keyword volume into permission to index or redirect.
 assert.equal(primaryRoute,item.url==='/cooking/grams-to-cups/'?'/':item.url);
}
// These are not 21 failed pages. They are the index-eligible routes that have
// neither a provisional keyword target nor a strict secondary ingredient match
// in the imported partial Semrush export. Preserve independent screenshot/page
// evidence and separate navigational trust pages from SEO acquisition targets.
const trustPages=new Set(['/','/cooking/','/cooking/sources-and-methods/','/about/','/privacy/','/contact/']);
const reviewHeader=['url','role','plan_id','primary_keyword','source_primary_volume','source_primary_kd',
 'source_ranking_evidence','source_competitor_page_screenshot','index_candidate',
 'independent_page_feature','review_bucket','editorial_next_check'];
const indexGapReview=[reviewHeader];
const reviewBuckets={};
for(const page of manifest.pages){
 if(!page.indexCandidate)continue;
 const report=evidenceByUrl.get(page.url);
 assert.ok(report,'Missing page evidence for '+page.url);
 if(Number(report[mappedIx])!==0||Number(report[secondaryIx])!==0)continue;
 const candidate=candidates.find(c=>c.url===page.url);
 const isTrust=trustPages.has(page.url);
 const screenshot=candidate?.screenshotPageEvidence||'';
 const observedScreenshot=!!screenshot&&screenshot!=='未在截图中单独识别';
 let role=isTrust?'navigation_or_trust':candidate?.family==='Ingredient'?'source_backed_ingredient':
  candidate?.family==='Guide'?'measuring_chart_or_guide':'functional_calculator';
 const html=read('dist/'+(page.url==='/'?'index.html':page.url.slice(1)+'index.html'));
 const feature=/<table(?:\s|>)/i.test(html)?'readable_reference_table':
  /data-calc(?:\s|>)/.test(html)?'interactive_conversion_form':
  /data-chart/.test(html)?'interactive_chart':
  /data-batch/.test(html)?'interactive_batch_tool':'navigational_or_explanatory_content';
 const highKd=candidate?.primaryKD!==null&&candidate?.primaryKD!==undefined&&candidate.primaryKD>29;
 const bucket=isTrust?'trust_or_navigation_does_not_require_sample_keyword':
  highKd?'high_primary_kd_without_low_kd_sample_support':
  observedScreenshot?'competitor_page_seen_keyword_gap':
  'no_direct_or_source_screenshot_keyword_evidence';
 const check=isTrust?'Check accuracy, useful navigation and non-duplicated trust content; not a traffic keyword proof':
  highKd?'Find a genuinely relevant KD<=29 search intent or retain as a functional noindex support page':
  observedScreenshot?'Compare actual competitor page intent, useful functions and original content before editorial index approval':
  'Verify page-level demand and unique intent; keep functionality without assuming Google ranking potential';
 reviewBuckets[bucket]=(reviewBuckets[bucket]||0)+1;
 indexGapReview.push([page.url,role,candidate?.id||'',candidate?.primaryKeyword||'',
  candidate?.primaryUSVolume??'',candidate?.primaryKD??'',
  candidate?.sampleRankingEvidence||'',screenshot,page.indexCandidate?'yes':'no',
  feature,bucket,check]);
}
assert.equal(indexGapReview.length-1,21,'Expected 21 source-evidence review cases: check changes before approving index policy');
// This public-source-only line makes the 21 review cases traceable without downloading private CI artifacts.
console.log('SEO_PENDING_21_START');
for(const row of indexGapReview.slice(1))console.log(JSON.stringify({url:row[0],role:row[1],planId:row[2],keyword:row[3],volume:row[4],kd:row[5],screenshot:row[7],feature:row[9],bucket:row[10]}));
console.log('SEO_PENDING_21_END');

const unexpected=manifest.pages.filter(p=>!candidates.some(c=>c.url===p.url)).map(p=>p.url).sort();
assert.deepEqual(unexpected,['/','/about/','/contact/','/cooking/batch-converter/','/privacy/'].sort(),
 'Unexpected routes outside the original Appendix A candidate list');
assert.equal(count.indexCandidates+count.noindexSupport,76);
const reportPath=path.join(root,'reports');
fs.mkdirSync(reportPath,{recursive:true});
fs.writeFileSync(path.join(reportPath,'seo-76-candidate-decisions.csv'),'\ufeff'+output.map(r=>r.map(csvSafeCell).join(',')).join('\r\n')+'\r\n');
fs.writeFileSync(path.join(reportPath,'seo-21-index-review.csv'),'\ufeff'+indexGapReview.map(r=>r.map(csvSafeCell).join(',')).join('\r\n')+'\r\n');
fs.writeFileSync(path.join(reportPath,'seo-21-index-review-summary.json'),JSON.stringify({
 candidateCount:indexGapReview.length-1,reviewBuckets,
 note:'Neither a missing keyword mapping nor source screenshot absence proves zero demand. These are publication-editorial checklists, not confirmed search rankings or evidence of successful indexing.'
},null,2)+'\n');
fs.writeFileSync(path.join(reportPath,'seo-76-candidate-summary.json'),JSON.stringify({
 source:baseline.source,partialSampleNotFullDomainCoverage:true,
 ...count,additionalSiteRoutes:unexpected,
 note:'All 76 planned cooking candidates exist as working URLs. Index eligibility is a code policy, not confirmed Google indexing or editorial keyword approval. Missing sample evidence is unknown, not zero.'
},null,2)+'\n');
console.log('Appendix A reconciliation passed:',count.candidateCount,'planned routes,',count.indexCandidates,
 'index candidates,',count.noindexSupport,'noindex support routes,',unexpected.length,'additional routes.');
console.log('21 unresolved index-candidate editorial review buckets:',JSON.stringify(reviewBuckets));
console.log('Evidence classes:',JSON.stringify({primarySampleMapped:count.primarySampleMapped,
 secondaryOnlyMapped:count.secondaryOnlyMapped,planOnlyEstimate:count.planOnlyEstimate,
 withoutKeywordObservation:count.withoutKeywordObservation}));
