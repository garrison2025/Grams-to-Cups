# Grams & Cups — Cooking Measurement Converter

A complete, browser-local, source-backed cooking conversion website. **One implementation, one production release**: no accounts, no database, no paid API and no scheduled content generation.

**This is the dedicated site repository `garrison2025/Grams-to-Cups`.** It supersedes the earlier integration assumption in the planning document that the code would be added to `Convert-Units`. That older repository is left untouched.

## Finished functional scope

- **14 Cooking tools:** grams ↔ cups, grams ↔ tablespoons, cups ↔ tablespoons, mL ↔ US tablespoons, US tablespoons ↔ mL, US cups ↔ US fluid ounces, US fluid ounces ↔ US cups, half-measurement fraction calculator, recipe scaler and the multiline ingredient batch converter. The main converter also supports teaspoons, mass ounces, kilograms and milliliters via unit selection.
- **24 documented ingredients**, each including original measurement, quantity, state, method, source URL, review date and limitation. The data are recipe-chart estimates, **not physical density constants**.
- **21 numerical comparison pages**, **24 ingredient-specific pages**, **10 ingredient+number pages**, 3 printable chart pages, 3 measuring guides, source methodology and cooking hub; **77 Cooking routes**, plus independent homepage and About/Privacy/Contact (81 static HTML pages).
- Free calculator with regular and Unicode kitchen fractions (½, 1½, ¾), US and metric cup standards, swap/reset/copy/share/print, URL-state sharing, ingredient search, recipe serving scaling and safe CSV export.
- **Batch ingredient conversion**: paste up to 100 ingredient lines; convert to grams or cups using exact food identifiers; unrecognized ingredients or states are preserved and flagged for manual review, never assigned a guessed density. Copy or export a CSV with review warnings. The batch tool is functional but noindex until separate SEO value is proven.
- Pre-rendered answers, tables, metadata, breadcrumbs and internal links; true 404 page, sitemap only for approved production, per-page canonical and index review.
- Responsive original styling, visible keyboard focus, accessible field labels, reduced-motion support, privacy-first client JS. No fake testimonials, review stars or preapproved AdSense claims.

## Get started

Requires **Node.js 20+** and nothing else.

```bash
npm run build
```

Output: **`dist`**, directly deployable to Cloudflare Pages. This command runs Node's built-in test runner, generates static HTML and assets, and audits links, titles, pages and indexing policy. There are no npm runtime or dev dependencies to install.

```bash
npm test
```

GitHub Actions runs both a safe preview build and a simulated approved production build on each main push.

## One-time public release verification

- `npm run build` now includes a strict **publication audit** checking 81 individual pages, metadata, canonical, JSON-LD, robots, privacy headers, the exact 65-entry production sitemap, and unexpected third-party JS/CSS.
- A missing `SITE_URL`, or a placeholder hostname such as `example.com`, blocks an explicitly approved production build. `example.com` is permitted **only inside GitHub CI simulation** with the explicitly scoped `SITE_URL_FIXTURE_APPROVED_FOR_CI=true` test flag; `CI=true` by itself does not bypass the production-domain safeguard. **Never set this fixture flag on Cloudflare Pages.**
- After the real site is deployed, open **GitHub → Actions → Live Cloudflare Pages release verification → Run workflow**. Supply the exact public HTTPS origin and choose whether it is supposed to be indexed. The native Node smoke test checks the live site, not merely the static generator. It has **not** been run for a real host because no deployed URL has been confirmed in this repository.
- Alternatively run `npm run smoke:live` with `LIVE_SITE_URL` and `LIVE_EXPECT_INDEX` environment variables. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Cloudflare Pages

See [DEPLOYMENT.md](DEPLOYMENT.md) for exact production settings and QA gates.

| Setting | Value |
|---|---|
| GitHub repo | `garrison2025/Grams-to-Cups` |
| Production branch | `main` |
| Framework preset | None |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node | 22 or later (20 minimum) |
| `SITE_URL` | **Verified stable public origin**, e.g. your actual `https://your-domain.example`, without a path |
| `PUBLIC_INDEX_APPROVED` | Set to `true` **only after** all content and domain checks pass |

**Canonical safeguards:** Local and Cloudflare preview builds have `noindex`, with no sitemap. The main branch stays `noindex` until both `SITE_URL` is valid and `PUBLIC_INDEX_APPROVED=true`. The builder will **never infer canonical from CF_PAGES_URL**, which can represent a transient deployment. Do not enable the index gate before the real public hostname is confirmed.

## Evidence-aware SEO

The full supplied (not full-domain) Semrush material is preserved at [research/semrush-us-2300-sample.csv](research/semrush-us-2300-sample.csv): 1,000 keyword rows from `gramstocupsconverter.cc`, 700 from `gramstocup.com`, 600 from `gramstocups.io`. These are third-party organic ranking estimates, not Search Console traffic or evidence of ad revenue. `site_target_suggestion` is explicitly heuristic and must never be interpreted as an observed ranking of this site.

**Publication policy:** All 77 Cooking routes are functional; 16 have `noindex` by default because the supplied partial keyword and page evidence does not directly establish an independent SEO target. That is **not a feature omission**: users can still navigate, calculate, print and share those tools/pages. Main production sitemap holds **65 eligible page candidates including home/legal pages**, rather than dumping every possible numeric URL into Google.

## Original 76-candidate plan: complete route reconciliation

The user-supplied **2026-11-22 Appendix A** is now preserved in [research/seo-76-candidate-baseline.json](research/seo-76-candidate-baseline.json), with every original route, proposed primary query and observed Semrush search volume/KD (missing observations remain `null`, not zero). Every build runs `scripts/candidate-audit.mjs` and **fails** if a required URL is missing, the candidate count changes, or unexpected pages appear.

All **76 planned URLs exist and work**: 61 are presently eligible for production indexing, and 15 are intentional usable `noindex` support pages. The other five site pages are the primary homepage, About, Privacy, Contact and the extra noindex batch conversion tool. Thus the full site remains **81 pages with 65 index candidates**. The broad `grams to cups` query is consolidated onto the homepage; its former cooking tool URL is not an additional indexable landing page.

The current **partial** imported keyword sample maps 39 of the 76 planned routes directly by **unreviewed heuristic suggestion**, with six more having strict secondary ingredient-intent observations. Three other candidates have primary-query estimates in the approved plan but no corresponding sample page mapping, and 28 lack both mappings and source-plan primary-query estimates. These are **candidate evidence classes, not proved rankings or editorial validation**. The preexisting 21 index candidates with neither direct nor strict secondary mapping still require per-page editorial assessment.

The **entire original competitor evidence** for all 76 rows is now present: exact phrase ranking observations, source-plan screenshot page estimates, and the original editorial release conditions. Before this update the candidate JSON carried only the primary keyword and numeric estimates; its data fields have been reconciled against the uploaded Appendix A with zero mismatches.

**Crawl-path audit:** 80 of 81 static pages are reachable through actual HTML links from `/`, with a maximum of two link clicks. All ten `ingredient + grams` pages have contextual inbound links from both their specific ingredient page and the corresponding generic gram amount page. The sole deliberately unlinked URL is the usable but `noindex` duplicate `/cooking/grams-to-cups/`, whose principal search intent belongs to the homepage. Every build tests this graph and writes a private per-page report.

The 21 still-unmapped index candidates are now separated into **five trust/directory pages** that do not need acquisition-keyword proof, **13 pages with observed competitor page screenshots but no sample keyword-to-page mapping**, **two pages whose primary plan keyword exceeds KD29 without observed low-KD sample support**, and **one page missing both mapping and screenshot proof**. These classifications are source-traceable triage flags, not an automated decision that Google will index or rank the URLs. The review report identifies the exact URLs and what to check before final publication.

This is a single production release project: passing a static build or having a route is **not** permission to enable real-world indexing before the deployed host and SEO review are verified.

## SEO keyword integrity and duplicate-page protection

The core query `grams to cups` is assigned to the **homepage `/` only**. The original `/cooking/grams-to-cups/` still functions when opened directly but stays `noindex`; the site's internal links now direct visitors and crawlers to `/` for that intent. No new 301 redirects were invented for URLs that were never confirmed live.

Every `npm run build` also executes `scripts/keyword-audit.mjs`. It reads **all 2,300 user-supplied Semrush observations** (1,643 unique query strings), checks that tentative target URLs exist, detects mismatches and generates ten **non-public** audit reports:

- `reports/seo-keyword-decisions.csv`: one record per imported keyword, original estimated data unchanged, target URL, status and classification reason.
- `reports/seo-page-evidence.csv`: one record per site page, index eligibility and number of mapped keyword observations.
- `reports/seo-summary.json`: counts and gaps, so missing keyword evidence is never incorrectly equated to zero demand.
- `reports/seo-numeric-intent.csv`: independently matched numeric search phrases, competitor sample KD, and eligibility for each of the 21 grams-to-cups number pages.
- `reports/seo-ingredient-intent.csv`: secondary, exact-ingredient search-intent matches, with explicit food-state checks and no automatic keyword ownership.
- `reports/seo-76-candidate-decisions.csv`: line-by-line reconciliation of the **76 URLs in the original approved plan**, including primary keyword, the plan's observed US volume/KD if available, real generated route, index eligibility, canonical intent, direct/secondary keyword evidence and editorial status.
- `reports/seo-76-candidate-summary.json`: machine-readable totals and the five extra useful site routes outside that 76-item candidate list.
- `reports/seo-21-index-review.csv`: explicit per-page editorial checklist for the 21 currently index-eligible pages without primary or strict secondary keyword mappings in the supplied **partial** sample, preserving the distinct screenshot/page evidence from the original plan.
- `reports/seo-21-index-review-summary.json`: evidence-gap buckets, with trust/navigation pages separated from acquisition-keyword pages.
- `reports/seo-link-graph.csv`: every generated page's inbound link count, shortest home-page click depth, index policy and deliberate noindex exception.

The GitHub Actions **Site build and tests** workflow attaches the ten reports as `grams-to-cups-seo-review` for download (30-day artifact retention). Reports are **not included in `dist/`** and are not exposed to site visitors.

**Coverage warning:** 27 of 65 index candidates have no original suggested URL in the partial supplied keyword sample. Strict secondary food-phrase matching recovered observed conversion queries for 6 of those pages, leaving 21 without direct or secondary keyword evidence. Such absence in a partial export is not proof of zero search demand. Some are navigational, methodology or trust pages; absence from the sample is not proof of zero demand. See the per-page report before deciding whether each deserves separate indexing.

**Important limitation:** The 1,823 mapped rows remain `heuristic` until intent and competitor relevance are manually reviewed; 477 previously unmapped rows are categorized rather than automatically assigned to new SEO URLs. Out-of-scope conversions and ambiguous “oz” queries are not grounds for generating thin pages. All requested competitor ranking exports remain partial, not full-domain SEO coverage.

Avoid cloning third-party prose. Original calculation tools and source-backed explanatory content are the product.

**Numeric intent rule:** All 21 number pages have direct observed competitor keyword examples. For 20 of them, at least one example has Semrush KD≤29. The `1000 grams to cups` page remains functional but defaults to `noindex` because its supplied sample contains only KD37 results. This is a conservative publication choice, not a claim that the page has no demand.

**Content utility additions:** All 24 ingredient pages now show both grams→cups and common cup-fractions→grams tables, with US-to-metric cup equivalents. All 21 numeric weight pages show the closest familiar US cup measures for four common ingredients and the gram difference from the requested weight. The latter is a convenience comparison, never a recommendation to replace accurate weighing with an unmarked approximation.

## Data model and accuracy

`src/ingredients.json` contains 24 ingredient **recipe-reference** entries from the [King Arthur Baking Ingredient Weight Chart](https://www.kingarthurbaking.com/learn/ingredient-weight-chart) (reviewed 2026-11-22). It is not one universal grams↔cups factor. All entries now include the exact original chart item label (`sourceEntry`), displayed on ingredient pages and the methods table, and a separate verified measurement lock at `research/ingredient-reference-lock.json`. The dependency-free unit suite covers source-locked ingredients, conversion precision, parsing, recipe scaling, keyword evidence and CSV formula-injection protection.

Examples:
- All-purpose flour: 120 g per US cup (spoon/level).
- Granulated white sugar: 198 g per US cup.
- Butter: 113 g per half US cup.
- Packed brown sugar: 213 g per US cup; **not** the loose variant.
- Long-grain dry rice: 99 g per half cup; **not** cooked rice.
- The chart's water entry is **227 g per cup**, a recipe convention, not a room-temperature physical g/mL value. This distinction is shown on the site.

Mass oz and US fluid oz must not be confused. US cup = 236.5882365 mL; metric cup = 250 mL.

For changes, update the original source pair **and its citation**, then run `npm run build`. Never silently change a measuring method.

## Privacy & monetization

No tracking/advertising code is embedded. The free tool does not transmit recipe text to a backend. AdSense can be integrated only after a real approved domain, `ads.txt`, accurate disclosures and applicable consent obligations are established. Site functionality and SEO quality do not depend on ad approval.

## Limitations

Semrush rankings are estimates, new-domain Google rankings and AdSense approval are not guaranteed. Static infrastructure can be free within platform limits; domain renewal and optional advertising compliance services may incur costs. The build does not promise that changing Google or browser policies will never require maintenance.

## Project structure

```text
src/core.mjs                 Pure math, parsing, scaling, CSV safety
src/ingredients.json         Source-backed ingredient data (24 entries)
public/app.js                Browser calculator and recipe interaction
public/styles.css            Responsive + print styles
scripts/build.mjs            Generate complete static site, robots, sitemap
scripts/audit.mjs            Page/link/meta/index gate audit
scripts/publication-audit.mjs Strong production / preview metadata and sitemap validation
scripts/live-smoke.mjs       Opt-in HTTPS deployed-host verification
src/seo-evidence.mjs         Safe keyword CSV parsing and missing-KD handling
scripts/keyword-audit.mjs    Reproducible keyword intent/evidence gate and reports
tests/site.test.mjs          Reference-lock, Unicode fractions, batch safety and regression tests
 tests/browser.test.mjs       Chromium desktop/mobile functional audit (CI-only Playwright)
research/semrush-us-2300-sample.csv  User-provided partial Semrush exports
.github/workflows/ci.yml     Preview + production test builds
.github/workflows/live-release.yml  Manual live-website verification
dist/                        Generated output (not committed)
```
