

---

# Recommendation v8 — Accepted SEO Architecture Integration

This appendix is authoritative wherever it refines Recommendation v7. All v7 product, UI, motion, map, media, broker, RERA, security, privacy, lead, and first-phase capabilities remain mandatory.

## 1. SEO control plane

Recommendation v8 introduces one connected SEO control plane:

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

The purpose is to prevent drift between the database, visible HTML, metadata, JSON-LD, sitemap, internal links, redirects, and index policy.

## 2. Two-layer rendering contract

Every public listing, city, locality, project, RERA, broker, and guide page must put its primary facts in the initial HTML response. Depending on the entity and the available data, primary facts include title, price or price status, locality/city, property type, BHK, area, broker/source identity, RERA status when known, and last meaningful update.

Client components may add save, compare, map, filters, gallery, video, and lead interactions. They must never be required for search engines or users to discover the main facts, public links, or page purpose.

### 2.1 Route groups

```text
app/
├── (marketing)/          # home, about, methodology, selected guides
│   ├── layout.tsx        # motion providers, Lenis only here
│   └── ...
├── (public)/             # SEO pages, server-first, no heavy motion libraries
│   ├── buy/
│   ├── rent/
│   ├── listing/
│   ├── project/
│   ├── broker/
│   ├── rera/
│   └── guide/
└── (app)/                # authenticated/private interactive product
    ├── dashboard/
    ├── saved/
    ├── compare/
    └── broker/
```

Marketing routes may load GSAP, ScrollTrigger, Motion, Lenis, and optional R3F/Drei. Public SEO routes use light/no motion dependencies and server-render all key content. App routes are client-rich and `noindex`/authentication protected.

### 2.2 Enforcement

Use three layers of tests:

1. **Raw response test:** request representative routes and assert that initial response HTML contains the required facts, title, H1, canonical, breadcrumbs, and public links.
2. **JavaScript-disabled Playwright test:** disable JavaScript and verify that the page remains understandable, navigable, and useful.
3. **Component contract test:** verify that server view models contain required fields and that client components cannot become the only source of primary facts.

A `renderToStaticMarkup` test may support pure component tests, but it is not the sole proof of a complete Next.js App Router/RSC response.

## 3. Canonical URL source of truth

`SeoPage` is the source of truth for every public SEO URL:

```text
canonicalUrl
pageType
primaryEntityId
indexPolicy
qualityStatus
robotsDirective
parentEntityId
lastMeaningfulEdit
```

One typed `buildCanonicalUrl(entity, pageType)` function is used by route builders, `generateMetadata`, sitemap generation, JSON-LD `@id`, redirects, internal links, and the SeoPage writer. Every canonical is normalized for host, protocol, trailing slash, case, locale, and path grammar.

### 3.1 Canonical consistency job

Run after every meaningful publish/update and nightly for the complete inventory:

```text
SeoPage expected canonical
↔ live HTML canonical tag
↔ sitemap <loc>
↔ JSON-LD page @id/url
↔ redirect map
↔ internal-link targets
↔ index policy
```

Mismatch creates an operations task with URL, expected value, observed value, page type, entity ID, and first-seen timestamp.

### 3.2 Stable listing URLs

Listing URLs contain a stable public ID suffix. If a broker changes the human-readable slug, the old URL redirects to the current canonical URL. The stable ID never changes. Redirect records include reason, creation date, target, status, loop detection, and review/expiry policy.

## 4. Metadata generation service

No page constructs metadata inline. Use typed generators:

```ts
generateListingMetadata(listingView): PageMetadata
generateLocalityMetadata(localityView): PageMetadata
generateCityMetadata(cityView): PageMetadata
generateIntentMetadata(intentView): PageMetadata
generateProjectMetadata(projectView): PageMetadata
generateBrokerMetadata(brokerView): PageMetadata
generateGuideMetadata(guideView): PageMetadata
```

Each generator returns title, description, Open Graph, social card, robots, canonical, alternates, and relevant media from the same entity view model used by the page.

### 4.1 Metadata rules

Use formulas as defaults, not mandatory literal templates. For example:

```text
{BHK} BHK {PropertyType} for {Sale/Rent} in {Locality}, {City} — ₹{Price} | {Brand}
{Count} Properties for {Sale/Rent} in {Locality}, {City} — {PriceRange} | {Brand}
Properties for {Sale/Rent} in {City} — {LocalityCount} Localities | {Brand}
```

If BHK, price, count, or range is unavailable, omit it rather than inventing or displaying a stale claim. Descriptions are word-safe truncated to the configured product maximum; 150 characters is a practical constraint, not a Google requirement. Test uniqueness, duplication, stale values, and visible-content agreement.

A Playwright metadata drift test compares title/description/canonical/robots to the same entity snapshot rendered on the page. Cache revalidation must update both page facts and metadata.

## 5. Structured data service

Use pure typed JSON-LD generators that receive the already-loaded view model and never query the database. Use stable page canonical URLs for page-level `@id`; use stable fragments for nested entities where appropriate.

Include only accurate properties that are visible or clearly supported. Do not add a type or property merely because it may produce a rich result. Google states that structured data should describe visible page content and that fewer complete, accurate properties are preferable to many inaccurate ones.[4]

### 5.1 Page graph

```text
WebSite/Organization
→ BreadcrumbList
→ page entity
→ project/listing/broker/RERA relationships
→ ImageObject/VideoObject where visible
→ ItemList only when the visible collection is represented accurately
```

### 5.2 Validation

CI uses local schema/JSON-LD parsing and contract tests. Development uses Google Rich Results Test and Schema Markup Validator where applicable. After deployment, monitor Search Console rich-result reports and URL inspection workflows. Do not depend on an undocumented public “Rich Results Test API.”

Visible-content tests compare key values such as price, currency, area, locality, BHK, availability, broker name, image URLs, dates, and RERA status. Missing data is omitted from JSON-LD.

## 6. Sitemap architecture

Google documents a per-file limit of 50,000 URLs or 50MB uncompressed.[1] Use operational partitions of approximately 10,000 URLs:

```text
/sitemap.xml
/sitemaps/cities-{partition}.xml
/sitemaps/localities-{partition}.xml
/sitemaps/intents-{partition}.xml
/sitemaps/projects-{partition}.xml
/sitemaps/listings-active-{partition}.xml
/sitemaps/brokers-{partition}.xml
/sitemaps/rera-{partition}.xml
/sitemaps/guides-{partition}.xml
/sitemaps/images-{partition}.xml
/sitemaps/videos-{partition}.xml
```

Use deterministic ID/hash/range partitions. The implementation may rewrite a partition when entities are deleted, reclassified, or rebalanced; it must not assume old partitions can never change.

### 6.1 `lastmod` policy

Use `SeoPage.lastMeaningfulEdit`, not generic `updatedAt`. For listings, meaningful changes include price, description, status, availability, important facts, or new public media. Cosmetic formatting, unrelated broker profile edits, or a refreshed related-listings panel do not update `lastmod`. Google recommends that `lastmod` reflect significant and verifiable page updates.[1]

### 6.2 Media sitemaps

Image sitemap entries reference the canonical page URL and publicly accessible image URL. Video sitemap/VideoObject entries include only encoded, public, visible videos with valid poster, title, description, duration, publication date, and player/content URL. Incomplete, private, rejected, or orphaned media is excluded.

### 6.3 Sitemap tests

Automated tests fetch the sitemap index and every partition and verify UTF-8, absolute URLs, size limits, 200 responses, canonical/index eligibility, no accidental noindex, no duplicate URLs, valid XML, and correct freshness. Sitemaps are submitted through Search Console API and robots.txt; submission remains a hint, not an indexing guarantee.[1]

## 7. Crawlable public links

All public discovery navigation uses real `<a href>` elements. This includes home-to-hub, hub-to-city, city-to-locality, locality-to-project/listing/guide, breadcrumb, related-entity, pagination, and broker links.

Do not globally ban `router.push`; client navigation is valid for authenticated flows, modal state, map state, compare, save, and other non-indexable interactions. Instead:

```text
public indexable link → <a href="...">
private/app action → client navigation or mutation
non-indexable filter → controlled URL policy
```

Add a custom lint rule or code review check for public components that render navigation without an `<a href>`. Run a JavaScript-disabled crawl to detect orphan or inaccessible pages.

## 8. Internal authority graph

Each page type has useful minimum and maximum link budgets to prevent both orphan pages and footer/link spam. Monitor inbound links, outbound links, click depth, anchor quality, intent collisions, and authority distribution.

Required contextual links include breadcrumbs, related localities, projects, active listings, broker inventory, RERA trust panel, guide recommendations, city directories, and next-step navigation. Links must be contextually relevant and use descriptive anchor text. Do not generate artificial links solely to increase counts.

## 9. Qualified intent quality system

A qualified intent page is indexable only when it passes:

```yaml
intent_page:
  stable_demand_or_editorial_value: true
  sufficient_current_inventory: true
  unique_content_and_context: true
  verified_metadata: true
  useful_internal_links: true
  freshness_within_policy: true
  evidence_or_methodology_when_claims_exist: true
  canonical_and_sitemap_valid: true
  quality_status: approved
```

Use a state machine:

```text
approved
→ warning
→ pending_review
→ noindex
→ redirect/404/410 when appropriate
→ restored after quality passes
```

Do not immediately noindex a page because a source is delayed for a short period. Use grace periods, visible freshness warnings, and review tasks. Do not generate city/locality/filter pages merely because a URL pattern exists.

## 10. Freshness and IndexNow

Track `lastMeaningfulEdit`, `lastVerifiedAt`, `sourceRetrievedAt`, and `contentReviewAt`. High-volatility listing pages have shorter freshness SLAs than durable locality guides. A date may change only after a substantive review or meaningful data update.

After a validated meaningful change:

```text
update entity
→ validate visible facts/metadata/JSON-LD
→ revalidate cache tags
→ update SeoPage.lastMeaningfulEdit
→ regenerate affected sitemap partition
→ send deduplicated IndexNow notification with retry/backoff
→ record job result
```

Notify promptly, but do not promise crawling or indexing within a fixed number of seconds.

## 11. Faceted navigation and pagination

Google warns that faceted URLs can create infinite URL spaces and recommends preventing crawling of unneeded facets or carefully controlling URLs that should be crawled.[2]

Maintain an explicit parameter registry:

```text
transaction, city, locality, propertyType, bhk, budget, area,
furnishing, amenities, rera, sort, page, mapViewport,
tracking, session, compare, saved
```

Each parameter has normalization, ordering, duplicate handling, index policy, canonical target, sitemap policy, and HTTP behavior. Approved qualified intent pages use stable path grammar. Arbitrary combinations remain useful in the application but do not automatically become indexable.

Invalid, duplicate, nonsensical, and genuinely empty filter combinations return the correct 404 behavior where applicable; do not redirect every empty query to a generic page. A useful no-result experience may exist for valid application searches while remaining noindex according to policy.

### 11.1 Pagination

The first collection page is server-rendered with stable listing links. Additional pages may be crawlable when they contain useful inventory and are linked through accessible pagination. Do not blanket-noindex page 2+; decide by collection quality, duplication, crawl cost, and whether the page has useful unique inventory. Infinite scroll enhances the experience but never replaces the crawlable fallback.

## 12. Listing lifecycle and HTTP states

```text
draft → pending_review → active → temporarily_unavailable
→ sold_or_rented → expired → archived → deleted
```

Active useful pages return 200. Temporarily unavailable pages may return 200 with clear status and related alternatives when the page remains useful. Sold/expired pages receive a 301 only when a genuine successor exists; otherwise use 404/410 according to the lifecycle policy. Store redirect reasons and test for loops, chains, soft 404s, and stale sitemap membership.

## 13. AI-search and grounding eligibility

Keep entity-name normalization, stable IDs, key-fact ordering, visible evidence, dates, source links, methodology, captions, transcripts, and freshness. Generate optional `llms.txt` only as a supplemental index. It never replaces HTML, sitemap, robots, canonical, or internal links.

Answer-ready page structure:

```text
H1 and entity identity
→ concise answer/facts panel
→ evidence/source/provenance
→ current inventory or page-specific content
→ methodology and limitations
→ related entities and guides
→ last verified/update date
```

No AI system is guaranteed to cite the page. Measure search impressions, citations where available, grounding queries, organic saves, leads, and conversions.

## 14. Breadcrumb service

Generate visible breadcrumbs and BreadcrumbList JSON-LD from the same parent graph. Validate each breadcrumb target, label, canonical, and hierarchy. Breadcrumbs must be useful to users, not merely keyword strings.

## 15. People-first guide architecture

Every guide requires:

```text
primary question/intent
original analysis
named author
qualified reviewer where appropriate
source/evidence links
methodology and limitations
last meaningful update
next review date
related city/locality/project/RERA/listing links
```

Use review intervals based on topic volatility. High-volatility pricing, regulation, tax, and RERA guides may use 90-day review targets; durable explainers may use longer intervals. Never refresh a date without a substantive review.

## 16. Performance and mobile SEO architecture

Google’s current Core Web Vitals guidance targets LCP within 2.5 seconds, INP below 200ms, and CLS below 0.1 for a good experience.[3] These remain the SEO-quality targets. India-specific engineering fallback budgets are reported separately:

| Class | Engineering target | Product behavior |
|---|---:|---|
| Desktop fast connection | LCP ≤ 2.5s | Full approved motion. |
| Mid-range mobile 4G | LCP ≤ 3.5s | Adaptive media, limited heavy effects. |
| Poor 3G/network | LCP ≤ 4.5s | Reduced motion, poster-first video, low-data images, list-first map. |

Use aspect-ratio media boxes, reserved image/video dimensions, skeleton contracts, and visual regression to prevent CLS. Identify the actual LCP candidate and prioritize it with framework image controls; never preload every image.

For filters, show immediate visual state and an accessible loading state, but measure true INP through RUM. An optimistic skeleton does not place the remaining work outside INP.

### 16.1 Mobile composition

Desktop uses filter rail, listing grid/list, and map. Mobile uses a dedicated full-width feed, sticky search, filter bottom sheet, and explicit Map toggle. Do not render the desktop map panel in the initial mobile composition; lazy-load MapLibre/deck.gl only after the user requests map mode.

All important controls target 44×44 CSS pixels as a strong product standard. This is an internal usability target, not a claim that 44px is universally required by WCAG. Test keyboard focus, screen readers, touch, map/list equivalence, and reduced motion.

### 16.2 Performance tests

Use PR smoke tests with Fast 3G/4x CPU throttling for representative routes, plus fixed-device labs and field RUM. Do not treat a lab pass as proof of p75 field Core Web Vitals.

## 17. v8 SEO implementation sequence

All prior capabilities remain first-phase. Add the SEO control plane in dependency order:

```text
1 framework/version and route groups
2 design system and public component contracts
3 entity/page registry and canonical service
4 server-rendering contract and raw HTML/no-JS tests
5 metadata and JSON-LD generators
6 sitemap/index policy/freshness/lifecycle
7 public crawlable links and breadcrumbs
8 page-authority graph and qualified-intent quality states
9 faceted navigation and pagination rules
10 Search Console/Bing/RUM data ingestion
11 SEO dashboard and automated audits
12 public pages and interactive enhancements
13 performance/mobile/structured-data/SEO release gates
```

This sequence does not defer the full product scope; it builds the SEO control contracts before page templates and interactive enhancements create drift.

## 18. Additional v8 release gates

Block release when:

1. A public page’s primary facts are absent from initial HTML.
2. JavaScript-disabled browsing cannot discover or understand public content.
3. Canonical, sitemap, JSON-LD `@id`, redirect, and database values disagree.
4. Metadata is duplicated, stale, empty, or contradicted by visible facts.
5. JSON-LD contains invisible, unsupported, or invented properties.
6. A sitemap contains non-200, noncanonical, noindex, duplicate, or private URLs.
7. Public navigation uses client-only navigation without a crawlable link.
8. Qualified intent pages bypass quality approval or degrade without review/grace policy.
9. Arbitrary facets create uncontrolled indexable URL space.
10. Pagination is removed without a crawlable collection fallback.
11. Listing lifecycle states return incorrect HTTP status or create soft 404s.
12. `lastmod` changes without meaningful content change.
13. Guide dates change without evidence of review.
14. Mobile initial load includes the desktop map bundle unnecessarily.
15. Core Web Vitals regress beyond the agreed field/lab thresholds.

## 19. v8 authoritative SEO contract

```yaml
seo:
  rendering: server-first initial HTML; client enhancement never gates facts
  route_groups:
    marketing: motion-enabled
    public: server-rendered SEO pages
    app: authenticated/private/noindex
  canonical_source: SeoPage + one typed canonical builder
  metadata: typed page-specific generators from the page view model
  structured_data: pure JSON-LD generators + visible-content tests
  sitemaps: canonical-only; 10k operational partitions; 50k/50MB hard limits
  freshness: lastMeaningfulEdit; substantive changes only
  links: public <a href>; app interactions may use client navigation
  authority: parent graph + contextual links + click-depth/orphan audits
  intent_pages: quality-gated; no automatic thin-page generation
  facets: explicit parameter registry and controlled index policy
  pagination: first page server-rendered; later pages policy-based, not blanket noindex
  lifecycle: correct 200/301/404/410 behavior; redirect map
  ai_search: normalized entities, evidence, key facts, dates, provenance, optional llms.txt
  monitoring: Search Console + Bing + RUM + internal crawl/quality audits
  mobile: separate feed/filter/map composition; map lazy-loaded on demand
```

## v8 references

[16]: https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap "Google sitemap limits and lastmod guidance"
[17]: https://developers.google.com/crawling/docs/faceted-navigation "Google faceted navigation guidance"
[18]: https://developers.google.com/search/docs/appearance/core-web-vitals "Google Core Web Vitals guidance"
[19]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google structured data guidance"

# Final v8 statement

Recommendation v8 keeps the complete v7 product and technology architecture and adds the missing SEO implementation control plane. It changes unsupported absolutes into measurable, testable policies while preserving premium UI, real motion, map exploration, media, RERA, broker operations, page authority, AI-search readiness, and full first-phase scope.
