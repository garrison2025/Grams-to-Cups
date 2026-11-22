/**
 * Lighthouse mobile lab verification for local PR preview and (later) live HTTPS.
 * Requires ephemeral lighthouse CLI 13.6.0, installed only in CI, not shipped.
 * npm run build is run by the workflow before local preview measurement.
 * A lab run is not real-user INP or a Search Console indexing check.
 */
import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const raw=(process.env.LIGHTHOUSE_SITE_URL||'').trim();
const real=!!raw;
if(real&&!/^https:\/\/[a-z0-9.-]+\/?$/i.test(raw))
 throw new Error('Lighthouse production input must be an exact HTTPS hostname without path, port, query or fragment.');
const origin=real?raw.replace(/\/$/,''):'http://127.0.0.1:4173';
if(real){
 const host=new URL(origin).hostname;
 if(host==='localhost'||host==='example.com'||host==='convertunits.cc'||
    host.endsWith('.convertunits.cc')||
    /\.(?:localhost|test|example|invalid|internal)$/.test(host))
  throw new Error('Refusing to audit a placeholder or another project as Grams-to-Cups production.');
}
const expectedPublic=(process.env.LIGHTHOUSE_EXPECT_PUBLIC||'false')==='true';
if(!real&&expectedPublic)throw new Error('Cannot verify production indexability from an unindexed local preview.');
const routes=real?
 ['/','/cooking/ingredients/all-purpose-flour/','/cooking/grams-to-cups/100-grams-to-cups/','/cooking/charts/']:
 ['/','/cooking/ingredients/all-purpose-flour/','/cooking/half-a-measurement/'];
const outputDir=path.join(root,'reports','lighthouse');
fs.mkdirSync(outputDir,{recursive:true});
const results=[];
const categories=expectedPublic?'performance,accessibility,best-practices,seo':'performance,accessibility,best-practices';
for(let i=0;i<routes.length;i++){
 const route=routes[i];
 const file=path.join(outputDir,'mobile-'+String(i+1).padStart(2,'0')+'.json');
 const url=origin+route;
 const flags=[
  url,'--quiet','--only-categories='+categories,'--output=json','--output-path='+file,
  '--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage',
  '--no-enable-error-reporting','--max-wait-for-load=60000'
 ];
 const run=spawnSync('lighthouse',flags,{stdio:'inherit',timeout:180000});
 if(run.error)throw run.error;
 assert.equal(run.status,0,'Lighthouse CLI failed for '+url);
 const rawResult=JSON.parse(fs.readFileSync(file,'utf8'));
 if(rawResult.runtimeError)throw new Error('Lighthouse runtime error '+url+': '+rawResult.runtimeError.message);
 const score=c=>rawResult.categories[c]?.score===undefined?null:
  Math.round(rawResult.categories[c].score*100);
 const lcp=rawResult.audits['largest-contentful-paint']?.numericValue;
 const cls=rawResult.audits['cumulative-layout-shift']?.numericValue;
 const failedAudits=category=>(rawResult.categories[category]?.auditRefs||[])
  .filter(ref=>ref.weight>0&&rawResult.audits[ref.id]?.score!==null&&rawResult.audits[ref.id]?.score<1)
  .map(ref=>({id:ref.id,title:rawResult.audits[ref.id].title,
   score:rawResult.audits[ref.id].score,
   display:rawResult.audits[ref.id].displayValue||null,
   weight:ref.weight}))
  .sort((a,b)=>a.score-b.score||b.weight-a.weight)
  .slice(0,10);
 const row={
  route,url,performance:score('performance'),accessibility:score('accessibility'),
  bestPractices:score('best-practices'),seo:score('seo'),
  labLcpMs:Number.isFinite(lcp)?Math.round(lcp):null,
  labCls:Number.isFinite(cls)?Number(cls.toFixed(4)):null,
  labFcpMs:Math.round(rawResult.audits['first-contentful-paint']?.numericValue||0),
  labTbtMs:Math.round(rawResult.audits['total-blocking-time']?.numericValue||0),
  labSpeedIndexMs:Math.round(rawResult.audits['speed-index']?.numericValue||0),
  failingPerformanceAudits:failedAudits('performance'),
  failingAccessibilityAudits:failedAudits('accessibility'),
  contrastNodes:(rawResult.audits['color-contrast']?.details?.items||[]).slice(0,10).map(x=>({
   snippet:x.node?.snippet||null,selector:x.node?.selector||null,
   label:x.node?.nodeLabel||null,reason:x.explanation||null
  })),
  topLongTasks:(rawResult.audits['long-tasks']?.details?.items||[]).slice(0,6).map(x=>({
   duration:x.duration||null,startTime:x.startTime||null,
   url:x.url||null
  })),
  lighthouseVersion:rawResult.lighthouseVersion,
  reportFile:path.relative(root,file),
  statusCode:rawResult.audits['http-status-code']?.displayValue||null
 };
 results.push(row);
 console.log('LIGHTHOUSE MOBILE',JSON.stringify(row));
}
const summary={
 mode:!real?'local_preview_noindex':expectedPublic?'public_host':'unindexed_live_host',
 publicHostConfirmed:real&&expectedPublic,
 note:'Lab Lighthouse estimates, not real-user Core Web Vitals or observed INP. Preview noindex intentionally excludes SEO score; a real-host score requires an actual HTTPS deployment.',
 results,
 publicationTargets:{accessibility:95,seo:95,labLcpMs:2500,labCls:0.1}
};
fs.writeFileSync(path.join(outputDir,'summary.json'),JSON.stringify(summary,null,2)+'\n');
const failures=[];
for(const item of results){
 if(item.accessibility===null||item.accessibility<95)failures.push(item.route+' mobile accessibility '+item.accessibility+' <95');
 if(expectedPublic&&(item.seo===null||item.seo<95))failures.push(item.route+' mobile SEO '+item.seo+' <95');
 // LCP/CLS are recorded for all routes; ephemeral CI noise does not replace
 // production measured Core Web Vitals and cannot prove INP <=200ms.
}
console.log('LIGHTHOUSE LAB SUMMARY',JSON.stringify({mode:summary.mode,results:results.length,failures}));
if(failures.length)throw new Error('Lighthouse quality gate failed: '+failures.join('; '));
