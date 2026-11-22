# Grams & Cups — Cooking Measurement Converter

A complete, browser-local, source-backed cooking conversion website. **One implementation, one production release**: no accounts, no database, no paid API and no scheduled content generation.

**This is the dedicated site repository `garrison2025/Grams-to-Cups`.** It supersedes the earlier integration assumption in the planning document that the code would be added to `Convert-Units`. That older repository is left untouched.

## Finished functional scope

- **14 Cooking tools:** grams ↔ cups, grams ↔ tablespoons, cups ↔ tablespoons, mL ↔ US tablespoons, US tablespoons ↔ mL, US cups ↔ US fluid ounces, US fluid ounces ↔ US cups, half-measurement fraction calculator, recipe scaler and the multiline ingredient batch converter. The main converter also supports teaspoons, mass ounces, kilograms and milliliters via unit selection.
- **24 documented ingredients**, each including original measurement, quantity, state, method, source URL, review date and limitation. The data are recipe-chart estimates, **not physical density constants**.
- **21 numerical comparison pages**, **24 ingredient-specific pages**, **10 ingredient+number pages**, 3 printable chart pages, 3 measuring guides, source methodology and cooking hub; **77 Cooking routes**, plus independent homepage and About/Privacy/Contact (81 static HTML pages).
- Free calculator with regular and Unicode kitchen fractions (½, 1½, ¾), **exact common kitchen fraction arithmetic** (for example 1/3 + 1/4 = 7/12) in the existing half-measurement tool, US and metric cup standards, swap/reset/copy/share/print, URL-state sharing, ingredient search, serving scaling with safe common count nouns and CSV export.
- **Batch ingredient conversion**: paste up to 100 ingredient lines; convert to grams or cups using exact food identifiers; explicit `US cup` and `metric cup` labels take precedence over the global destination standard, while unqualified cups use the chosen standard. Results can be copied back into the converter without silently changing a US cup to a metric cup. Unrecognized ingredients or states are preserved and flagged for manual review, never assigned a guessed density. Copy or export a CSV with review warnings. The batch tool is functional but noindex until separate SEO value is proven.
- Pre-rendered answers, tables, metadata, breadcrumbs and internal links; true 404 page, sitemap only for approved production, per-page canonical and index review.
- Responsive original styling, visible keyboard focus, accessible field labels, reduced-motion support and separate **320 ms debounced polite screen-reader result announcements** while the visible calculator updates immediately. All calculations remain browser-local. No fake testimonials, review stars or preapproved AdSense claims.

Browser tests check fraction addition, subtraction, multiplication and division, unitless count-ingredient scaling (e.g. `1 large egg` → `2 large eggs`), graceful invalid-input handling and a useful pre-rendered fraction example without JavaScript. The static build audit rejects noniterable `querySelector` loops so a new widget cannot accidentally interrupt later page initialization.

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

## Independent site identity — final architecture

This is **only** `garrison2025/Grams-to-Cups`, an independent website, not a page set in the older Convert-Units project. The **actual public domain has not been confirmed**. The builder refuses to publish with a different project's former domain, including subdomains, even if CI is enabled. Never infer production `SITE_URL` from the archived plan or from a temporary preview host. The canonical search-intent URL for the independent site is `/`.

The 21 formerly unresolved SEO decisions have now been completed on the basis of the supplied partial Semrush exports, specific ingredient source states, observed competitor pages, and useful distinct functions. The final index policy is **62 eligible pages, 19 useful noindex pages**. This is a publishing decision, not a claim of Google indexation or growth. See [research/seo-21-editorial-decisions.json](research/seo-21-editorial-decisions.json).

## One-time public release verification

- `npm run build` now includes a strict **publication audit** checking 81 individual pages, metadata, canonical, JSON-LD, robots, privacy headers, the exact 62-entry production sitemap, and unexpected third-party JS/CSS.
- A missing `SITE_URL`, or a placeholder hostname such as `example.com`, blocks an explicitly approved production build. `example.com` is permitted **only inside GitHub CI simulation** with the explicitly scoped `SITE_URL_FIXTURE_APPROVED_FOR_CI=true` test flag; `CI=true` by itself does not bypass the production-domain safeguard. **Never set this fixture flag on Cloudflare Pages.**
- After the real site is deployed, open **GitHub → Actions → Live Cloudflare Pages release verification → Run workflow**. Supply the exact public HTTPS origin and choose whether it is supposed to be indexed. The native Node smoke test checks the live site, not merely the static generator. It has **not** been run for a real host because no deployed URL has been confirmed in this repository.
- Alternatively run `npm run smoke:live` with `LIVE_SITE_URL` and `LIVE_EXPECT_INDEX` environment variables. See [DEPLOYMENT.md](DEPLOYMENT.md).

## Lighthouse mobile lab quality gate

The [Lighthouse mobile lab workflow](.github/workflows/lighthouse-audit.yml) tests representative pages on pull requests using a local, intentionally `noindex` preview and uploads raw JSON evidence. It measures **performance, accessibility, best practices, lab LCP and CLS**, enforcing a mobile accessibility score of at least 95. Preview SEO scores are deliberately **not** used because preview pages are meant to be `noindex`.

Once the actual independent-site HTTPS origin is confirmed, run the same workflow manually with the `site_url` input and `expected_indexing=true`; it first performs real-host HTTP/sitemap checks and then audits live mobile SEO, accessibility and performance. The final-host SEO and accessibility targets are both 95 or higher. These are repeatable **lab** results, not real-user INP or Google Search Console proof. CLI dependencies are installed only on GitHub Actions and are not bundled with the site.

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

## Search SEO and generative-answer readiness (SEO/GEO)

The project uses the **same factual, crawlable pages** for classic search and AI-assisted search. No separate fabricated "AI-only" pages, fake FAQ stars, Review/Recipe rich results or unverified ranking claims are emitted. Google says AI Overviews and AI Mode require the same crawl/index/snippet fundamentals as regular Search, and do not require special AI text files or special AI schema ([Google Search Central](https://developers.google.com/search/docs/appearance/ai-features)).

- **Readable evidence:** the home, individual tool and ingredient pages show complete numerical answers in static HTML. A cited answer states the **ingredient, food state, measuring method, exact US or metric cup unit, reference weight and uncertainty**; the site does not present flour, honey and sugar as sharing a universal density.
- **Connected entities:** approved public pages use stable `WebSite`, `WebPage`, `BreadcrumbList` and (only for interactive tools) `WebApplication` JSON-LD entities. The `WebPage` and application are connected with matching `@id` references. Ingredient-weight content links to the actually visible King Arthur Baking reference using `citation`; no affiliation, independent laboratory testing, user ratings or Google AI placements are asserted.
- **Social discoverability:** branded Open Graph site name, US locale and concise Twitter/X summary card metadata. Canonical, `og:url` and publication JSON-LD remain suppressed on unindexed previews; production metadata uses only a verified real independent site origin.
- **Coverage and guardrails:** `scripts/seo-geo-audit.mjs` inspects **70 source-aware search-intent pages**, including 11 basic conversion directions, 21 gram-number comparisons, 24 food references, 10 food+number answers, 3 charts and the homepage. It writes private `reports/seo-geo-visible-answers.csv` and fails the build if an expected visible answer, unit, state or source explanation disappears. `scripts/publication-audit.mjs` verifies every public JSON-LD entity against visible text and original citations.
- **No unproven rankings:** independent-site production indexing still requires the correct real hostname, a successful sitemap/robots/canonical audit, Search Console ownership and an observed production SEO audit. Structured data and static answers improve clarity, but do **not** guarantee indexing, AI citations or traffic.

## Evidence-aware SEO

The full supplied (not full-domain) Semrush material is preserved at [research/semrush-us-2300-sample.csv](research/semrush-us-2300-sample.csv): 1,000 keyword rows from `gramstocupsconverter.cc`, 700 from `gramstocup.com`, 600 from `gramstocups.io`. These are third-party organic ranking estimates, not Search Console traffic or evidence of ad revenue. `site_target_suggestion` is explicitly heuristic and must never be interpreted as an observed ranking of this site.

**Publication policy:** All 77 Cooking routes are functional; 19 have `noindex` under the finalized source-limited editorial decisions because the supplied partial keyword and page evidence does not directly establish an independent SEO target. That is **not a feature omission**: users can still navigate, calculate, print and share those tools/pages. The approved production sitemap contains **62 eligible page candidates including home/legal pages**, rather than dumping every possible numeric URL into Google.

## Original 76-candidate plan: complete route reconciliation

The user-supplied **2026-11-22 Appendix A** is now preserved in [research/seo-76-candidate-baseline.json](research/seo-76-candidate-baseline.json), with every original route, proposed primary query and observed Semrush search volume/KD (missing observations remain `null`, not zero). Every build runs `scripts/candidate-audit.mjs` and **fails** if a required URL is missing, the candidate count changes, or unexpected pages appear.

All **76 planned URLs exist and work**: 58 are eligible for production indexing under the completed editorial review, and 18 remain usable `noindex` support pages. The other five site pages are the primary homepage, About, Privacy, Contact and the extra noindex batch conversion tool. Thus the full site remains **81 pages with 62 index candidates**. The broad `grams to cups` query is consolidated onto the homepage; its former cooking tool URL is not an additional indexable landing page.

The current **partial** imported keyword sample maps 39 of the 76 planned routes directly by **unreviewed heuristic suggestion**, with six more having strict secondary ingredient-intent observations. Three other candidates have primary-query estimates in the approved plan but no corresponding sample page mapping, and 28 lack both mappings and source-plan primary-query estimates. These are **candidate evidence classes, not proved rankings or editorial validation**. All 21 previously unresolved editorial cases now have explicit source-limited dispositions: **18 index-eligible, three functional `noindex`**. This is not proof of Google indexing or guaranteed ranking.

The **entire original competitor evidence** for all 76 rows is now present: exact phrase ranking observations, source-plan screenshot page estimates, and the original editorial release conditions. Before this update the candidate JSON carried only the primary keyword and numeric estimates; its data fields have been reconciled against the uploaded Appendix A with zero mismatches.

**Crawl-path audit:** 80 of 81 static pages are reachable through actual HTML links from `/`, with a maximum of two link clicks. All ten `ingredient + grams` pages have contextual inbound links from both their specific ingredient page and the corresponding generic gram amount page. The sole deliberately unlinked URL is the usable but `noindex` duplicate `/cooking/grams-to-cups/`, whose principal search intent belongs to the homepage. Every build tests this graph and writes a private per-page report.

The 21 originally unverified index candidates were separated into **five trust/directory pages** that do not need acquisition-keyword proof, **13 pages with observed competitor page screenshots but no sample keyword-to-page mapping**, **two pages whose primary plan keyword exceeds KD29 without observed low-KD sample support**, and **one page missing both mapping and screenshot proof**. These classifications are source-traceable triage flags, not an automated decision that Google will index or rank the URLs. A final source-limited publication decision is now recorded for every case in `research/seo-21-editorial-decisions.json`, including the three excluded routes: tablespoons-to-grams (KD31), almond flour (source state broader than keyword intent), and water grams-to-cups (KD47).

This is a single production release project: passing a static build or having a route is **not** permission to enable real-world indexing before the deployed host and SEO review are verified.

## SEO keyword integrity and duplicate-page protection

The core query `grams to cups` is assigned to the **homepage `/` only**. The original `/cooking/grams-to-cups/` still functions when opened directly but stays `noindex`; the site's internal links now direct visitors and crawlers to `/` for that intent. No new 301 redirects were invented for URLs that were never confirmed live.

Every `npm run build` also executes `scripts/keyword-audit.mjs`. It reads **all 2,300 user-supplied Semrush observations** (1,643 unique query strings), checks that tentative target URLs exist, detects mismatches and generates thirteen **non-public** evidence and audit reports:

- `reports/seo-keyword-decisions.csv`: one record per imported keyword, original estimated data unchanged, target URL, status and classification reason.
- `reports/seo-page-evidence.csv`: one record per site page, index eligibility and number of mapped keyword observations.
- `reports/seo-summary.json`: counts and gaps, so missing keyword evidence is never incorrectly equated to zero demand.
- `reports/seo-numeric-intent.csv`: independently matched numeric search phrases, competitor sample KD, and eligibility for each of the 21 grams-to-cups number pages.
- `reports/seo-ingredient-intent.csv`: secondary, exact-ingredient search-intent matches, with explicit food-state checks and no automatic keyword ownership.
- `reports/seo-76-candidate-decisions.csv`: line-by-line reconciliation of the **76 URLs in the original approved plan**, including primary keyword, the plan's observed US volume/KD if available, real generated route, index eligibility, canonical intent, direct/secondary keyword evidence and editorial status.
- `reports/seo-76-candidate-summary.json`: machine-readable totals and the five extra useful site routes outside that 76-item candidate list.
- `reports/seo-21-index-review.csv`: per-page final disposition for the **21 originally unverified candidate routes**, preserving competitor screenshot evidence, source limitations and editorial rationale.
- `reports/seo-21-index-review-summary.json`: evidence-gap buckets, with trust/navigation pages separated from acquisition-keyword pages.
- `reports/seo-link-graph.csv`: every generated page's inbound link count, shortest home-page click depth, index policy and deliberate noindex exception.
- `reports/seo-76-final-publication-status.json`: complete 76-URL machine-readable final decision record, including 58 index-eligible and 18 functional `noindex` candidates.
- `reports/ingredient-source-evidence.json`: one source-locked record per ingredient (24), with explicit food states, methods, dates, weights and the published reference, not claimed laboratory density measurements.
- `reports/keyword-to-url.csv`: all 2,300 original partial-export keyword observations with competitor, original ranking URL, estimated KD/volume and a **provisional** target URL; unknown values are preserved, not set to zero.

The GitHub Actions **Site build and tests** workflow attaches the thirteen reports as `grams-to-cups-seo-review` for download (30-day artifact retention). Reports are **not included in `dist/`** and are not exposed to site visitors.

**Coverage warning:** 24 of the 62 final index candidates lack an original suggested URL in the partial supplied keyword sample. Six have strict secondary ingredient-intent evidence; the remaining **18** were resolved through source-limited editorial review of independent site functions, trust pages and observed competitor page evidence. Such absence in a partial export is not proof of zero search demand, and an index decision is not an assertion of keyword rank or traffic. Some are navigational, methodology or trust pages; absence from the sample is not proof of zero demand. See the per-page report before deciding whether each deserves separate indexing.

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
