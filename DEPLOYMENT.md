# One-time launch and maintenance runbook

This repository was created as a standalone website at the owner's direction. It does **not** write to the unrelated Convert-Units repository and does not assume a purchased custom domain.

## Independent-site final decision (supersedes the older integration plan)

Repository: `garrison2025/Grams-to-Cups`. **No public production hostname has been confirmed.** This is a standalone website; the previous Convert-Units repository and its production domain are **not** a deployment target. The builder explicitly refuses that project's legacy hostname or any subdomain of it, including if a test CI flag is set. Never write another project's domain as this site's canonical host.

**Final source-limited SEO publication policy:** 81 functional URLs, 62 index-eligible, 19 noindex; the original 76 candidate routes have 58 eligible and 18 noindex entries. The 21 originally pending editorial cases were individually decided in `research/seo-21-editorial-decisions.json`. Three remain functional but are noindex: `/cooking/tablespoons-to-grams/` (plan KD31), `/cooking/ingredients/almond-flour/` (specific toasted state does not support broad search phrasing), and `/cooking/ingredients/water/` (plan KD47). All other reviewed cases have distinct user value and available competitor-page or navigational evidence; no ranking outcome is guaranteed.

**Single-release sequence:** Run builds and tests in the PR branch and test a protected/unindexed Cloudflare preview if one is available. Only after the real HTTPS domain, canonical settings, final screenshots and Lighthouse checks are verified should the production environment be configured and the PR merged to `main` for the **one public release batch**. Do not launch an incomplete live site simply to test whether it ranks.

## Connect Cloudflare Pages

1. Workers & Pages → Create application → Pages → Connect to Git → select `garrison2025/Grams-to-Cups`.
2. Production branch `main`; Framework preset **None**; Build command `npm run build`; Output directory `dist`; Node runtime **22+**.
3. Deploy once with indexing disabled. Page functions, navigation, source citations, recipe scaling, search, mobile layout and 404 must be checked at the actual preview URL.
4. Choose the actual stable public hostname (your verified custom domain or stable project.pages.dev). Set `SITE_URL=https://YOUR-EXACT-HOST` in Cloudflare Pages production **build-time environment variables** (no trailing slash or path). Do not use a transient hash deployment URL. Use the hostname that resolves live content.
5. Verify all canonical destination URLs resolve at that hostname. Verify 404, robots.txt, no console errors, static assets, reference claims, accessible mobile calculation, ingredient search and the output from `npm run build`.
6. Only after all checks, set `PUBLIC_INDEX_APPROVED=true` for the production environment and redeploy `main`. Cloudflare injects `CF_PAGES_BRANCH`; don't set it manually in dashboard.
7. Confirm production `/sitemap.xml` exists, URLs use `SITE_URL`, all index-eligible pages carry canonical/index, and excluded candidates remain noindex. Submit sitemap to Google Search Console only when the site is verified.
8. There are 81 generated HTML pages total: 77 Cooking routes and 4 site/core/legal routes. The 19 final noindex routes still function but are excluded from sitemap.

Cloudflare previews should remain noindex. This is intentional, not a reason to enable indexing before QA.

## Mandatory publication safety and exact-host live check

- Before approving indexing, configure the real `SITE_URL`. If `PUBLIC_INDEX_APPROVED=true` on `main` but the URL is missing, invalid or a placeholder, the build **fails closed**, rather than publishing incorrect canonical URLs. The CI-only `example.com` simulation is not an accepted real production host.
- `scripts/publication-audit.mjs` checks all 81 rendered pages (one H1, unique titles/descriptions, expected robots, exactly matching canonical/OG/JSON-LD, first-party CSS/JS), plus preview response-header policy and the exact 62-entry sitemap in approved simulation.
- For the deployed site, use **GitHub → Actions → Live Cloudflare Pages release verification → Run workflow**. Enter the exact final HTTPS origin; select `false` while testing a noindex preview, and `true` only after production indexing is approved. This checks real HTTP responses for selected key pages, missing URLs, first-party assets, `_headers`, `robots.txt` and the sitemap.
- On Windows PowerShell, the equivalent one-shot command is:
  ```powershell
  $env:LIVE_SITE_URL="https://YOUR-REAL-HOST"
  $env:LIVE_EXPECT_INDEX="false"
  npm run smoke:live
  ```
  Change to `true` only when the production approval step is complete. Never use a placeholder as an actual hostname.
- A successful GitHub **build** is not proof of Cloudflare deployment, Google indexing, Lighthouse performance or AdSense approval. A green live-smoke check only proves the tested URLs and headers at the time of execution; Google Search Console and performance still require separate verification.
- `src/seo-evidence.mjs` prevents empty/missing Semrush KD from being interpreted as KD0 and safely quotes third-party CSV text to neutralize spreadsheet formula injection. Source `research/semrush-us-2300-sample.csv` remains unchanged.

## Final product regression gate before public indexing

All three Cooking chart pages (/cooking/charts/, /cooking/charts/flour/, /cooking/charts/sugar/) must support both US and metric cups and a custom quantity in the 0.001–1,000 cup range. The visible table, printed table and filtered CSV must use the same row numbers and basis. Test 1/3 metric cup and a 1.5 metric cup CSV, as well as invalid input blocking exports. With JavaScript off, each chart retains its useful, correctly labeled US-cup default values.

The recipe scaler must correctly handle 1 ¹⁄₂ cups, 1½ cups, 1–2 cups and 1½–3 cups. If it encounters a compound recipe line that cannot be interpreted without risk, it must leave the original text unchanged and flag it. Its warning is an intentional safety mechanism, not a failure to display the line.

Water is a special explicitly labeled choice: the documented recipe chart uses 227 g / US cup; a separate approximate physical-capacity mode uses about 1 g / mL. The latter may vary with temperature and **must not be described as the chart's published grams-per-cup reference**. Verify the mode in the result, copied text, shareable link, printed water page and all-food chart/CSV. Other food densities must remain tied to their documented state and published references.

The latest code remains in the same open PR. Complete the prelaunch Node/Chromium/Lighthouse and production-domain HTTP/SEO checks before approving `main` publication or any Google indexing.

## Mobile Lighthouse release acceptance

Use GitHub → **Actions → Lighthouse mobile lab and real-host acceptance**.

- Pull requests automatically test three representative local preview routes (home, flour reference, fraction calculator) using ephemeral Lighthouse 13.6.0 and headless Chrome. Results are retained as `grams-cups-mobile-lighthouse` artifacts for 30 days. The local preview is deliberately `noindex`, so its SEO score is not a publication proof.
- After the actual independent-site public HTTPS origin has been confirmed, choose **Run workflow**, enter the exact origin for `site_url`, and set `expected_indexing=true` only when the final production release has been approved. The workflow performs real HTTP/canonical/sitemap smoke checks first, then Lighthouse mobile audits of the homepage, ingredient, numeric and chart routes.
- Target **mobile Accessibility and SEO scores ≥95**. Lab LCP≤2500ms and CLS≤0.1 are recorded with every run. **INP≤200ms** needs real-user instrumentation when the site has sufficient traffic; Lighthouse's synthetic run must not be falsely labeled a measured real-user INP.
- Reports are uploaded even if a score gate fails. Fix issues on the same branch and rerun the acceptance check; do not claim launch is complete from a green source-code CI run alone.

## Quality gates in CI

`npm run build` automatically:

- Runs the dependency-free Node unit tests for: original reference weights, 24 ingredient data contracts, mass/volume distinction, cup definitions, numeric round trips, fractions, recipe scaling and CSV injection safety.
- Generates 81 static HTML pages, local conversion assets, a real 404 and index-aware robots/sitemap.
- Checks route count, unique title and H1, body text, canonical/noindex, key asset existence, internal links, batch workbench presence and 21/24/10 page-family counts.
- The GitHub workflow tests both preview and production publication configurations. Its `https://example.com` value is synthetic **only for CI**, never the site's production domain.

Any failing gate means the release is not complete. Do not disable audits to produce a green build.

The 24 original chart labels and weight/volume pairs are independently locked in `research/ingredient-reference-lock.json`. Ingredient pages and the methods page print their original source labels; `npm run build` will fail if a measurement or label changes without updating that verified source lock.

## Source/reference changes

1. Find the ingredient in `src/ingredients.json`.
2. Review the original published source at `sourceUrl`, confirm amount/unit/grams, method and state. For King Arthur the original reference can be `1 cup`, `1/2 cup`, `1/4 cup`, or `1 tablespoon`: keep the **original pair**, never overwrite it with an assumed gram-per-cup.
3. Change the original measurement and review date, write an updated note as needed.
4. Add regression coverage in `tests/site.test.mjs` and run `npm run build`; inspect the ingredient page and source info.
5. Deploy after proof, not as a content publishing schedule.

For example, a published chart's `water 1 cup = 227 g` should remain labeled as a *recipe-reference weight*, not a physical-density claim.

## Search and page quality

The `research/semrush-us-2300-sample.csv` file retains supplied source observations with provenance. It is **partial** Semrush US export evidence, not all three domains' ranking keywords. Tentative URL suggestions are not automatic permission to create more SEO URLs. One search intent should have one best landing page.

The final site can calculate any positive input amount, but does not create a separate indexed URL for every imaginable number. Do not force noindex candidates into the sitemap merely to boost page count.

## Ads / legal

No AdSense script, ads.txt or advertising consent mechanism is currently configured. Add them only if ownership verification, AdSense account/publisher ID and relevant privacy/consent requirements are satisfied. Don't create false verification codes. Ads must not overlap input controls or the answer panel.

## One-time handoff criteria

A site is **not** published merely because code was pushed: a real Cloudflare Pages project, stable hostname, environment gate, production sitemap, link checks and live-device checks are required. Record the final live URL and commit in the deployment log once verified.

There is no database, queue, account backend, paid API or recurring content job. Unplanned maintenance remains possible only if standards, browser behavior, source measurements, policies or a discovered defect change.

## Batch ingredient converter and recipe fractions

The local-only `/cooking/batch-converter/` supports grams ↔ cups for source-identifiable ingredients, 100-line safety limit, Unicode fractions, separate review rows, copy and CSV export. It never assumes generic `flour` is all-purpose flour or unqualified `brown sugar` is packed. It remains `noindex` until independently justified by keyword evidence.

The recipe scaler offers **exact common kitchen fractions** by default, or decimals by unchecking its fraction control. Unknown recipe quantities are preserved with review warnings. These features require no external API or extra hosting process.


## Main keyword ownership and SEO audit artifact

The homepage `/` is the only eligible landing page for the core `grams to cups` query. `/cooking/grams-to-cups/` remains usable, but `noindex` and internal card/paragraph links resolve to `/` to avoid competing primary SEO targets. Production index candidates: **62** out of 81 functional routes, after the 21-case editorial review.

The build also runs `scripts/keyword-audit.mjs`, validating all 2,300 supplied competitor ranking records and producing per-keyword/per-page classification files. Download them from the successful GitHub **Site build and tests** run → **Artifacts** → `grams-to-cups-seo-review`. The report output is excluded from `dist/` and from Git.

The source remains a **partial** competitor export. Mapping is algorithmic and requires editorial review before a URL is treated as a verified ranking opportunity.

## Food intent evidence and practical reference pages

The static build keeps 24 separate source-backed ingredient pages with both weight→volume and US cup fractions→gram reference charts. All 21 numerical weight pages have a common-cup proximity table with an explicit gram difference and a use-a-scale warning. CI checks these page sections on every build.

The Semrush analysis exports `seo-ingredient-intent.csv` as a fifth non-public report. It finds secondary exact-food keyword evidence for six of the 27 index candidates that lacked the original provisional URL mapping. All 21 formerly unresolved cases now have source-limited, explicitly recorded editorial dispositions (18 index-eligible, three noindex). Missing sample data is still unknown, not zero; this does not verify their ranking or search traffic.

## Numeric SEO quality gate

The keyword audit also writes `reports/seo-numeric-intent.csv` covering all 21 gram-to-cup amount URLs. Only 20 currently qualify with an observed Semrush KD≤29 term. The working `1000-grams-to-cups/` page stays noindex (observed minimum KD37); do not override this merely to raise sitemap size. Other food, guide and trust pages require separate editorial judgement; missing rows from an incomplete Semrush export are not proof of no traffic.
