# One-time launch and maintenance runbook

This repository was created as a standalone website at the owner's direction. It does **not** write to the unrelated Convert-Units repository and does not assume a purchased custom domain.

## Connect Cloudflare Pages

1. Workers & Pages → Create application → Pages → Connect to Git → select \`garrison2025/Grams-to-Cups\`.
2. Production branch \`main\`; Framework preset **None**; Build command \`npm run build\`; Output directory \`dist\`; Node runtime **22+**.
3. Deploy once with indexing disabled. Page functions, navigation, source citations, recipe scaling, search, mobile layout and 404 must be checked at the actual preview URL.
4. Choose the actual stable public hostname (your verified custom domain or stable project.pages.dev). Set \`SITE_URL=https://YOUR-EXACT-HOST\` in Cloudflare Pages production **build-time environment variables** (no trailing slash or path). Do not use a transient hash deployment URL. Use the hostname that resolves live content.
5. Verify all canonical destination URLs resolve at that hostname. Verify 404, robots.txt, no console errors, static assets, reference claims, accessible mobile calculation, ingredient search and the output from \`npm run build\`.
6. Only after all checks, set \`PUBLIC_INDEX_APPROVED=true\` for the production environment and redeploy \`main\`. Cloudflare injects \`CF_PAGES_BRANCH\`; don't set it manually in dashboard.
7. Confirm production \`/sitemap.xml\` exists, URLs use \`SITE_URL\`, all index-eligible pages carry canonical/index, and excluded candidates remain noindex. Submit sitemap to Google Search Console only when the site is verified.
8. There are 81 generated HTML pages total: 77 Cooking routes and 4 site/core/legal routes. The 14 research-limited candidates still function but are excluded from sitemap.

Cloudflare previews should remain noindex. This is intentional, not a reason to enable indexing before QA.

## Quality gates in CI

\`npm run build\` automatically:

- Runs 12 Node tests: original reference weights, 24 ingredient data contracts, mass/volume distinction, cup definitions, numeric round trips, fractions, recipe scaling and CSV injection safety.
- Generates 81 static HTML pages, local conversion assets, a real 404 and index-aware robots/sitemap.
- Checks route count, unique title and H1, body text, canonical/noindex, key asset existence, internal links, batch workbench presence and 21/24/10 page-family counts.
- The GitHub workflow tests both preview and production publication configurations. Its \`https://example.com\` value is synthetic **only for CI**, never the site's production domain.

Any failing gate means the release is not complete. Do not disable audits to produce a green build.

## Source/reference changes

1. Find the ingredient in \`src/ingredients.json\`.
2. Review the original published source at \`sourceUrl\`, confirm amount/unit/grams, method and state. For King Arthur the original reference can be \`1 cup\`, \`1/2 cup\`, \`1/4 cup\`, or \`1 tablespoon\`: keep the **original pair**, never overwrite it with an assumed gram-per-cup.
3. Change the original measurement and review date, write an updated note as needed.
4. Add regression coverage in \`tests/site.test.mjs\` and run \`npm run build\`; inspect the ingredient page and source info.
5. Deploy after proof, not as a content publishing schedule.

For example, a published chart's \`water 1 cup = 227 g\` should remain labeled as a *recipe-reference weight*, not a physical-density claim.

## Search and page quality

The \`research/semrush-us-2300-sample.csv\` file retains supplied source observations with provenance. It is **partial** Semrush US export evidence, not all three domains' ranking keywords. Tentative URL suggestions are not automatic permission to create more SEO URLs. One search intent should have one best landing page.

The final site can calculate any positive input amount, but does not create a separate indexed URL for every imaginable number. Do not force noindex candidates into the sitemap merely to boost page count.

## Ads / legal

No AdSense script, ads.txt or advertising consent mechanism is currently configured. Add them only if ownership verification, AdSense account/publisher ID and relevant privacy/consent requirements are satisfied. Don't create false verification codes. Ads must not overlap input controls or the answer panel.

## One-time handoff criteria

A site is **not** published merely because code was pushed: a real Cloudflare Pages project, stable hostname, environment gate, production sitemap, link checks and live-device checks are required. Record the final live URL and commit in the deployment log once verified.

There is no database, queue, account backend, paid API or recurring content job. Unplanned maintenance remains possible only if standards, browser behavior, source measurements, policies or a discovered defect change.

## Batch ingredient converter and recipe fractions

The local-only `/cooking/batch-converter/` supports grams ↔ cups for source-identifiable ingredients, 100-line safety limit, Unicode fractions, separate review rows, copy and CSV export. It never assumes generic `flour` is all-purpose flour or unqualified `brown sugar` is packed. It remains `noindex` until independently justified by keyword evidence.

The recipe scaler offers **exact common kitchen fractions** by default, or decimals by unchecking its fraction control. Unknown recipe quantities are preserved with review warnings. These features require no external API or extra hosting process.
