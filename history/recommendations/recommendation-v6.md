# Recommendation v6 — Complete Final Technical Architecture
## India Real Estate Aggregator with Broker Partnerships, Premium UI, Motion, SEO, and AI Search

**Document status:** Final consolidated architecture  
**Version:** v6  
**Date:** August 2026  
**Audience:** Product owners, designers, frontend engineers, backend engineers, SEO specialists, data engineers, DevOps, QA, and AI coding agents.

---

## 0. AI-readable implementation contract

This section is intentionally explicit so that any AI system, engineer, or future team can understand the solution without reconstructing decisions from previous versions.

### 0.1 Product identity

```yaml
product:
  name: India Real Estate Aggregator
  model: broker-partnered marketplace
  primary_data_source: contracted broker submissions
  enrichment_sources: public RERA records and permitted partner sources
  prohibited_sources:
    - scraped portal listings
    - copied portal descriptions
    - copied portal images
    - copied portal floor plans
    - copied portal prices
  primary_users:
    - property buyers
    - property renters
    - broker partners
    - internal operations/admin users
```

### 0.2 Product promise

The platform lets users discover trustworthy Indian property listings with rich images, video, map exploration, broker identity, RERA enrichment, saved searches, comparison, and direct contact. Brokers receive a reliable workflow for onboarding, listing submission, media upload, listing management, and lead handling.

### 0.3 Non-negotiable requirements

| Requirement | Decision |
|---|---|
| Full first-phase scope | All technologies and features in this document belong to the first-phase build. They must not be removed simply because the architecture is complex. |
| Best UI | The interface must be premium, responsive, accessible, fast, and trustworthy. |
| Real motion | Use GSAP, ScrollTrigger, Motion, CSS scroll-driven animation, Lenis where appropriate, and React Three Fiber/Drei for scoped brand surfaces. |
| SEO | Public pages must be server-rendered, crawlable, linked, canonical, fresh, structured, and useful. |
| AI search | Pages must be easy for search and AI systems to discover, understand, verify, quote, and refresh. |
| Authority | Every important search intent has one canonical page owner and a controlled internal-link graph. |
| Mobile | Core search, listing, broker, and lead tasks must work on mobile 4G and low-end Android devices. |
| Accessibility | Core workflows target WCAG 2.2 AA and support keyboard, screen reader, touch, and reduced-motion users. |
| Security | Broker uploads, user data, authentication, media, leads, and organization permissions require server-side protection. |
| No guaranteed ranking | The stack can create a technically competitive foundation, but no framework can guarantee outranking Housing.com or any other portal. |

---

# 1. Product scope

## 1.1 In scope

The first phase includes broker partner onboarding, broker organizations, listing submission, images, video, Buy/Rent discovery, city and locality search, property type, BHK, budget, area, furnishing, amenities, project pages, full listing detail pages, RERA enrichment, map view, locality clustering, saved searches, alerts, comparison, broker dashboards, lead notifications, SEO guides, AI-readable content, and internal authority monitoring.

## 1.2 Out of scope from the data-ownership perspective

The platform must not scrape or republish third-party portal content. It must not copy another website’s descriptions, images, floor plans, prices, or proprietary data without an explicit agreement. Portal affiliate or partner inventory is permitted only when a separate agreement authorizes the use.

## 1.3 Data ownership model

| Source | Usage | Required controls |
|---|---|---|
| Contracted broker partners | Primary listing inventory, descriptions, images, videos, prices, broker identity | Listing/display agreement, submission audit, ownership attribution, update timestamp. |
| Broker/owner submissions | Own inventory where permitted | Consent, ownership declaration, moderation, contact verification. |
| Public RERA records | Registration and project/developer enrichment | Source URL, retrieval time, parser version, confidence, legal review, visible provenance. |
| Affiliate/partner feeds | Optional additional inventory | Contract, field-level rights, attribution, deletion process. |

---

# 2. Final technology stack

## 2.1 Core stack table

| Layer | Final choice | Exact responsibility |
|---|---|---|
| Web framework | **Next.js 16 App Router** | Public SEO pages, authenticated dashboard routes, server rendering, streaming, routing, metadata, and full-stack React architecture. |
| Rendering/cache | **Cache Components, explicit cache profiles, Suspense streaming** | Cached city/locality/project/listing content with dynamic personalized sections. This replaces old Next.js 15 experimental PPR wording.[1] |
| Bundler | **Turbopack stable** | Development and production bundling. Keep a documented Webpack fallback for incompatible custom loaders. |
| Request boundary | **`proxy.ts`** | Redirects, security headers, host/locale rules, request policy, and lightweight routing. Next.js 16 uses `proxy.ts` as the current boundary.[1] |
| Language | **TypeScript strict mode** | Types for entities, filters, route grammar, API procedures, metadata, forms, animation props, and permissions. |
| React | **React 19.2-compatible setup** | Server Components, View Transitions where supported, `useEffectEvent`, Activity where appropriate, and optional React Compiler. |
| React optimization | **React Compiler evaluated and opt-in** | Enable only after build, bundle, memory, hydration, and interaction benchmarks pass. It is not a blind global switch. |
| Styling | **Tailwind CSS v4 + CSS custom properties** | Utility styling, responsive layout, component states, and design token wiring. |
| Color system | **OKLCH semantic token system** | Perceptually consistent brand, surface, text, RERA, trust, warning, error, and success colors. Contrast must be tested. |
| Components | **shadcn/ui + Radix Primitives + custom compound components** | Owned, accessible components for search, filters, dialogs, drawers, galleries, uploads, tables, and dashboards. |
| Client data | **TanStack Query v5** | Filter queries, map/list synchronization, infinite results, saved searches, compare, alerts, and mutations. |
| Client UI state | **Zustand v5** | Transient state only: map viewport, selected listing, drawers, compare tray, upload progress, command palette, and animation preferences. |
| URL state | **Typed URLSearchParams** | Canonical state for Buy/Rent, city, locality, property type, BHK, budget, area, amenities, furnishing, and sort policy. |
| Maps | **MapLibre GL + deck.gl + react-map-gl** | Base map, clusters, scatter markers, heatmap, screen grid, price layers, viewport search, and card/map synchronization. |
| Search command UI | **cmdk** | Keyboard command palette for recent searches, saved searches, natural-language queries, cities, localities, and quick actions. |
| Search database | **PostgreSQL FTS + `pg_trgm`** | Exact/weighted text search, typo tolerance, locality aliases, broker/project/listing fields. |
| Geography | **PostGIS** | City/locality boundaries, nearby localities, distance, viewport search, geo-clusters, and map queries. |
| Semantic search | **pgvector** | Similar listings, locality intent, project similarity, guide relationships, and natural-language preference matching. |
| Search abstraction | **Provider-neutral ListingSearchProvider** | Allows PostgreSQL first and Typesense/OpenSearch/Elasticsearch later without changing the UI contract. |
| Database | **PostgreSQL 16+** | Source of truth for users, organizations, brokers, listings, projects, localities, RERA, pages, links, media, leads, and audit logs. |
| Cache/rate limit | **Redis 7 + Upstash Ratelimit** | Hot search cache, sessions where appropriate, sliding-window limits, autocomplete protection, and job coordination. |
| ORM | **Prisma ORM** | Typed access and migrations; isolate raw SQL for PostGIS, pgvector, and specialized indexes. |
| Authentication | **Better Auth current production release** | Users, organizations, broker roles, sessions, 2FA, magic links, passkeys, recovery, and audit events. |
| Strong authentication | **WebAuthn Level 3/passkeys** | Passwordless sign-in and secure broker/user account access. WebAuthn Level 3 is a 2026 W3C Candidate Recommendation Snapshot.[3] |
| API | **tRPC v11 + Zod** | End-to-end TypeScript procedures, validation, query integration, authorization, and typed mutations. |
| Virtualization | **TanStack Virtual** | Large result lists, grids, broker tables, and admin tables with accessible focus management. |
| Media images | **Cloudflare R2 + CDN + image transformation + `next/image`** | Responsive AVIF/WebP, `srcset`, placeholders, image sitemap, and cacheable derivatives. |
| Media video | **Cloudflare Stream + HLS + hls.js** | Direct upload, adaptive bitrate, poster, captions, transcript, playback fallback, and video sitemap. |
| Animation | **GSAP 3 + ScrollTrigger + Motion + CSS scroll-driven animation** | Hero timelines, pinned/scrubbed storytelling, page transitions, micro-interactions, and zero-JS reveals. |
| Smooth scroll | **Lenis only on approved marketing surfaces** | Premium marketing scroll feel. Never let it break keyboard, touch, anchor, back-button, or reduced-motion behavior. |
| 3D | **React Three Fiber + Drei** | Optional interactive hero/marketing canvas with dynamic import and 2D fallback. Core search never depends on WebGL. |
| Forms | **React Hook Form + Zod + shadcn/ui Form** | Broker onboarding, multi-step listing submission, autosave drafts, upload validation, and field-level recovery. |
| Fonts | **Bricolage Grotesque + Inter via `next/font`** | Brand display typography, application readability, tabular price numbers, and future language support after verification. |
| Icons | **Lucide React + Phosphor Icons** | Tree-shakeable icons with consistent visual roles. Use one primary icon family per surface. |
| Jobs | **Trigger.dev v3** | RERA synchronization, embedding creation, sitemap updates, revalidation, IndexNow, alerts, media processing, and notifications. |
| RERA | **Playwright HTML + CSV parsers + source adapters** | MahaRERA, UP-RERA, K-RERA, Haryana, Gujarat, and additional permitted sources with provenance and legal review. |
| Observability | **OpenTelemetry + Sentry + Pino + Web Vitals** | Portable traces/metrics, issue management, structured logs, route performance, search quality, and conversion health. Next.js recommends OpenTelemetry.[2] |
| Testing | **Vitest + Playwright + axe + visual regression + SEO crawler tests** | Unit, integration, E2E, accessibility, security, rendering, metadata, sitemaps, redirects, and responsive visual checks. |
| CI/CD | **GitHub Actions** | Typecheck, lint, tests, accessibility, SEO, schema, migration, dependency, secret, SBOM, container, performance, and preview deployment. |
| Deployment | **Vercel frontend/edge + Railway/Fly.io persistent services** | Public pages at the edge, persistent PostgreSQL/Redis, background jobs, and controlled operations. |
| Performance | **Edge cache + AVIF + Network Quality API + device matrix** | Mobile-first loading, adaptive media, reduced-data mode, animation adaptation, and low-end device support. |
| Security | **CSP, HSTS, Permissions Policy, CSRF, XSS sanitation, WAF/bot controls** | Protect users, broker data, media, sessions, uploads, and third-party integrations. CSP is defense in depth against XSS and clickjacking.[4] |

## 2.2 Technology decisions that changed from v1

| Original v1 wording | Final v6 wording |
|---|---|
| Next.js 15 + experimental PPR | Next.js 16 + Cache Components. The PPR architectural concept remains, but the old flag is not used. |
| `middleware.ts` implication | `proxy.ts` for Next.js 16 request interception. |
| Sentry + Pino only | OpenTelemetry + Sentry + Pino + Web Vitals. |
| Better Auth only | Better Auth plus passkeys/WebAuthn, recovery, audit logs, and organization authorization. |
| R2/Stream direct uploads | Signed uploads plus validation, scanning, EXIF removal, moderation, quotas, and lifecycle management. |
| Generic SEO claims | Measurable crawlability, page authority, structured data, internal links, sitemaps, freshness, and quality gates. |
| `llms.txt` as possible enhancement | Optional supplemental file only; HTML, links, sitemaps, structured data, robots rules, and quality remain primary. |

---

# 3. Product information architecture

## 3.1 Public page graph

```text
Home
├── Buy
│   ├── City hubs
│   │   ├── Locality hubs
│   │   │   ├── Qualified intent pages
│   │   │   ├── Project pages
│   │   │   ├── Broker pages
│   │   │   └── Locality guides
│   │   └── City guides
│   └── Property-type hubs
├── Rent
│   ├── City hubs
│   ├── Locality hubs
│   ├── Qualified intent pages
│   │   ├── Project pages
│   │   ├── Broker pages
│   │   └── Rental guides
│   └── City guides
├── Projects
│   ├── City/project directories
│   └── Project detail pages
├── RERA
│   ├── State hubs
│   ├── Registration records
│   └── RERA explainers
├── Brokers
│   ├── City/broker directories
│   └── Broker profiles
├── Guides
│   ├── City guides
│   ├── Locality guides
│   ├── Buying/renting guides
│   ├── RERA guides
│   └── Methodology pages
└── Listing detail pages
```

The interactive application adds compare, save, alerts, dashboards, map viewport state, command search, and personalized filters. Those states are not automatically indexable.

## 3.2 Canonical URL grammar

```text
/
/buy/
/rent/
/buy/{city}/
/rent/{city}/
/buy/{city}/{locality}/
/rent/{city}/{locality}/
/buy/{city}/{locality}/{qualified-intent}/
/project/{city}/{project-slug}/
/listing/{city}/{locality}/{listing-slug}-{stable-id}/
/broker/{city}/{broker-slug}/
/rera/{state}/{registration-number}/
/guide/city/{city}/{guide-slug}/
/guide/locality/{city}/{locality}/{guide-slug}/
/guide/rera/{state}/{guide-slug}/
/guide/buying-renting/{guide-slug}/
```

Rules:

1. URLs are lowercase and hyphenated.
2. Every entity has one canonical URL.
3. Volatile database IDs are not the only visible identifier.
4. Old URLs receive a redirect-map decision.
5. URL construction is centralized in typed route builders.
6. Invalid city/locality/state relationships are rejected.
7. Query parameters are governed by an explicit indexability policy.

## 3.3 Page authority layers

| Layer | Page owner | Main intent | Links to |
|---|---|---|---|
| L0 | Home/trust | Platform identity and trust | Hubs, cities, guides, RERA methodology. |
| L1 | Buy/Rent/Projects/RERA/Brokers/Guides hubs | Broad category | Cities, states, collections. |
| L2 | City | Property intent within a city | Localities, projects, guides, inventory. |
| L3 | Locality | Local discovery and neighborhood context | Intent pages, projects, brokers, listings, guides. |
| L4 | Qualified intent | Specific useful combination | Active listings, projects, brokers, guides. |
| L5 | Project | Durable project/developer/RERA entity | Listings, locality, developer, RERA, comparisons. |
| L6 | Listing | Exact property | Broker, project, locality, RERA, similar listings. |
| L7 | RERA | Registration verification | Project, developer, locality, source. |
| L8 | Broker | Partner identity and inventory trust | Listings, localities, lead path. |
| L9 | Guide | Original decision-support content | All relevant entities and live inventory. |

Every indexable page must have one primary intent owner. A page is not authoritative merely because its URL contains a keyword.

---

# 4. Indexability and crawl rules

## 4.1 Indexability matrix

| Route/state | Indexable | Sitemap | Canonical policy |
|---|---:|---:|---|
| Home | Yes | Yes | Self-canonical. |
| Buy/Rent hubs | Yes | Yes | Self-canonical. |
| City pages | Yes | Yes | Self-canonical. |
| Locality pages | Yes if quality threshold passes | Yes | Self-canonical. |
| Qualified intent pages | Yes if demand, inventory, and unique value pass | Yes | Self-canonical. |
| Project pages | Yes if complete/useful | Yes | Self-canonical. |
| Active listings | Yes while useful and current | Yes | Self-canonical. |
| Broker pages | Yes if complete/trustworthy | Yes | Self-canonical. |
| RERA pages | Yes if legally permitted and useful | Yes | Self-canonical. |
| Guides | Yes | Yes | Self-canonical. |
| Arbitrary filter combinations | Usually no | No | Closest qualified page or controlled noindex. |
| Sort order | No | No | Base URL. |
| Map viewport/bounding box | No | No | Base search URL. |
| Compare | No | No | Private/noindex. |
| Saved searches | No | No | Authenticated/noindex. |
| Broker dashboard | No | No | Authenticated/noindex. |
| Empty result | No | No | Useful parent, noindex, or correct empty status. |
| Expired listing | Case-based | Remove promptly | Genuine successor 301, otherwise 404/410. |

## 4.2 Faceted navigation

The product keeps all filters in the UI: Buy/Rent, location, property type, BHK, budget, area, furnishing, amenities, possession, RERA, broker verification, video, and map area.

Only curated combinations become SEO pages. A qualified page must have:

```yaml
qualified_intent_page:
  stable_search_demand: true
  sufficient_active_inventory: true
  unique_title_h1_description: true
  unique_locality_or_property_context: true
  visible_freshness: true
  meaningful_internal_links: true
  canonical_url: true
  editorial_or_quality_approval: true
```

Arbitrary combinations remain useful in the application but are excluded from sitemaps and controlled by canonical/noindex/robots policy. Google’s crawl guidance emphasizes managing duplicates, low-value URLs, sitemaps, 404/410 responses, and soft-404 avoidance.[5]

## 4.3 Crawlable links

Use real `<a href>` links for all public navigation. JavaScript may enhance navigation but must never be the only way to discover a page. Do not require a crawler to submit a search box or operate a map to find listings. Google specifically recommends normal crawlable links and warns that search-box discovery is not a substitute for category-to-detail linking.[6]

## 4.4 Pagination and infinite scrolling

The user interface may use infinite scrolling, TanStack Virtual, and animated progressive loading. Every listing card must have a stable detail link. Every indexable collection must have a server-rendered first page and a crawlable pagination or sitemap fallback.

## 4.5 Listing lifecycle

```text
draft
→ pending_review
→ active
→ temporarily_unavailable
→ sold_or_rented
→ expired
→ archived
→ deleted
```

Active pages stay canonical. A true successor may receive a 301 redirect. A page without a genuine successor returns 404/410. Never redirect every expired listing to a generic city page.

---

# 5. Page templates and authority requirements

## 5.1 Home page

Required visible and server-rendered content:

1. Clear H1 and product proposition.
2. Buy/Rent entry point.
3. Location autocomplete and quick filters.
4. Launch cities and popular localities.
5. Featured projects and active inventory.
6. Broker-partner trust explanation.
7. RERA differentiation and methodology link.
8. Guide links.
9. Organization/About/Contact/verification links.
10. Search and navigation links that work without JavaScript.

Motion may include the full GSAP hero sequence, gradient mesh, city-tag motion, bento sections, Lenis, and optional R3F/Drei. The H1, search, links, and value proposition must remain visible in HTML and usable without motion.

## 5.2 City page

A city page must contain city overview, Buy/Rent paths, locality directory, price/inventory summary with methodology, project directory, broker coverage, active listings, city guides, FAQs based on real user needs, update date, and links to nearby cities or relevant state/RERA pages.

## 5.3 Locality page

A locality page must contain:

| Module | Required content |
|---|---|
| Identity | Locality name, city, boundaries/aliases where useful. |
| Overview | Original local context, not a keyword-swapped template. |
| Inventory | Active listings, sale/rent split, property types, BHK distribution. |
| Pricing | Price/rent bands, sample size, date range, methodology, limitations. |
| Projects | Project list, developer, RERA relationships, availability. |
| Brokers | Verified or partner brokers serving the locality. |
| Nearby | Related localities based on geography and user intent. |
| Guides | Local buying/renting, commute, RERA, and decision-support content. |
| Freshness | Last verified/updated date and source description. |
| Conversion | Search, save, compare, lead, and contact actions. |

## 5.4 Qualified intent page

Example: `/buy/mumbai/andheri-west/2-bhk/`.

Required content includes unique title/H1, specific intent explanation, current inventory, price/area summary, filter state, listing cards, project links, broker links, guides, FAQs, freshness, and canonical metadata. It must provide value beyond changing one keyword in a template.

## 5.5 Project page

Required content includes project name, developer, address, property types, price/availability where supplied, possession/status where verified, RERA number/source, media gallery/video, amenities, licensed floor-plan data, locality context, active listings, similar projects, broker relationships, provenance, and last update.

## 5.6 Listing detail page

The initial HTML must contain title, price, locality, BHK, area, furnishing, availability, broker identity, RERA/verification state, last updated, primary image, concise description, and useful links.

The enhanced page includes image gallery, Cloudflare Stream video, HLS player, map, amenities, save, compare, broker contact, RERA trust panel, similar listings, related guides, and lead capture.

## 5.7 Broker page

Required content includes broker organization, service cities/localities, verification status, active listings, response information where accurately measured, partner status, contact path, organization policies, and links to inventory.

## 5.8 RERA page

Required content includes registration number, state, project/developer relation, source URL, retrieval date, parser/version, status, confidence, visible limitations, and links back to the project and locality. RERA content must be reviewed for source terms and republishing permissions.

## 5.9 Guide page

Every guide has one primary question, named author/reviewer, original analysis, evidence/source links, methodology, limitations, update date, related entities, and live inventory links. AI may assist research or drafting, but human review and originality are required.

Google’s people-first guidance emphasizes original information, completeness, clear sourcing, expertise, trust, and content created primarily for people rather than ranking manipulation.[7]

---

# 6. Internal-link and page-authority system

## 6.1 Authority flow

```text
Home
  → hubs
    → cities
      → localities
        → qualified intent pages
          → listing pages
        → project pages
          → listing pages
        → broker pages
        → guides
RERA pages
  → projects
    → localities/cities
Brokers
  → active listings
Guides
  → all relevant entities
```

## 6.2 Required contextual components

| Component | Purpose |
|---|---|
| Breadcrumbs | Show parent intent and provide crawlable hierarchy. |
| RelatedLocalities | Link nearby and comparable areas. |
| RelatedProjects | Link projects by locality, property type, or price band. |
| RelatedListings | Link active and explainably similar listings. |
| ReraTrustPanel | Link project, registration, source, status, and retrieval date. |
| BrokerInventoryPanel | Link broker, service area, and active inventory. |
| GuideRecommendations | Link guides to entities they explain. |
| CityDirectory | Link curated city/locality pages without footer spam. |
| NextStepNavigation | Provide the next useful action with descriptive anchors. |

## 6.3 Orphan monitoring

Trigger.dev must detect public pages with no inbound internal links, excessive click depth, broken links, duplicate intent, missing sitemap membership, stale metadata, or weak entity relationships. It must create an operations task rather than automatically generating low-value links.

---

# 7. SEO and AI-search architecture

## 7.1 Metadata contract

Every public page must generate:

```text
<title>
<meta name="description">
<link rel="canonical">
Open Graph title/description/image
Twitter/X card metadata
locale metadata
robots policy
visible H1
visible breadcrumbs
JSON-LD entity graph
primary facts
related internal links
```

The metadata service uses the same normalized entity data as the UI. Metadata and visible content must not drift.

## 7.2 Structured data graph

Use JSON-LD with stable `@id` values where accurate and supported:

| Page | Data |
|---|---|
| Site | WebSite, Organization, SearchAction where appropriate. |
| Navigation | BreadcrumbList. |
| Listing | Appropriate real-estate entity, Offer, Residence/Place, PostalAddress, ImageObject, VideoObject. |
| Project | Residence/Place, developer organization, RERA relation, ImageObject, VideoObject. |
| Broker | RealEstateAgent or most specific applicable Organization/Person type. |
| Guide | Article, BreadcrumbList, genuine visible FAQ content where eligible. |
| Video | VideoObject with poster, duration, upload date, description, transcript/captions where applicable. |
| Collection | ItemList only when it represents visible results accurately. |

Google recommends JSON-LD as a maintainable structured-data format but warns that structured data does not guarantee rich-result display and must match visible content.[8] [9]

## 7.3 AI-search/GEO requirements

There is no guaranteed AI ranking switch. The architecture improves eligibility by making pages:

1. Crawlable through HTML links and sitemaps.
2. Focused on one primary topic.
3. Clear about key facts near the top.
4. Supported by evidence, source, date, and methodology.
5. Consistent in entity names, IDs, URLs, and relationships.
6. Fresh through revalidation, `lastmod`, visible timestamps, and IndexNow.
7. Understandable through headings, tables, summaries, captions, transcripts, and accessible text.
8. Measurable through Google Search Console, Bing Webmaster Tools, AI Performance, citation data, and conversion analytics.

Bing’s 2026 guidance connects crawl efficiency, URL consolidation, clear entities, focused content, structured data, freshness, and crawlable links with eligibility for grounding and citations.[10]

`llms.txt` may be generated as an optional supplemental resource index. It must not replace HTML, XML sitemaps, canonical URLs, robots rules, or normal crawlable links.

## 7.4 Sitemap architecture

```text
/sitemap.xml
/sitemaps/cities-{n}.xml
/sitemaps/localities-{n}.xml
/sitemaps/intent-pages-{n}.xml
/sitemaps/projects-{n}.xml
/sitemaps/listings-active-{n}.xml
/sitemaps/brokers-{n}.xml
/sitemaps/rera-{n}.xml
/sitemaps/guides-{n}.xml
/sitemaps/images-{n}.xml
/sitemaps/videos-{n}.xml
```

Sitemaps contain only canonical, indexable, useful 200 URLs. `lastmod` changes only after meaningful content updates. Deleted, redirected, duplicate, private, and arbitrary filter URLs are removed.

## 7.5 Event-driven SEO operations

When an entity changes:

```text
Entity update
→ validate canonical and index policy
→ update database
→ revalidate Next.js cache tags
→ regenerate affected sitemap partition
→ update image/video sitemap
→ send IndexNow notification
→ record event and retry state
→ update authority/search dashboard
```

IndexNow communicates URL changes to participating engines, but successful submission does not guarantee indexing.[11]

---

# 8. Design system and premium UI

## 8.1 Design tokens

```css
:root {
  --color-brand-500: oklch(62% 0.22 250);
  --color-surface-0: oklch(8% 0.02 250);
  --color-surface-1: oklch(12% 0.025 250);
  --color-surface-2: oklch(16% 0.03 250);
  --color-bg-primary: var(--color-surface-0);
  --color-bg-card: var(--color-surface-1);
  --color-bg-elevated: var(--color-surface-2);
  --color-text-primary: oklch(98% 0 0);
  --color-text-muted: oklch(70% 0.01 250);
  --font-size-display: clamp(3.5rem, 8vw, 7rem);
  --font-size-heading: clamp(2rem, 4vw, 3.5rem);
  --font-size-body: clamp(0.9375rem, 1.2vw, 1rem);
  --space-section: clamp(5rem, 10vw, 10rem);
  --space-card: clamp(1.5rem, 2vw, 2rem);
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out-circ: cubic-bezier(0.85, 0, 0.15, 1);
  --duration-fast: 150ms;
  --duration-base: 300ms;
  --duration-slow: 600ms;
}
```

Add tokens for focus ring, error, warning, success, RERA states, trust states, elevation, blur policy, input states, high contrast, and reduced motion.

## 8.2 Design pillars

| Pillar | Implementation |
|---|---|
| Cinematic typography | Bricolage Grotesque for brand/hero; Inter for application UI; tabular numbers for prices. |
| Asymmetric bento grid | Marketing/capability surfaces only; listing results remain uniform and scannable. |
| Refined dark glass | Use limited backdrop blur in navigation, hero, and dialogs; never overload dense result lists. |
| Micro-interactions | GSAP hero, Motion state transitions, CSS reveals, save feedback, upload progress, map/card selection. |
| Interactive canvas | R3F/Drei hero-only with static fallback and device capability detection. |
| Accessibility/performance | Reduced motion, skeletons, focus states, contrast, 4G testing, and no mandatory WebGL. |

## 8.3 Screens

1. Home/search.
2. Buy/Rent results with list/map split.
3. Mobile results feed with filter bottom sheet.
4. Detail page.
5. Media gallery/lightbox.
6. Project page.
7. RERA page.
8. Broker profile.
9. Compare up to three listings.
10. Saved searches and alerts.
11. Broker onboarding.
12. Broker dashboard.
13. Listing submission wizard.
14. Media upload/retry workflow.
15. Guides and methodology pages.
16. Admin/operations authority dashboard.

## 8.4 Result card

Each result card contains photo, optional video badge, title, locality, price, BHK, area, furnishing where available, RERA state, broker identity, last updated, save, compare, and detail CTA. Do not overload the card with every possible badge.

## 8.5 Responsive modes

| Device | Layout |
|---|---|
| Mobile | Full-width listing feed, sticky search/filter, bottom-sheet filters, optional map mode. |
| Tablet | Compact split list/map, collapsible filters, touch-friendly cards. |
| Desktop | Persistent filter rail/top bar, virtualized grid/list, synchronized map, richer hover/focus motion. |

---

# 9. Motion architecture

## 9.1 Responsibility split

```text
CSS scroll-driven animation
→ simple reveals, progress, lightweight parallax
→ zero JavaScript where supported

GSAP + ScrollTrigger
→ hero timelines, pinned sections, scrubbed sequences, marketing storytelling

Motion
→ React mount/unmount, hover, focus, drawers, cards, save states, page transitions

Lenis
→ marketing-only smooth scrolling after accessibility and back-button testing

React Three Fiber + Drei
→ optional hero canvas only, dynamic import, 2D fallback
```

## 9.2 Required motion behavior

The hero sequence may animate words, subtitle, search bar, city tags, media, and depth layers. Results may animate card entry, save state, map selection, cluster expansion, and transitions. Detail pages may use shared image transitions, gallery movement, video poster reveal, and lightbox transitions. Broker pages may animate upload progress, validation recovery, autosave, and completion.

Every effect must support `prefers-reduced-motion`. Reduced motion removes nonessential parallax, magnetic buttons, autoplay movement, 3D, blur transitions, and pinned scrub effects while preserving state changes, focus, feedback, and completion status.

## 9.3 Motion guardrails

1. Animation must never hide primary content from crawlers or users.
2. No animation may block search, filtering, lead submission, or broker upload.
3. No mandatory WebGL, video, hover, or smooth scrolling.
4. Use stable layout placeholders to prevent CLS.
5. Provide a motion kill switch for incidents and low-end devices.
6. Measure INP and frame performance on representative devices.

---

# 10. Search and map architecture

## 10.1 Search behavior

Support ordinary structured search and power-user natural language:

```text
"2bhk bandra under 2cr"
→ transaction: buy
→ city: Mumbai
→ locality: Bandra
→ BHK: 2
→ maxPrice: 20,000,000 INR
```

The natural-language parser may infer filters but may not invent property facts. Final results come from structured, permissioned listing data.

## 10.2 Search quality system

Create a golden query set containing common city/locality/property queries, typo variants, Hindi/English transliteration variants, budget expressions, BHK expressions, and natural-language preferences. Measure zero-result rate, click-through, save rate, lead rate, relevance, and latency.

## 10.3 Map layers

| Layer | Use |
|---|---|
| ScatterplotLayer | Listing markers, price-color coding, selection. |
| HeatmapLayer | Price or listing density. |
| ScreenGridLayer | Count zones and market overview. |
| IconLayer | Branded price markers or cluster icons. |
| MapLibre base map | Streets, localities, labels, controls. |

The map must synchronize with the card list in both directions. It must provide a list fallback, keyboard labels, visible selected state, cluster counts, “search this area,” and no-JavaScript/low-power alternative.

## 10.4 Example map contract

```ts
interface MapViewProps {
  listings: Listing[]
  viewMode: 'scatter' | 'heatmap' | 'grid'
  onMarkerClick: (listing: Listing) => void
  onViewportChange: (viewport: MapViewport) => void
  onSearchThisArea: () => void
  reducedMotion: boolean
  lowPowerMode: boolean
}
```

Do not present universal performance claims such as “50k points at 60fps” without benchmarking on target devices. Use representative city datasets, low-end Android hardware, throttled networks, and the exact layers used in production.

---

# 11. Media architecture

## 11.1 Image pipeline

```text
Broker upload
→ signed R2 URL
→ MIME/content verification
→ size/dimension/quota check
→ malware/abuse scan
→ EXIF/location metadata removal
→ responsive derivatives
→ AVIF/WebP/JPEG fallback
→ BlurHash/dominant color
→ moderation/approval
→ public CDN asset
→ listing/project entity relation
→ image sitemap and JSON-LD
```

## 11.2 Video pipeline

```text
Broker upload
→ signed Cloudflare Stream direct upload
→ file/type/duration/quota validation
→ moderation/review
→ adaptive encoding
→ poster/thumbnail
→ captions/transcript where applicable
→ public player configuration
→ VideoObject metadata
→ video sitemap
→ playback telemetry
```

Cloudflare Stream remains the default because it provides adaptive-bitrate delivery and reduces custom transcoding infrastructure. Mux remains a future provider option if advanced analytics or playback tooling becomes more valuable than the current integrated setup.

## 11.3 Video player behavior

The player uses HLS/hls.js where necessary, native HLS where supported, controls, `playsInline`, poster, captions, error recovery, and a text summary. Autoplay is muted and optional. A slow network must receive a poster and readable listing content without waiting for video.

---

# 12. Broker, auth, and security architecture

## 12.1 Broker workflow

```text
Register
→ verify email/phone
→ create or join broker organization
→ complete firm profile
→ accept listing/display agreement
→ add listing draft
→ validate structured facts
→ upload images/video
→ scan/moderate media
→ submit for review
→ publish/return for correction
→ edit/archive/renew
→ receive leads and notifications
```

## 12.2 Auth capabilities

Retain Better Auth, organization/tenant support, 2FA, magic links, roles, sessions, and recovery. Add passkeys/WebAuthn, device/session management, reauthentication for sensitive actions, audit logs, and organization-level authorization.

## 12.3 Security controls

| Area | Required implementation |
|---|---|
| CSP | Report-only rollout, then enforced nonce/hash policy. |
| HSTS | HTTPS enforcement after all subdomains/assets are safe. |
| Permissions Policy | Restrict camera, microphone, geolocation, autoplay, fullscreen, and browser capabilities. |
| Cookies | Secure, HttpOnly, SameSite, rotation, revocation. |
| CSRF | SameSite plus server-side protection for mutations. |
| XSS | Sanitize descriptions, guide HTML, URLs, SVG, media metadata, and user content. |
| Uploads | Signed URLs, MIME verification, size limits, scanning, EXIF stripping, moderation, private originals. |
| Authorization | Server-side organization, role, ownership, and listing checks on every mutation. |
| Rate limits | Per-IP, user, broker, organization, route, upload, autocomplete, and lead endpoint. |
| Supply chain | Lockfile integrity, secret scanning, dependency audit, SBOM, CodeQL/equivalent, container scans. |
| Audit | Login, passkey, role, listing, media, RERA, lead, export, and admin events. |

---

# 13. Data model

## 13.1 Core entities

```text
User
Organization
BrokerProfile
Listing
ListingMedia
Project
Developer
Locality
City
State
ReraRecord
Guide
SeoPage
InternalLink
ContentEvidence
SavedSearch
Alert
Comparison
Lead
Notification
AuditEvent
SearchQuery
Embedding
JobRun
```

## 13.2 Listing fields

```text
id
stablePublicId
slug
brokerOrganizationId
brokerProfileId
projectId
cityId
localityId
transactionType: buy | rent
propertyType
bhk
bathrooms
areaValue
areaUnit
priceValue
rentValue
maintenanceValue
furnishing
amenities
addressDisplayPolicy
latitude/longitude or privacy-adjusted location
reraRecordId
status
verificationStatus
mediaCount
videoAvailable
lastUpdatedAt
lastVerifiedAt
publishedAt
expiresAt
createdAt
updatedAt
```

## 13.3 SEO page fields

```text
canonicalUrl
pageType
primaryIntent
indexPolicy
qualityStatus
parentEntityId
canonicalEntityId
title
metaDescription
h1
authorId
reviewerId
lastMeaningfulEdit
lastVerifiedAt
sitemapGroup
robotsDirective
```

## 13.4 Content evidence fields

```text
entityType
entityId
claim
sourceUrl
sourceType
retrievedAt
verifiedBy
confidence
visibleOnPage
```

The model must answer: what page owns this intent, what entity does it represent, who reviewed it, what evidence supports it, what pages link to it, and when was it meaningfully updated?

---

# 14. RERA architecture

## 14.1 Source adapters

Implement source-specific adapters for MahaRERA, UP-RERA, K-RERA, Haryana RERA, Gujarat RERA, and additional states after legal/technical review. Each adapter stores source, endpoint/page, retrieval time, parser version, raw record reference where permitted, normalized fields, confidence, and errors.

## 14.2 RERA job behavior

```text
Trigger nightly or scheduled sync
→ fetch permitted source
→ parse API/CSV/HTML/PDF as applicable
→ normalize registration/project/developer fields
→ validate schema
→ compare with prior record
→ store provenance and diff
→ update linked project/page
→ revalidate cache
→ update sitemap/IndexNow if public content changed
→ alert on parser failure or status change
```

Do not represent public availability as unlimited permission to scrape or republish. Legal review is required for every source.

---

# 15. SEO operations and authority dashboard

## 15.1 Required jobs

| Job | Function |
|---|---|
| `seo-page-quality-check` | Validates intent, unique content, freshness, evidence, links, and index policy. |
| `internal-link-audit` | Finds orphan pages, broken links, excessive depth, and weak clusters. |
| `sitemap-rebuild` | Updates only affected sitemap partitions. |
| `indexnow-notify` | Sends add/update/delete notifications. |
| `canonical-consistency-check` | Compares URL, canonical tag, sitemap, redirect, and JSON-LD. |
| `expired-listing-cleanup` | Applies active/unavailable/archive/delete rules. |
| `structured-data-validation` | Compares JSON-LD to visible entity data. |
| `content-freshness-review` | Flags stale pages and date-only refreshes. |
| `ai-citation-review` | Reviews cited pages and grounding queries where available. |
| `authority-graph-audit` | Computes internal link depth, inbound links, orphan state, and intent collisions. |

## 15.2 Dashboard metrics

```text
indexable pages by type
canonical conflicts
sitemap inclusion errors
orphan pages
click depth
broken links
soft 404 candidates
404/410/301 counts
last meaningful update age
RERA freshness
listing freshness
Web Vitals by route
search latency and zero-result rate
organic impressions/clicks
Bing citations and grounding queries
organic saves/leads
media playback/upload success
job failures and retry depth
```

---

# 16. Observability

Use OpenTelemetry as the portable signal layer, Sentry for issues/traces, Pino for structured server logs, and Web Vitals/product analytics for user-facing performance.

Required spans include page render, cache hit/miss, search, autocomplete, map query, media transform, video playback start, uploads, broker submission, lead submission, RERA jobs, embeddings, sitemap generation, IndexNow, and SEO page rendering.

Never place raw phone numbers, email addresses, exact user location, or sensitive broker data in logs or traces without redaction.

---

# 17. Performance, accessibility, and resilience

## 17.1 Budgets

| Metric | Target |
|---|---:|
| LCP on key public mobile pages | ≤ 2.5 seconds target under representative conditions. |
| INP for search/filter/save interactions | ≤ 200 milliseconds target. |
| CLS | ≤ 0.1 target. |
| Initial JavaScript | Route-specific budget enforced in CI. |
| Search response | Cached common queries and useful partial state. |
| Media | Poster/placeholder visible before video/image completion. |
| WebGL | Core tasks work without WebGL. |
| Motion | Core tasks work with reduced motion. |
| Accessibility | WCAG 2.2 AA target. |

## 17.2 Graceful degradation

```text
R3F unavailable → 2D gradient/static hero
WebGL unavailable → list map fallback or static map
Video slow → poster + text summary
Network poor → lower image/video quality and reduced animation
JavaScript delayed → server-rendered facts, links, and forms remain useful
Search provider unavailable → PostgreSQL fallback
Redis unavailable → bounded uncached operation where safe
RERA source unavailable → display last verified record and freshness warning
AI parser unavailable → structured filters remain functional
```

---

# 18. Testing and release gates

## 18.1 Test matrix

| Test type | Coverage |
|---|---|
| Unit | Price utilities, filter builders, URL grammar, metadata, Zod schemas, RERA parsers, permissions, search parser. |
| Integration | Database migrations, cache tags, revalidation, jobs, media signing, organization isolation, passkeys, upload security. |
| E2E | Search, filters, map/list, detail, gallery, video, save, compare, broker submission, media retry, RERA, alerts, recovery. |
| SEO | Server HTML, title/H1, canonical, robots, JSON-LD, sitemap, redirects, 404/410, parameter policy, internal links, orphan detection. |
| Accessibility | Keyboard, focus, screen reader smoke, dialogs, labels, contrast, reduced motion, map/list alternative. |
| Security | CSP, XSS, CSRF, auth, authorization, rate limits, upload abuse, dependency, secrets, SBOM, container scanning. |
| Performance | 4G, low-end Android, CPU throttling, cold/warm cache, low-power mode, WebGL/no-WebGL, video-disabled. |
| Visual | Responsive screenshots, motion on/off, dark/light/high contrast, gallery, map, card, dashboard, form states. |
| Observability | Trace propagation, PII redaction, route/entity/job attributes, Web Vitals ingestion, alerting. |

## 18.2 Release gates

A release is blocked if:

1. Public pages are not server-rendered with useful primary content.
2. A canonical/indexable page has no crawlable path or sitemap entry.
3. Arbitrary filters create uncontrolled indexable URLs.
4. JSON-LD contradicts visible content.
5. A missing listing returns a 200 soft page instead of the correct status.
6. A broker can access another organization’s listing/media/lead data.
7. Uploads bypass validation, scanning, quota, or moderation policy.
8. Critical workflows fail with reduced motion, no WebGL, slow video, or slow network.
9. Security, migration, backup, or restore checks fail.
10. Web Vitals or route budgets regress beyond approved thresholds.

---

# 19. First-phase implementation sequence

All capabilities are first-phase scope. The sequence only controls dependencies.

| Order | Workstream | Deliverable |
|---:|---|---|
| 1 | Repository/framework | Next.js 16, TypeScript, Turbopack, Cache Components, `proxy.ts`, React 19.2 compatibility. |
| 2 | Design system | Tailwind v4, OKLCH tokens, fonts, icons, shadcn/Radix, Storybook, accessibility primitives. |
| 3 | Domain model | Users, organizations, brokers, listings, projects, localities, RERA, media, leads, pages, links, evidence. |
| 4 | Data platform | PostgreSQL, PostGIS, Redis, pg_trgm, pgvector, Prisma, pooling, backups, migrations. |
| 5 | Auth/security | Better Auth, WebAuthn/passkeys, 2FA, magic links, recovery, audit, CSP, permissions, CSRF, XSS, rate limits. |
| 6 | Page authority | URL grammar, page registry, index policy, canonical rules, metadata, JSON-LD, route templates. |
| 7 | Search | PostgreSQL FTS, locality autocomplete, aliases, filters, URL state, cmdk, query parser, search quality set. |
| 8 | Public pages | Home, hubs, cities, localities, qualified intent, projects, listings, brokers, RERA, guides. |
| 9 | Internal graph | Breadcrumbs, related entities, contextual links, orphan monitoring, click-depth dashboard. |
| 10 | Sitemaps/freshness | Sitemap index, media sitemaps, cache revalidation, `lastmod`, IndexNow, lifecycle jobs. |
| 11 | Results/maps | TanStack Query, Zustand, TanStack Virtual, MapLibre, deck.gl, clusters, heatmap, list fallback. |
| 12 | Media | R2, Stream, signed uploads, scanning, EXIF removal, derivatives, BlurHash, captions, posters, hls.js. |
| 13 | Detail/conversion | Gallery, video, RERA trust, broker, save, compare, similar listings, leads. |
| 14 | Broker operations | Onboarding, multi-step form, drafts, listing management, uploads, notifications, organization roles. |
| 15 | Premium motion | GSAP, ScrollTrigger, Motion, CSS scroll-driven animation, Lenis marketing surface, R3F/Drei hero. |
| 16 | RERA/jobs/AI | Source adapters, Trigger.dev, embeddings, alerts, semantic search, citation monitoring. |
| 17 | Observability | OpenTelemetry, Sentry, Pino, Web Vitals, analytics, privacy/consent, dashboards. |
| 18 | Quality/release | Vitest, Playwright, axe, visual regression, security, SEO crawler, performance, device, backup/restore tests. |

---

# 20. Final system summary for AI implementation

```yaml
architecture:
  public_layer:
    purpose: SEO, authority, AI discovery, trust, content, entity pages
    rendering: Next.js 16 Server Components + Cache Components + Suspense
    navigation: HTML <a href> links + typed route builders
    data: PostgreSQL/PostGIS/Prisma
    metadata: canonical, robots, JSON-LD, Open Graph, breadcrumbs
    freshness: cache tags, Trigger.dev, sitemaps, IndexNow

  interactive_layer:
    purpose: search, filters, map, compare, saves, alerts, media, leads
    data: TanStack Query
    ui_state: Zustand
    search_state: typed URLSearchParams
    map: MapLibre + deck.gl + react-map-gl
    virtualization: TanStack Virtual

  broker_layer:
    purpose: onboarding, listing submission, media, dashboard, leads
    forms: React Hook Form + Zod
    auth: Better Auth + organizations + WebAuthn/passkeys + 2FA
    media: signed R2/Stream uploads + scanning + moderation

  motion_layer:
    hero: GSAP + ScrollTrigger + optional R3F/Drei
    component_state: Motion
    simple_reveals: CSS scroll-driven animation
    marketing_scroll: Lenis only after accessibility validation
    fallback: static/2D/reduced-motion/no-WebGL

  data_and_jobs:
    database: PostgreSQL + PostGIS + pg_trgm + pgvector
    cache: Redis
    jobs: Trigger.dev
    sources: broker agreements + permitted RERA sources
    observability: OpenTelemetry + Sentry + Pino + Web Vitals

  seo_authority:
    hierarchy: home → hub → city → locality → intent → project/broker/RERA → listing
    index_policy: explicit per route family
    links: server-rendered contextual HTML links
    sitemaps: segmented canonical entity/media sitemaps
    ai_search: entity IDs + visible facts + evidence + freshness + Bing AI Performance

  security:
    headers: CSP + HSTS + Permissions Policy
    requests: CSRF + authorization + rate limits
    content: XSS sanitation + upload scanning + moderation
    operations: audit logs + backups + restore drills + supply-chain scanning
```

## Final statement

Recommendation v6 is the consolidated final architecture. It contains the original v1 UI and technology decisions, the v2 premium motion and SEO strategy, the v3 crawlable information architecture, the v4 page-authority and SEO solution map, and the v5 2026 production updates.

The complete solution has two coordinated surfaces:

> **The public web is a fast, server-rendered, authoritative entity graph. The application is a premium, animated, interactive property-discovery experience. Both use the same canonical data and evidence model.**

This design retains every requested capability while making responsibilities clear enough for an AI system or engineering team to implement consistently.

---

# References

[1]: https://nextjs.org/blog/next-16 "Next.js 16 release announcement"
[2]: https://nextjs.org/docs/app/guides/open-telemetry "Next.js OpenTelemetry instrumentation guide"
[3]: https://www.w3.org/TR/webauthn-3/ "W3C Web Authentication Level 3 Candidate Recommendation Snapshot"
[4]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP "MDN Content Security Policy guide"
[5]: https://developers.google.com/crawling/docs/crawl-budget "Google Crawling Infrastructure: Optimize your crawl budget"
[6]: https://developers.google.com/search/docs/specialty/ecommerce/help-google-understand-your-ecommerce-site-structure "Google Search Central: Help Google understand ecommerce site structure"
[7]: https://developers.google.com/search/docs/fundamentals/creating-helpful-content "Google Search Central: Creating helpful, reliable, people-first content"
[8]: https://developers.google.com/search/docs/appearance/structured-data/intro-structured-data "Google Search Central: Introduction to structured data"
[9]: https://developers.google.com/search/docs/appearance/structured-data/sd-policies "Google Search Central: Structured data general guidelines"
[10]: https://www.bing.com/webmasters/help/webmaster-guidelines-30fba23a "Bing Webmaster Guidelines"
[11]: https://www.indexnow.org/documentation "IndexNow documentation"
