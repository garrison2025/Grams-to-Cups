# Grams-to-Cups — Independent Site Final Release Acceptance

**Project scope:** `garrison2025/Grams-to-Cups` is an independent website. Its production domain is **not confirmed**. The archived integration plan does not authorize using another project's domain. Production publication is deliberately blocked until the correct real hostname is supplied and verified.

This document records **what is checked in code**, what source-limited editorial decisions are complete, and what can only be tested on a real deployment. No placeholder URL should be treated as a production website.

## Completed, programmatically verified

| Gate | Check | Status / evidence |
| --- | --- | --- |
| G0 partial competitor evidence | 2,300 original US Semrush keyword rows, 1,643 distinct phrases; no fabricated missing volume/KD | Complete in source CSV and `reports/keyword-to-url.csv` |
| G1 reference integrity | 24 separate ingredient records, original source label and grams/volume pair, food state, method, source URL | Source-locked and unit-tested; export `reports/ingredient-source-evidence.json` |
| G2 conversions | US/metric cups, liquid-vs-mass ounce separation, precise fractions, round trips, invalid values, recipe scaling and safe batch CSV | Unit tests |
| G3 product | 14 actual Cooking tools and 81 functional HTML pages, no paid API or required database | Static build and Chromium browser tests |
| G4 planned pages | 76/76 source-plan candidate routes individually accounted for, with a final `approved-index` or `functional-noindex` result | `reports/seo-76-final-publication-status.json` |
| G5 publication policy | 62 eligible index routes, 19 functional `noindex` routes; no duplicate core canonical; sitemap excludes every noindex page | Preview + synthetic production build audits |
| G5 prior 21 evidence gaps | All 21 explicitly decided: 18 eligible, 3 functional noindex with page-specific rationales | `research/seo-21-editorial-decisions.json` |
| G7 UX | Chromium responsive checks at 320/375/768/1440 widths, keyboard, local share, copy, CSV, no-JS source table | `Browser UX & responsive audit` workflow |
| G8 local Lighthouse lab | Mobile preview tests for homepage, flour reference and fraction calculator; SEO intentionally skipped on noindex preview | `Lighthouse mobile lab and real-host acceptance` Actions artifact |
| G9 source safety | No third-party runtime JavaScript, local input validation, spreadsheet formula protection, placeholder/legacy-host rejection | Build and publication audits |
| G10 technical runbook | No accounts, backend, scheduled jobs or fixed paid APIs; original source & review limitations disclosed | `README.md` and `DEPLOYMENT.md` |

**Important qualifications:** The cited source pairs and review dates are documented; this is not a claim that every external chart entry has been independently re-measured. Semrush estimates are not Search Console results. Index eligibility is not confirmed Google indexing or traffic. A Lighthouse preview score is not a real-host Lighthouse score or real-user INP.

## Still blocked by external production setup / real-host evidence

- [ ] Confirm the actual **independent Grams-to-Cups** production hostname; never infer it from the old plan or another project.
- [ ] Connect the intended Cloudflare Pages project and check the actual preview/production routing and SSL configuration. This cannot be proven from a passing GitHub build.
- [ ] Verify all production files, status codes, redirects, unknown-route **HTTP 404**, headers, 62-entry sitemap and actual host canonical using the `Live Cloudflare Pages release verification` workflow.
- [ ] Run the `Lighthouse mobile lab and real-host acceptance` workflow using the real HTTPS origin and `expected_indexing=true`. Require mobile Accessibility and SEO scores ≥95 and review lab LCP≤2.5 s, CLS≤0.1.
- [ ] Check visual experience and external links at the actual live URL. Collect screenshots and archive final commit SHA and Cloudflare deployment ID.
- [ ] Verify independent website ownership in Google Search Console and submit the production sitemap **only after publication**. Actual indexing/click data requires Google to crawl the site; it cannot be simulated.
- [ ] Configure AdSense ownership, ads.txt and jurisdiction-appropriate privacy/consent treatment **only if this specific domain and account are eligible**. No claim of approval, revenue or guaranteed display.
- [ ] If approved, merge the reviewed PR to `main` for one intended public production release. Keep all other preview deployments `noindex`.

## Zero-fixed-cost architecture and maintenance

No database, Cloudflare Workers API, paid model, payment processor, or server cron is required by this static build. Optional GitHub Actions QA uses CI minutes and is subject to the hosting provider's applicable free quotas. Production domain registration/renewal, if any, remains separate. Maintain ingredient references only when the published source or a demonstrated conversion defect changes; use `npm run build` and browser QA before any edit.

**New pre-release tool data (2026-11-22):** 27 externally sourced ingredient references, of which 24 keep the originally audited individual SEO pages and three (bread flour, unsweetened cocoa powder, specific unbleached cake flour) are calculator/chart data only. All 21 number pages now share practical measuring instructions and a three-food first-answer table. The batch UI permits an explicit per-row source selection without guessing. SEO candidate route totals remain unchanged.

**Release state: NOT YET PRODUCTION-VERIFIED.** This is a tested implementation package with final *source-limited* SEO dispositions, not a claim of an already deployed or indexed website.
