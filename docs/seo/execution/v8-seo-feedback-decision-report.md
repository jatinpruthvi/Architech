# Recommendation v8 SEO Feedback Decision Report
## What to keep, change, add, or correct from the attached SEO review

### Executive decision

The SEO review is strong and should be accepted as the foundation for v8. It correctly identifies that v7 had the right SEO principles but did not specify enough enforcement architecture. Recommendation v8 therefore keeps the complete v7 product and technology scope and adds a concrete **SEO control plane**: server-rendering contracts, canonical ownership, metadata services, structured-data generation, sitemap partitioning, crawlable-link enforcement, authority graph checks, freshness rules, faceted-navigation controls, lifecycle HTTP states, mobile search composition, and automated SEO observability.

A few feedback statements are corrected rather than copied literally. In particular, a `renderToStaticMarkup` test alone is not sufficient for a Next.js App Router/RSC production response; v8 uses raw HTML response tests plus Playwright/no-JavaScript checks. The feedback’s “Rich Results Test API” wording is also changed to local validators and scheduled validation workflows because Google documents the Rich Results Test primarily as a testing tool rather than a general public publishing API. The 2.5-second Core Web Vitals target remains the Google good target; slower India-network budgets are engineering fallback targets, not SEO-passing thresholds. Google’s current guidance confirms 50,000 URLs/50MB sitemap limits, meaningful `lastmod`, crawl-control for faceted URLs, and LCP/INP/CLS targets.[1] [2] [3]

## Decision matrix

| Feedback item | Decision | v8 decision and reason |
|---|---|---|
| Two-layer rendering contract | Keep and strengthen | All primary facts are in initial server HTML; client components enhance but never gatekeep. Add raw-response tests, no-JS tests, and route-boundary linting. |
| Server component boundary audit | Change implementation | Keep the goal, but combine raw HTML response assertions, Playwright with JavaScript disabled, and Next.js route tests. `renderToStaticMarkup` alone does not represent the full App Router/RSC response. |
| `(marketing)`, `(public)`, `(app)` route groups | Keep with clarification | Marketing may load motion; public SEO routes must avoid heavy motion; authenticated app is client-rich/noindex. A guide can be public SEO or marketing only by explicit route classification. |
| Primary facts list | Keep | Title, price/status, locality, property type, available BHK/area, broker/source, RERA state when known, and last update are server-rendered. Optional fields degrade gracefully. |
| `SeoPage` as canonical source | Keep | It is authoritative for page ownership, index policy, quality status, and canonical URL. Entity route builders remain pure and versioned. |
| One canonical generation service | Keep | Metadata, sitemap, JSON-LD, database, redirects, and audits use the same canonical builder. |
| Nightly canonical consistency check | Keep and expand | Run on every publish/change plus nightly full audit. Compare DB, HTML tag, sitemap, JSON-LD `@id`, redirects, and internal links. |
| Stable listing ID suffix and slug redirects | Keep | Stable public ID never changes; old valid slugs redirect to current canonical. |
| Metadata generation service | Keep | One typed generator per page type; no inline metadata construction. |
| Metadata formulas | Change | Use formulas as defaults, not mandatory literals. Do not put volatile or unsupported price/count claims in title when absent or stale. Avoid repetitive titles through uniqueness tests and editorial overrides. |
| 150-character meta-description limit | Change | Enforce a practical maximum and word-safe truncation, but do not describe 150 characters as a Google requirement. Store generated and final values; test uniqueness and pixel/truncation risk. |
| Metadata drift test | Keep | Compare rendered metadata to the same entity snapshot used in visible content and JSON-LD. |
| Typed JSON-LD generators | Keep | Pure generators accept the already-loaded entity view model and never query the database. |
| Canonical URL as JSON-LD `@id` | Keep with entity-type validation | Use canonical URL IDs for page entities; use stable fragment IDs for nested objects where necessary. |
| `RealEstateListing` example | Change cautiously | Use only Schema.org/Google-supported types and properties that accurately apply. Do not assume every proposed type yields a rich result. Visible data must match markup. |
| Rich Results Test API | Change | Use Rich Results Test/Schema Markup Validator during development, local JSON-LD/schema validation in CI, and Search Console rich-result reports after launch. Do not depend on an undocumented public API. |
| Visible-content JSON-LD match test | Keep | Compare structured values to visible page facts; omit unsupported/unknown properties instead of inventing them. |
| Sitemap 50,000 URL/50MB limits | Keep | Google documents these limits.[1] Use 10,000-URL partitions for operational headroom. |
| ID-range/date partitioning | Change | Keep deterministic partitions, but use a stable hash/range strategy that avoids rewriting too much while supporting deletions and rebalancing. Do not promise that old partitions are never rewritten. |
| `lastMeaningfulEdit` | Keep | Use it for `lastmod`; do not update for cosmetic or unrelated changes. Google recommends accurate significant-update timestamps.[1] |
| Image/video sitemap claims | Keep with validation | Include only publicly accessible, canonical media associated with visible pages; omit incomplete or unverified media. |
| Sitemap index test | Keep and expand | Check 200 status, canonical eligibility, robots policy, no accidental noindex, UTF-8, absolute URLs, partition limits, and freshness. |
| ESLint rule against `router.push` | Change | Do not ban `router.push` globally. Enforce real `<a href>` for public crawlable navigation; allow client navigation for private/app state and non-indexable interactions. |
| JS-disabled orphan crawl | Keep | Add scheduled no-JS crawl and CI smoke tests for representative routes. |
| Link budget per page type | Keep with flexible thresholds | Use minimum useful internal links and maximum clutter thresholds by template; do not force artificial links. |
| Click-depth monitoring | Keep | Flag important pages deeper than agreed thresholds and orphan pages. |
| Qualified intent quality gate | Keep and strengthen | Add inventory, demand, originality, evidence, freshness, links, and index policy checks. Degrade to noindex when quality falls below threshold. |
| Automatic noindex on degraded pages | Change | Use a reviewed state machine with warning, pending review, noindex, redirect, 404/410, and restore states. Do not automatically noindex during brief data delays without grace periods. |
| 60-second IndexNow loop | Change wording | Use event-driven notification promptly after validated meaningful changes, with retries/backoff and deduplication. Do not promise indexing within 60 seconds. |
| Parameter classification | Keep | Maintain allowlist/denylist/normalization for filters, sort, map viewport, tracking, pagination, and user state. |
| Canonical upward assignment | Keep with caution | Canonicalize duplicate/low-value filters to the closest qualified page; do not canonicalize a genuinely distinct, approved intent page upward. |
| HTTP status per listing state | Keep | Active pages 200; true successor 301; unavailable without successor 404/410 according to policy; temporary states may be 200 with visible status if useful. |
| Redirect-map architecture | Keep | Store old URL, target, reason, created time, expiry/review, and loop status. |
| Entity normalization for AI search | Keep | Canonical names, aliases, IDs, source, date, and entity relationships are required. |
| Key facts ordering | Keep | Put answer-ready facts and evidence near the top while preserving good UI. |
| `llms.txt` generation | Change priority | It may be generated as an optional supplemental index, but HTML, links, sitemaps, robots, metadata, and content quality remain primary. |
| Breadcrumb generation service | Keep | Typed service emits visible breadcrumbs and JSON-LD from the same parent graph. |
| Noindex page 2+ | Reject as a blanket rule | Do not automatically noindex all pagination. Keep crawlable paginated URLs when they provide useful unique inventory and controlled canonicals; noindex or consolidate only when policy and quality justify it. |
| Server-rendered first page | Keep | The first collection page contains useful HTML and stable listing links. |
| Guide mandatory schema | Keep | Add author/reviewer, source evidence, methodology, update/review dates, intent, and related entities. |
| 90-day guide review | Change | Use 90 days for high-volatility guides, but choose review intervals by topic volatility. Never change dates without substantive review. |
| CLS prevention lint rule | Keep with implementation refinement | Use aspect-ratio/media component contracts, visual regression, and runtime metrics. A pure lint rule cannot detect all CLS. |
| LCP priority image | Keep with caution | Prioritize the actual LCP candidate using `fetchPriority`/framework image behavior; do not preload every image or hardcode a non-LCP asset. |
| Optimistic filter update | Keep with correction | Show immediate filter state and skeleton, but INP is measured through the next paint of the interaction and cannot be declared outside INP merely because a skeleton appears. |
| Separate mobile composition | Keep | Do not render the desktop map panel on initial mobile; load map on explicit user action. |
| 44px touch targets | Keep as internal target, correct claim | Use 44×44 CSS pixels as a strong product target; do not call it universally mandated by WCAG. |
| Fast 3G/4x PR test | Keep with layered testing | Use CI smoke tests plus real-device lab tests and field RUM. Lab thresholds are not a substitute for p75 field Core Web Vitals. |

## v8 implementation principle

The accepted feedback becomes a **single SEO control plane** rather than disconnected tests:

```text
canonical entity/page registry
→ server-rendering contract
→ metadata generator
→ JSON-LD generator
→ visible-content validation
→ sitemap/index policy
→ internal-link graph
→ freshness/lifecycle state
→ Search Console/Bing/RUM feedback
→ quality and authority dashboard
```

## References

[1]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap "Google Search Central sitemap guidance"
[2]: https://developers.google.com/crawling/docs/faceted-navigation "Google guidance for faceted navigation URLs"
[3]: https://developers.google.com/search/docs/appearance/core-web-vitals "Google Core Web Vitals guidance"
[4]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google structured data guidance"
[5]: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics "Google JavaScript SEO basics"

## Final decision

Accept the SEO review as the basis for v8. Keep the principles and almost all architecture. Change only implementations that are too absolute, unsupported, or risky: the server-render test method, metadata length wording, structured-data validation API assumption, sitemap partition immutability claim, blanket noindex for pagination, automatic degradation behavior, IndexNow timing wording, global router-push linting, optimistic-INP explanation, and the WCAG 44px claim.
