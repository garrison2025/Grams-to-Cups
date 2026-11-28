(() => {
  'use strict';
  const ID = 'G-RE4SF27SM3';
  const HOSTS = ['gramstocupscalculator.com', 'www.gramstocupscalculator.com'];
  const KEY = 'grams-cups-analytics-v1';
  const PREFIX = 'gcga';
  if (!HOSTS.includes(location.hostname)) return;
  if (document.querySelector('script[src*="googletagmanager.com/gtag/js"],script[src*="googletagmanager.com/gtm.js"]')) return;
  const main = document.querySelector('main');
  const footer = document.querySelector('footer');
  const canonical = document.querySelector('link[rel=canonical]');
  if (!main || !footer || !canonical || /noindex/i.test(document.querySelector('meta[name="robots"]')?.content || '')) return;
  let page;
  try {
    const u = new URL(canonical.href);
    if (!HOSTS.includes(u.hostname)) return;
    page = u.origin + u.pathname;
  } catch { return; }
  let source = new URLSearchParams(location.search).get('utm_source') || '';
  const known = /^(chatgpt\.com|chat\.openai\.com|perplexity\.ai|claude\.ai|gemini\.google\.com|copilot\.microsoft\.com|chat\.deepseek\.com|grok\.com|kimi\.com|doubao\.com|poe\.com|qwen\.ai|meta\.ai|you\.com|chat\.mistral\.ai)$/i;
  if (known.test(source)) page += '?utm_source=' + encodeURIComponent(source.toLowerCase());
  let referrer = '';
  try { if (document.referrer) referrer = new URL(document.referrer).origin + '/'; } catch {}
  let choice = null;
  try { choice = localStorage.getItem(KEY); } catch {}
  let loaded = false;
  function tag(){ window.dataLayer = window.dataLayer || []; window.dataLayer.push(arguments); }
  function start() {
    window['ga-disable-' + ID] = false;
    if (loaded) return;
    loaded = true;
    tag('js', new Date());
    tag('config', ID, {send_page_view:false, page_location:page, page_referrer:referrer, allow_google_signals:false, allow_ad_personalization_signals:false, cookie_prefix:PREFIX, cookie_flags:'SameSite=Lax;Secure'});
    tag('event','page_view',{send_to:ID,page_location:page,page_referrer:referrer});
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + ID;
    document.head.appendChild(script);
  }
  function stop() {
    window['ga-disable-' + ID] = true;
    for (const item of document.cookie.split(';')) {
      const name = item.split('=')[0].trim();
      if (name.startsWith(PREFIX + '_')) for (const domain of ['', '; domain=gramstocupscalculator.com']) document.cookie = name + '=; Max-Age=0; path=/; Secure; SameSite=Lax' + domain;
    }
  }
  const panel = document.createElement('section');
  panel.setAttribute('aria-label','Optional analytics');
  panel.style.cssText = 'padding:12px 16px;border-bottom:1px solid #d1d5db;background:#f8fafc;color:#1f2937;font:14px/1.5 system-ui;';
  const text = document.createElement('p');
  text.textContent = 'Allow optional Google Analytics to measure visits and traffic sources? Recipe text, amounts and shared configuration are not included. Rejecting does not limit any tool.';
  const link = document.createElement('a'); link.href='/privacy/';link.textContent=' Privacy policy';text.append(link);
  panel.append(text);
  function button(label, fn) {
    const b = document.createElement('button');b.type='button';b.textContent=label;b.style.cssText='margin:6px 8px 0 0;padding:7px 12px;border:1px solid #64748b;border-radius:6px;background:#fff;color:#1f2937;cursor:pointer';b.addEventListener('click',fn);return b;
  }
  function choose(value) {
    const previous = choice; choice=value;
    try { localStorage.setItem(KEY,value); } catch {}
    if(value==='yes'){ if(previous==='no'&&loaded){location.reload();return;} start(); }else stop();
    panel.hidden=true;
  }
  panel.append(button('Reject analytics',()=>choose('no')),button('Allow analytics',()=>choose('yes')));
  main.before(panel);
  const settings=button('Analytics preferences',()=>{panel.hidden=false;panel.scrollIntoView({block:'nearest'});});
  footer.append(settings);
  panel.hidden = choice==='yes'||choice==='no';
  if(choice==='yes')start();else stop();
})();
