# StudyArena round 11 — Contestant A · implementation record

**Source file:** `docs/seo/1 studyarena-round11-contestant-a.md`
**Reviewed against:** the Architech Next.js 16 implementation as of 29 Aug 2026
**Implementation date:** 29 August 2026
**Decision authority:** `docs/seo/seo-recommendation-decision-register.md` (round-11 register) and `docs/seo/study-arena-round12-decision-register.md`

The source document is a strong, Google-aligned plan. Most of its substance was already part of Architech's architecture. This record states what that document changed in code, what it deliberately did not change, and what cannot be completed by code at all.

---

## Decision legend

| Decision | Meaning |
|---|---|
| **Already implemented** | Present in the codebase before this review; verified, not re-built. |
| **Implemented** | New code shipped in this pass. |
| **Adapt** | Goal kept, mechanism changed to fit the existing architecture or Google policy. |
| **Conditional / gated** | Correct, but requires verified data, accounts, rights, or legal review before it can go live. |
| **Reject** | Creates a policy, quality, or measurement risk. |

---

## §1 — Build the site around local search intent

**Decision: Already implemented (adapted).**

The document proposes `/buy/…`, `/rent/…`, `/projects/…`, `/builders/…`, `/localities/…`, `/guides/…`.

Architech routes `/buy/` → `/buy/{city}/` → `/buy/{city}/{locality}/`, with `/guide/…` and `/listing/{id}/` alongside. Rent is carried as a query dimension (`?intent=`, parsed by `client/src/lib/search/parse-query.ts`) rather than as a parallel URL tree.

**Why rent is not a URL segment:** creating `/rent/{city}/{locality}/` duplicates the same inventory under a second canonical path. Google would then choose between two near-identical pages instead of consolidating signal on one. Splitting intent into URLs is only justified once there is genuinely distinct rent content (deposit norms, lease terms, furnishing stock, rental yield) — at which point it becomes a content decision, not a routing one.

The document's own rule is honoured: **do keyword research before defining URLs**, and create indexable pages only where there is enough useful information or active listings. The city/locality hierarchy is registry-driven, so adding a market is one edit in `client/src/lib/cities.ts`.

## §2 — Make every locality page genuinely better

**Decision: Already implemented; quality gate retained.**

Locality pages render live listings, aggregated price facts (`client/src/lib/realestate/locality-intel.ts`), a visible "based on N listings · updated on {date}" line, a source trail, RERA coverage, trust score, commute stops, and PIN codes.

The prohibition on "thousands of pages containing only swapped place names" is enforced by `client/src/lib/seo/page-quality.ts`: a page needs editorial approval, a stable canonical, a parent link, distinct data, methodology, source/update metadata, and a minimum evidence threshold before it can be indexed. Failing pages stay useful to users but are `noindex,follow` and excluded from sitemaps.

## §3 — Make listings trustworthy and indexable

**Decision: Already implemented; one accuracy bug fixed.**

Stable listing URLs and the full lifecycle matrix (200 / 301 / 404 / 410) already exist in `client/src/lib/seo/lifecycle.ts`, with `DUPLICATE → 301 canonical` and `EXPIRED → 410` (or 200-`noindex` where a page has verified continuing value).

| Sub-recommendation | Treatment |
|---|---|
| Permanent descriptive URL `/property/2-bhk-apartment-whitefield-prestige-lakeside-18425/` | **Adapt.** Architech keeps stable IDs (`/listing/{id}/`). Rewriting ~336 canonical URLs would discard existing Search Console history and canonicity for a cosmetic gain. `Listing.slug` and `Listing.stableId` already exist in `prisma/schema.prisma` for a future descriptive-slug rollout done behind 301s. |
| RERA number with official verification link | **Conditional.** The provenance and correction workflow exists (`client/src/lib/rera/`); emitting a *verified* link requires the official state source and correct entity matching. |
| Original photos, floor plan, geotagged captions | **Conditional.** Media rights, moderation, EXIF and takedown contracts are the gate (`client/src/lib/media/`). |
| Last verified date, availability status, similar nearby properties | **Already implemented** (trust score, lifecycle status, `getRelatedListings` city-scoped). |
| Possession / listing dates | **Implemented** — see `dateModified` below. |

## §4 — Control faceted navigation

**Decision: Already implemented.**

`client/src/lib/seo/facets.ts` rejects every query + filter + sort + page combination for indexing in Phase 1. `app/robots.ts` disallows `/search/` and `/saved/`. The document's warning is explicitly encoded: arbitrary facets are `noindex`, and legitimate locality/BHK pages are **not** canonicalised up to a broad city page.

## §5 — Get technical SEO right from launch

**Decision: Mostly already implemented. Two items implemented in this pass.**

Already in place: SSR/SSG for every public page, self-referencing canonicals, breadcrumbs, a custom 404, crawlable pagination via real `<a href>` links, WebP/AVIF with explicit dimensions, eager hero / lazy below-the-fold, route-level Core Web Vitals budgets, and a documented prohibition on the Indexing API for ordinary pages.

### 5a. XML sitemaps split by content type — **Implemented**

`lastmod` and segmentation were the two gaps in this recommendation.

`/sitemap.xml` is now a **sitemap index** pointing at one child sitemap per content type:

| Child sitemap | Contents | URLs (current build) |
|---|---|---|
| `/sitemap/pages.xml` | Home, national hub, requirements, list-property, about, contact, tools | 10 |
| `/sitemap/cities.xml` | `/buy/{city}/` hubs | 12 |
| `/sitemap/localities.xml` | `/buy/{city}/{locality}/` | 72 |
| `/sitemap/listings.xml` | `/listing/{id}/` (ACTIVE only) | 336 |
| `/sitemap/guides.xml` | `/guide/…` | 1 |

Why it matters: a flat sitemap makes Search Console report one blended coverage number, so a locality-fact problem hides inside a healthy average. Segmentation reports each content type separately, so a drop in indexed locality pages is visible the day it happens.

Implementation: `client/src/lib/seo/sitemap.ts` (segment registry, XML rendering, segmentation), `app/sitemap.xml/route.ts` (index), `app/sitemap/[segment]/route.ts` (children). `app/sitemap.ts` was removed: Next's `MetadataRoute.Sitemap` type can only describe `<urlset>` entries, so an index has to be a route handler.

Two routing details worth recording, both verified against Next 16:

- Child sitemaps live in a **directory** (`/sitemap/localities.xml`), not as a dotted filename (`/sitemap-localities.xml`). Next will not route a path whose last segment contains a dot to a dynamic route — the dotted form returns 404.
- An unknown segment returns a real **404** rather than an empty 200, so a typo in the index surfaces as a Search Console error instead of silently submitting nothing.

### 5b. Accurate `lastmod` — **Implemented**

`lastmod` is a factual claim about when a page changed. Stamping `new Date()` makes every URL claim "changed just now" on every deploy, which is the fastest way to have the field discounted. All dates now come from the entity that owns the page:

| Surface | Date source |
|---|---|
| Listings | `Property.meaningfulUpdatedAt` |
| Localities | the locality's aggregated-fact as-of date |
| City hubs | newest locality fact date inside that city |
| Guides | `Guide.updatedAt` |
| Standing pages | **none** — `lastmod` is omitted rather than invented |

This required a new contract field. `client/src/lib/properties.ts` now declares `meaningfulUpdatedAt?: string`, mirroring `Listing.meaningfulUpdatedAt` in `prisma/schema.prisma` — deliberately *not* `Listing.updatedAt`, which Prisma bumps on every write including a moderation touch. A content-change date and a row-write date are different facts.

All fixture dates derive from a single exported constant `FIXTURE_AS_OF_ISO` (`2026-08-26`), so listing freshness, locality facts and sitemap `lastmod` can never disagree, and no date-carrying surface reads the wall clock. The generator picks the visible label and the machine-readable date from one table entry, so "Updated 2 days ago" and `2026-08-24` cannot drift apart.

Verified output:

```xml
<sitemap>
  <loc>https://architech-demo.example.com/sitemap/localities.xml</loc>
  <lastmod>2026-08-26</lastmod>
</sitemap>
```

Every `lastmod` is a plain `YYYY-MM-DD` calendar date — never a clock timestamp.

## §6 — Add accurate structured data

**Decision: Already implemented; one field added.**

`WebSite` and `Organization` ship on every page from `app/layout.tsx`. Listing pages emit `RealEstateAgent`, `RealEstateListing`, `Residence`, `Offer` (with correct `businessFunction` for lease vs sale and `availability` mapped from lifecycle) and `BreadcrumbList`.

**Added in this pass:** `dateModified` on the `RealEstateListing` and `Residence` nodes, sourced from `meaningfulUpdatedAt`.

**Bug fixed:** the listing breadcrumb hardcoded Ahmedabad —
`{ name: "Ahmedabad", item: cityUrl("ahmedabad") }` — so all 336 dossiers across 12 cities published an Ahmedabad breadcrumb, and every internal link Google read from it pointed at the wrong city hub. It now resolves from the listing's own city. Verified on a Mumbai listing:

```
1. Home        -> /buy/…  (home)
2. Mumbai      -> /buy/mumbai/
3. Bandra West -> /buy/mumbai/bandra-west/
4. New launch 2 BHK near Bandra West -> /listing/bandra-west-buy-2bhk-1/
```

`FAQPage` is **not** added blanket-fashion. It is used only where visible, editorially reviewed FAQs qualify — adding it to manufacture snippets is a policy risk, per the round-11 register.

## §7 — Build authority locally

**Decision: Implemented as governance; publication is gated.**

The authority and outreach contracts exist (`client/src/lib/governance/authority.ts`, `seo/authority/off-page-authority-google-first-appendix.md`), including methodology disclosure and outreach provenance. Creating the linkable assets the document lists (locality price reports, rent-vs-buy and stamp-duty calculators, metro-impact reports, RERA trackers) requires verified source data first.

**Rejected outright:** paid link packages, private blog networks, comment spam, expired-domain tricks, and fake reviews. These are recorded as unacceptable in both existing registers.

## §8 — Establish real-world trust

**Decision: Partly implemented; the local-pack items are gated.**

Company details, editorial and listing-verification policies, data sources, a correction path, privacy/terms, and promoted-content labelling are all documented and surfaced (`docs/seo/phase-1-trust-surface.md`).

**Gated — cannot be done in code:** claiming and verifying a Google Business Profile for each eligible staffed location; collecting genuine consented reviews; displaying RERA registration verified against an official source. The codebase can expose consistent organisation details and governance; it cannot create a real business profile or real reviews. Fabricating either is a policy violation.

## §9 — Use internal links strategically

**Decision: Already implemented; cross-city linking bug fixed.**

Every listing links to its locality, city, and nearby relevant listings; guides link to commercial pages. The breadcrumb fix above is the substantive correction in this pass — it repaired the property → city and property → locality links for the 11 non-Ahmedabad cities.

## §10 — First 90 days and metrics

**Decision: Adopted, with the metric list corrected.**

The launch sequence (one city wedge, 100–200 high-intent keywords, URLs fixed before development, templates, Search Console and GA4 from day one) matches how Architech is built.

Tracked: indexed valuable pages (not total indexed pages), non-branded impressions and clicks, top-10 keywords by locality, qualified organic leads, listing freshness, crawl waste, relevant referring domains, and field Core Web Vitals.

**Rejected as promises:** guaranteed rankings, traffic-growth percentages, and "beat Housing.com" on national head terms. Domain authority and time-to-rank are not controllable inputs. Architech competes on locality depth, freshness, and provenance.

---

## What shipped in this pass

| Change | File(s) |
|---|---|
| Sitemap index + 5 segmented child sitemaps | `app/sitemap.xml/route.ts`, `app/sitemap/[segment]/route.ts`, `client/src/lib/seo/sitemap.ts` (new); `app/sitemap.ts` removed |
| Deterministic `lastmod` from entity data | `client/src/lib/seo/pages.ts`, `client/src/lib/seo/sitemap.ts` |
| `meaningfulUpdatedAt` content-date contract | `client/src/lib/properties.ts`, `client/src/lib/property-generator.ts` |
| Single fixture as-of constant | `client/src/lib/properties.ts`, `client/src/lib/realestate/locality-intel.ts` |
| Sitemap URL helpers (`sitemapIndexUrl`, `sitemapSegmentUrl`) | `client/src/lib/seo/urls.ts`, `app/robots.ts`, `client/src/lib/seo/monitoring.ts` |
| Listing breadcrumb resolved per city | `app/listing/[id]/page.tsx` |
| `dateModified` on listing JSON-LD | `app/listing/[id]/page.tsx` |
| Publish artifact copies all sitemaps | `scripts/materialize-static-publish.mjs` |
| Tests: segmentation, `lastmod` discipline, indexing gate | `client/src/lib/seo/sitemap-contract.test.ts` (rewritten), `client/src/lib/seo/urls.test.ts` |
| CI smoke coverage for 6 sitemap endpoints | `scripts/seo/raw-html-smoke.mjs` |

## Verification

```
pnpm check    clean
pnpm lint     clean
pnpm test     598 passed (75 files) — was 591 before this pass
pnpm test:seo SEO smoke passed for 14 routes and 6 sitemaps
pnpm build    /sitemap.xml static + 5 child sitemaps prerendered (SSG)
```

Runtime checks against a production build with `PUBLIC_INDEXING_ENABLED=true`:

- `/sitemap.xml` → HTTP 200, `<sitemapindex>`, 5 children
- `/sitemap/{pages,cities,localities,listings,guides}.xml` → HTTP 200, `<urlset>`, 10 / 12 / 72 / 336 / 1 URLs
- no trailing-slash redirects on any sitemap URL
- `/sitemap/bogus.xml` → HTTP 404
- `Content-Type: application/xml; charset=utf-8` on all six
- every `lastmod` a plain calendar date; none equal to the build date

With the indexing gate **off** (the default production build), all six endpoints still render valid, empty XML and advertise no URLs — a preview build never publishes URLs that every page is simultaneously marking `noindex`.

## What remains pending (not code-completable)

1. **Google Search Console / GA4 credentials** — contracts and the audit script exist; real property setup, sitemap submission and query data need the accounts.
2. **Google Business Profile** — one per eligible staffed, customer-facing location.
3. **Genuine reviews** — consented and moderated only.
4. **RERA verification links** — official state-source access and correct entity matching.
5. **Original photography, video, floor plans** — rights, moderation, and storage activation.
6. **Data-journalism assets and outreach** — the authority contracts are ready; publication and journalist relationships are external work.
7. **Field Core Web Vitals** — lab budgets are enforced; 75th-percentile field data needs real traffic.
8. **Descriptive listing slugs** — deferred deliberately; needs a 301 migration plan, not a rename.

## Status

**File 1 of 11 — complete.** All code-completable recommendations are implemented, verified, and covered by tests. Remaining items are activation gates recorded above and in `docs/seo/study-arena-round12-decision-register.md`.

Next in queue: `docs/seo/2 studyarena-round11-contestant-b.md`.

## References

[1]: https://developers.google.com/search/docs/fundamentals/seo-starter-guide "Google Search Central: SEO Starter Guide"
[2]: https://developers.google.com/search/docs/essentials/spam-policies "Google Search Central: Spam Policies"
[3]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap "Google Search Central: Build and submit a sitemap"
[4]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google Search Central: Introduction to structured data"
