# Grams & Cups — Cooking Measurement Converter

A complete, browser-local, source-backed cooking conversion website. **One implementation, one production release**: no accounts, no database, no paid API and no scheduled content generation.

**This is the dedicated site repository `garrison2025/Grams-to-Cups`.** It supersedes the earlier integration assumption in the planning document that the code would be added to `Convert-Units`. That older repository is left untouched.

## Finished functional scope

- **13 Cooking tools:** grams ↔ cups, grams ↔ tablespoons, cups ↔ tablespoons, mL ↔ US tablespoons, US tablespoons ↔ mL, US cups ↔ US fluid ounces, US fluid ounces ↔ US cups, half-measurement fraction calculator and recipe scaler. The main converter also supports teaspoons, mass ounces, kilograms and milliliters via unit selection.
- **24 documented ingredients**, each including original measurement, quantity, state, method, source URL, review date and limitation. The data are recipe-chart estimates, **not physical density constants**.
- **21 numerical comparison pages**, **24 ingredient-specific pages**, **10 ingredient+number pages**, 3 printable chart pages, 3 measuring guides, source methodology and cooking hub; **76 Cooking routes**, plus independent homepage and About/Privacy/Contact (80 static HTML pages).
- Free calculator with mixed-number fraction input, US and metric cup standards, swap/reset/copy/share/print, URL-state sharing, ingredient search, recipe serving scaling and safe CSV export.
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

**Publication policy:** All 76 Cooking routes are functional; 13 have `noindex` by default because the supplied partial keyword and page evidence does not directly establish an independent SEO target. That is **not a feature omission**: users can still navigate, calculate, print and share those tools/pages. Main production sitemap holds **67 approved page candidates including home/legal pages**, rather than dumping every possible numeric URL into Google.

Avoid cloning third-party prose. Original calculation tools and source-backed explanatory content are the product.

## Data model and accuracy

`src/ingredients.json` contains 24 ingredient **recipe-reference** entries from the [King Arthur Baking Ingredient Weight Chart](https://www.kingarthurbaking.com/learn/ingredient-weight-chart) (reviewed 2026-11-22). It is not one universal grams↔cups factor.

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
tests/site.test.mjs          Calculation/data/roundtrip regression tests
research/semrush-us-2300-sample.csv  User-provided partial Semrush exports
.github/workflows/ci.yml     Preview + production test builds
dist/                        Generated output (not committed)
```
