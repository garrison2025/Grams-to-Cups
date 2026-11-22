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
  mapped,secondary,evidenceClass,decision]);
 // Even when a candidate is usable but noindex, never turn a simulated
 // Semrush primary keyword volume into permission to index or redirect.
 assert.equal(primaryRoute,item.url==='/cooking/grams-to-cups/'?'/':item.url);
}
const unexpected=manifest.pages.filter(p=>!candidates.some(c=>c.url===p.url)).map(p=>p.url).sort();
assert.deepEqual(unexpected,['/','/about/','/contact/','/cooking/batch-converter/','/privacy/'].sort(),
 'Unexpected routes outside the original Appendix A candidate list');
assert.equal(count.indexCandidates+count.noindexSupport,76);
const reportPath=path.join(root,'reports');
fs.mkdirSync(reportPath,{recursive:true});
fs.writeFileSync(path.join(reportPath,'seo-76-candidate-decisions.csv'),'\ufeff'+output.map(r=>r.map(csvSafeCell).join(',')).join('\r\n')+'\r\n');
fs.writeFileSync(path.join(reportPath,'seo-76-candidate-summary.json'),JSON.stringify({
 source:baseline.source,partialSampleNotFullDomainCoverage:true,
 ...count,additionalSiteRoutes:unexpected,
 note:'All 76 planned cooking candidates exist as working URLs. Index eligibility is a code policy, not confirmed Google indexing or editorial keyword approval. Missing sample evidence is unknown, not zero.'
},null,2)+'\n');
console.log('Appendix A reconciliation passed:',count.candidateCount,'planned routes,',count.indexCandidates,
 'index candidates,',count.noindexSupport,'noindex support routes,',unexpected.length,'additional routes.');
console.log('Evidence classes:',JSON.stringify({primarySampleMapped:count.primarySampleMapped,
 secondaryOnlyMapped:count.secondaryOnlyMapped,planOnlyEstimate:count.planOnlyEstimate,
 withoutKeywordObservation:count.withoutKeywordObservation}));
