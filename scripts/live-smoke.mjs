/**
 * One-shot live Cloudflare Pages smoke test. No external dependencies.
 * Usage:
 *   LIVE_SITE_URL=https://actual-host LIVE_EXPECT_INDEX=true npm run smoke:live
 *   LIVE_SITE_URL=https://preview-host LIVE_EXPECT_INDEX=false npm run smoke:live
 * Does not submit Search Console, change DNS or deploy.
 */
import assert from 'node:assert/strict';
import {isIP} from 'node:net';

const envUrl=(process.env.LIVE_SITE_URL||'').trim();
const expected=(process.env.LIVE_EXPECT_INDEX||'').trim();
if(!['true','false'].includes(expected))throw new Error('Set LIVE_EXPECT_INDEX=true (public production) or false (unindexed preview).');
if(!/^https:\/\/[a-z0-9.-]+$/i.test(envUrl.replace(/\/$/,'')))throw new Error('Set LIVE_SITE_URL to the exact HTTPS hostname, without a path, query or port.');
const origin=envUrl.replace(/\/$/,'');
const domain=new URL(origin).hostname.toLowerCase();
if(isIP(domain)||domain==='example.com'||domain.endsWith('.example')||domain.endsWith('.test')||domain.endsWith('.invalid')||domain.endsWith('.internal')||domain.endsWith('.local')||domain==='localhost')throw new Error('Cannot smoke-test an IP address, placeholder or local domain.');
const approved=expected==='true';
const fetchText=async pathname=>{
 const controller=new AbortController();
 const timeout=setTimeout(()=>controller.abort(),12000);
 try{
  const response=await fetch(origin+pathname,{redirect:'manual',signal:controller.signal,headers:{'user-agent':'GramsAndCups-LiveReleaseCheck/1.0'}});
  return {response,body:await response.text()};
 }finally{clearTimeout(timeout)}
};
const demand=(response,expectedStatus,where)=>{
 assert.equal(response.status,expectedStatus,where+' returned HTTP '+response.status+' instead of '+expectedStatus);
 if(response.status===200)assert.ok((response.headers.get('content-type')||'').length>0,'Missing content type on '+where);
};
const readMeta=(html,name)=>html.match(new RegExp('<meta name="'+name+'" content="([^"]+)"'))?.[1]||'';
const checks=[];
async function inspect(pathname,{indexed=null}={}){
 const {response,body}=await fetchText(pathname);
 demand(response,200,pathname);
 assert.match(body,/<!doctype html>/i,pathname+' is not an HTML page');
 assert.match(body,/<h1(?:\s|>)/,pathname+' has no H1');
 const shouldIndex=indexed===null?approved:indexed;
 assert.equal(readMeta(body,'robots'),shouldIndex?'index,follow':'noindex,follow',pathname+' robots mismatch');
 const canonical=body.match(/<link rel="canonical" href="([^"]+)"/)?.[1]||'';
 if(shouldIndex)assert.equal(canonical,origin+pathname,pathname+' canonical does not match the requested host');
 else assert.ok(!canonical,'Unexpected canonical on noindex page '+pathname);
 const xRobots=(response.headers.get('x-robots-tag')||'').toLowerCase();
 if(approved)assert.ok(!xRobots.includes('noindex'),'Response headers silently noindex the production site');
 else assert.ok(xRobots.includes('noindex'),'Preview should have X-Robots-Tag: noindex (Cloudflare Pages _headers)');
 assert.equal((response.headers.get('x-content-type-options')||'').toLowerCase(),'nosniff','Expected nosniff header on '+pathname);
 checks.push(pathname);
}
await inspect('/');
await inspect('/cooking/');
await inspect('/cooking/ingredients/all-purpose-flour/');
await inspect('/cooking/grams-to-cups/100-grams-to-cups/');
await inspect('/cooking/grams-to-cups/',{indexed:false});
await inspect('/cooking/batch-converter/',{indexed:false});
await inspect('/cooking/grams-to-cups/1000-grams-to-cups/',{indexed:false});
for(const item of ['/assets/app.js','/assets/core.mjs','/assets/ingredients.json','/assets/styles.css','/favicon.svg']){
 const {response,body}=await fetchText(item);
 demand(response,200,item);
 assert.ok(body.length>150,'Missing or unexpectedly empty asset '+item);
 checks.push(item);
}
const {response:robotsResponse,body:robots}=await fetchText('/robots.txt');
demand(robotsResponse,200,'/robots.txt');
if(approved){
 assert.ok(robots.includes('Sitemap: '+origin+'/sitemap.xml'),'robots.txt sitemap host mismatch');
 const {response,body}=await fetchText('/sitemap.xml');
 demand(response,200,'/sitemap.xml');
 const locs=[...body.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
 assert.equal(locs.length,65,'Production sitemap should contain 65 index candidates');
 assert.equal(new Set(locs).size,65,'Duplicate sitemap URLs');
 assert.ok(locs.every(x=>x.startsWith(origin+'/')),'Sitemap contains a different hostname');
 assert.ok(!locs.some(x=>x.endsWith('/cooking/grams-to-cups/')||x.endsWith('/cooking/batch-converter/')||x.includes('1000-grams-to-cups')),'Noindex pages leaked into sitemap');
 checks.push('/sitemap.xml');
}else{
 assert.ok(!robots.includes('Sitemap:'),'Unindexed preview should not advertise a sitemap');
 const {response}=await fetchText('/sitemap.xml');
 assert.equal(response.status,404,'Preview must not serve a sitemap');
}
const {response:missing}=await fetchText('/_grams_cups_nonexistent_404_probe_2026/');
assert.equal(missing.status,404,'Unknown routes must return HTTP 404, not soft-404 HTTP 200');
checks.push('404 response');
console.log('LIVE SMOKE PASSED',JSON.stringify({origin,mode:approved?'approved production':'private preview',checks}));
