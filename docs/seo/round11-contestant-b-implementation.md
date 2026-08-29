# StudyArena round 11 — Contestant B · implementation record

**Source file:** `docs/seo/2 studyarena-round11-contestant-b.md`
**Reviewed against:** the Architech Next.js 16 implementation as of 29 Aug 2026
**Implementation date:** 29 August 2026
**Decision authority:** `docs/seo/seo-recommendation-decision-register.md` (round-11 register)
**Depends on:** `docs/seo/round11-contestant-a-implementation.md` (sitemap index and deterministic `lastmod`)

Contestant B's thesis is the same as A's but sharper: you do not beat a fifteen-year-old portal on head terms, you beat it on **project/society depth** — sold prices, RERA numbers, quarter-by-quarter trends — where portals are thin. The recommendation is sound. Most of what it asks for is data that Architech does not yet have, so this pass implements the *gates and contracts* that make that data safe to publish later, plus the schema and canonical corrections that are true today.

---

## Decision legend

| Decision | Meaning |
|---|---|
| **Already implemented** | Present before this review; verified, not re-built. |
| **Implemented** | New code shipped in this pass. |
| **Adapt** | Goal kept, mechanism changed to fit the architecture or Google policy. |
| **Gated** | Correct, but needs verified data, accounts, rights, or legal review. |
| **Reject** | Creates a policy, quality, or performance risk. |

---

## §1 — Architecture

**Decision: Mostly already implemented. Facet gate and pagination canonical implemented.**

The proposed tree is `/mumbai/` → `/mumbai/andheri-west/` → `/mumbai/andheri-west/3-bhk-flats/` (indexable facet) → `/mumbai/andheri-west/lodha-eternis/` (project) → `/property/12345-…/`.

Architech routes `/buy/{city}/` → `/buy/{city}/{locality}/` → `/listing/{id}/`. The rules the document attaches to it are honoured: static, lowercase, no query strings in indexable URLs.

### 1a. "Index a facet only if it has ≥5 live listings AND real search volume" — **Implemented**

This was the single largest gap. `client/src/lib/seo/facets.ts` was a stub: it hardcoded `maxCombinationSizeForIndexing: -1` and `evaluateFacetIndexability()` accepted `query`, `filters` and `sort` and then deliberately ignored all three to return `"rejected"`. The rule existed as a comment, not as logic.

It is now a real, evaluable gate. A facet qualifies only when it clears **every** bar:

| Bar | Why |
|---|---|
| ≥5 live listings | Below this it is a thin filter shell; indexing it is index bloat. |
| Distinct supporting content | A re-filtered card grid is not a page. |
| Evidenced demand | Search Console impressions or documented keyword research. |
| Stable, parameter-free URL | `?filters=…` can never qualify, however much inventory it holds. |
| Parent link | An orphan page is a doorway page. |

Two design choices worth recording:

**Demand is an input, not an assumption.** The gate takes `hasDocumentedDemand` and rejects when it is false. With no Search Console data behind a combination, that flag stays false and the gate stays shut. The gate is *ready*, not *open* — which is exactly the register's instruction to "implement a future qualified facet gate, not blanket indexing."

**All failed reasons are reported, not just the first.** Short-circuiting invites incremental bypass; seeing the full gap does not.

The legacy `(query, filters, sort)` signatures are preserved and still reject unconditionally — a `/search?...` URL is by definition parameterised, so it has no stable URL and no evidenced demand. That keeps the existing contract intact while the real gate does the work.

### 1b. "Paginated pages get self-canonical (never canonical to page 1)" — **Implemented as contract; see the §1c caveat**

Canonicalising page 2 → page 1 tells Google pages 2..N are duplicates of page 1, so anything discovered only on a deeper page is dropped. That is a real and commonly-missed failure.

`paginatedCanonicalUrl(path, page)` in `client/src/lib/seo/urls.ts` encodes the correct rule: page 1 → the clean URL, page N → itself with `?page=N`. It is exposed to facet pages as `facetCanonicalUrl()` so a qualified facet gets a correct self-canonical by construction. It is covered by tests for the boundary cases (page 0, negative, `NaN`, fractional pages).

### 1c. `/search/` keeps its static canonical — **Adapt, deliberately not changed**

`/search/` currently sets `canonical: searchUrl()`, so `/search/?page=2` canonicalises to page 1 — the anti-pattern above. It was left in place for three reasons:

1. `/search/` is `noindex,follow`, and `Disallow: /search/` in `robots.txt`. The canonical has no indexing effect, and Google cannot crawl the deeper pages anyway.
2. Making the canonical request-accurate requires `generateMetadata({ searchParams })`, which converts the route from prerendered to dynamic.
3. That conversion breaks `performance/budgets.json`, which asserts a prerendered HTML artifact at `.next/server/app/search.html`. Re-baselining a performance budget to fix a canonical that is inert on a `noindex` page is a bad trade.

**Trigger to revisit:** the moment `evaluateFacetGate()` qualifies a combination, that facet becomes a real indexable route with pagination — and it must use `facetCanonicalUrl()`. The helper is tested and ready so that work is a wiring change, not a design decision.

---

## §2 — The wedge: project pages

**Decision: Gated. This is a data dependency, not a code gap.**

The document wants per-society pages with RERA numbers, 8-quarter price/sq ft trend tables, actual sold prices with month, rental yield, named distances in minutes, resident reviews, floor plans and a video tour. There is no `Project` model in `prisma/schema.prisma` (models are City, Locality, BrokerOrganization, User, BrokerUser, ReraRecord, Listing, PropertyMedia, Lead, SavedSearch, AuditEvent).

Building the routes before the data would produce exactly what §7 warns against — thin, near-identical pages. The round-11 register is explicit: add project pages "only when verified inventory and unique local evidence support them; do not mass-create empty society pages."

**The 150–300 project page target in the 90-day plan is rejected as a quota.** Architech expands on evidence, not on a page count. A fixed quota is how scaled-content-abuse problems start.

What the data blocks need before they can ship:

| Block | Blocker |
|---|---|
| RERA registration + possession + builder | Official state-source access and correct entity matching |
| 8-quarter price/sq ft trend | A real transaction/sold-price history, with methodology |
| Actual sold prices with month | Government IGR data or verified broker-reported sales |
| Rental yield %, avg 2BHK rent | Derived from real rent + sale pairs |
| Distances in minutes to named places | A routing/isochrone source, not straight-line guesses |
| 3–5 genuine resident reviews | Consented, moderated submissions |
| Floor plans, original photos, video tour | Media rights, moderation, storage activation |

---

## §3 — Schema

**Decision: Two corrections implemented; the rest is accurate already or gated.**

| Recommendation | Treatment |
|---|---|
| `RealEstateListing` + `datePosted` | **Gated.** `Listing.publishedAt` exists in Prisma but fixtures carry no publication date. Emitting an invented `datePosted` is worse than omitting it. `dateModified` already ships from `meaningfulUpdatedAt` (file 1). |
| `dateModified` | **Already implemented** (file 1). |
| `floorSize` with `unitCode: "FTK"` | **Implemented.** Was `unitText: "sq ft"` only. `unitCode` is the machine-readable UN/CEFACT code; both now ship, since `unitCode` is what consumers parse and `unitText` is the human label. |
| `BreadcrumbList` on every page | **Already implemented.** |
| `ItemList` on locality/facet pages | **Implemented.** Locality pages visibly render a list of homes and were not describing it. `ItemList` now ships with `numberOfItems` and one `ListItem` per listing. It asserts **only ACTIVE listings** — a sold or non-public listing is not part of the list the page publishes, and claiming otherwise would make the markup false. |
| `FAQPage` on project pages | **Gated** on project pages existing (§2), and used only for visible, editorially reviewed FAQs — never to manufacture snippets. |
| `Organization` + `sameAs` | **Gated.** `sameAs` needs real profile URLs; inventing them is worse than omitting them. |
| `RealEstateAgent` with office address + RERA agent number | **Gated** on a real registered office and agent registration. |
| `VideoObject`, `ImageObject` on floor plans | **Gated** on real, rights-cleared media. |

---

## §4 — Technical non-negotiables

**Decision: Already implemented, with one dependency on file 1.**

| Recommendation | Treatment |
|---|---|
| SSR/SSG, not client-side rendering | **Already implemented.** Every public route prerenders; a raw-HTML smoke suite protects it. |
| LCP < 2.5s, INP < 200ms, CLS < 0.1 | **Already implemented** as route budgets and Core Web Vitals targets in `performance/budgets.json`. |
| Hero AVIF/WebP, `fetchpriority="high"`, no lazy-loading on it, dimensions set | **Already implemented.** |
| Sitemap index split by type with accurate `lastmod`, referenced in robots.txt | **Already implemented — file 1.** `/sitemap.xml` is an index over `pages` / `cities` / `localities` / `listings` / `guides`, `lastmod` sourced from entity data, referenced from `robots.txt`. |
| Expired listings: keep URL, mark "Sold", show alternatives; never mass-404; never redirect all to the locality page; `410` only when there is nothing to say | **Already implemented.** `client/src/lib/seo/lifecycle.ts` maps each state to 200 / 301 / 404 / 410 — `SOLD` stays 200 but `noindex`, `DUPLICATE` 301s to the canonical listing, `EXPIRED`/`REMOVED` 410, and `continuingSeoValue` keeps a valuable expired page visible with alternatives. There is no blanket redirect-to-locality. |
| Monthly log-file / crawl-stats review | **Gated** on server log and Search Console access. Until then, coverage is monitored through the route registry, segmented sitemaps and the Search Console audit script. |

---

## §5 — Content nobody links to a portal for

**Decision: Calculators already implemented; the data report is gated.**

Stamp-duty/registration, EMI/affordability and rental-yield calculations exist behind `/api/cost/ownership` and `/api/investment/metrics`, served by `/home-loan/` and `/investment/`, positioned as educational with transparent assumptions and no personalised advice. Making them **state-wise** is the open piece and needs each state's duty and registration schedule verified — inventing statutory rates on a money-adjacent page is a real harm, so it stays gated.

The quarterly "[City] Rental Yield & Price Index" is the strongest link-earning idea in the document and matches Architech's authority/outreach contracts. It cannot ship before the underlying transaction data exists. Published methodologically — source, period, geography, sample size, update date — or not at all.

---

## §6 — E-E-A-T

**Decision: Partly implemented; the trust anchors that matter most are gated.**

Editorial and listing-verification policies, data sources, a correction path, privacy/terms and promoted-content labelling are all documented and surfaced. Locality descriptions are not mass-generated: they are registry-driven with hand-authored editorial fixtures for Ahmedabad.

**Gated — cannot be done in code:** named authors with real RERA agent IDs and photographs; a real office address and local phone on every page; a verified Google Business Profile. Fabricating any of these on a site Google treats as money-or-life is a direct policy risk.

---

## §7 — What NOT to do

**Decision: All six already rejected by the existing registers.**

Doorway pages ("property in <every pincode>"), 500 near-identical locality pages, fake reviews in schema, hidden keyword-stuffed footers, bulk guest-post buying, and exact-match anchor spam are each recorded as unacceptable in `docs/seo/seo-recommendation-decision-register.md` and `docs/seo/study-arena-round12-decision-register.md`. The quality gate in `client/src/lib/seo/page-quality.ts` enforces the thin-page prohibition in code.

Notably, the document's warning — "mass-generated thin locality pages are the #1 way new property sites get flattened" — is the same risk that makes its own 300-project-page quota unsafe. The quota is rejected; the depth-first instinct behind it is kept.

---

## What shipped in this pass

| Change | File(s) |
|---|---|
| Real qualified facet gate (≥5 listings, unique content, evidenced demand, stable URL, parent link) | `client/src/lib/seo/facets.ts` |
| Self-canonical pagination helper, exposed to facet pages | `client/src/lib/seo/urls.ts`, `client/src/lib/seo/facets.ts` |
| `ItemList` on locality pages (ACTIVE listings only) | `app/buy/[city]/[locality]/page.tsx` |
| `floorSize` gains machine-readable `unitCode: "FTK"` | `app/listing/[id]/page.tsx` |
| Tests: facet gate (13) and pagination canonical (4) | `client/src/lib/seo/facets.test.ts` |

## Verification

```
pnpm check    clean
pnpm lint     clean
pnpm test     611 passed (75 files) — was 598 before this pass
pnpm build    clean; all sitemap and locality routes prerendered
```

Rendered-HTML checks against a production build:

- `/buy/ahmedabad/paldi/` → `ItemList "Homes in Paldi, Ahmedabad"`, `numberOfItems: 1`
- `/buy/mumbai/bandra-west/` → `numberOfItems: 5`, 5 entries
- `/buy/bengaluru/koramangala/` → `numberOfItems: 5`, 5 entries
- `/listing/garden-courtyard/` → `floorSize: { value: 1482, unitCode: "FTK", unitText: "sq ft" }`
- City hubs unchanged — `ItemList` added only where a list is actually rendered

Facet gate behaviour:

- clears all five bars → `qualified`
- 4 listings (one below threshold) → `rejected`; exactly 5 → `qualified`
- 12 listings but no evidenced demand → `rejected`
- all five bars failing → 5 reasons reported, not 1
- `listingCount: NaN` → treated as 0, not passed
- rejected pages still `follow: true`, so crawl equity reaches the listings they link to

## What remains pending

1. **Project/society pages** — the whole §2 wedge, blocked on RERA, sold-price, yield and distance data.
2. **`datePosted`** — needs `publishedAt` from the moderation workflow.
3. **State-wise stamp duty and registration** — needs verified statutory schedules.
4. **Quarterly rental-yield and price index** — needs transaction data before it can be pitched to journalists.
5. **Named authors, office address, RERA agent IDs, GBP** — real-world trust anchors.
6. **`sameAs`, `VideoObject`, `ImageObject` on floor plans** — real profiles and rights-cleared media.
7. **Self-canonical on `/search/`** — deferred deliberately; see §1c. Becomes required the moment a facet qualifies.
8. **Monthly crawl-log analysis** — needs server log and Search Console access.

## Status

**File 2 of 11 — complete.** Every code-completable recommendation is implemented, verified against a production build, and covered by tests. The strategic heart of this document — project-page depth — is a data dependency recorded as eight explicit gates above, not something code can supply.

Next in queue: `docs/seo/3 studyarena-round11-contestant-c.md`.

## References

[1]: https://developers.google.com/search/docs/essentials/spam-policies "Google Search Central: Spam Policies"
[2]: https://developers.google.com/search/docs/specialty/ecommerce/pagination-and-incremental-page-loading "Google Search Central: Pagination and incremental page loading"
[3]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google Search Central: Introduction to structured data"
[4]: https://developers.google.com/search/docs/appearance/structured-data/carousel "Google Search Central: Carousel (ItemList) structured data"
