

---

# Final Three-Phase Implementation Plan
## Authoritative execution structure for the complete architecture

This section organizes the entire approved architecture into three implementation phases. **No approved capability is removed.** Phase boundaries describe implementation and validation order, not permission to delete features. Expensive capabilities are implemented behind stable interfaces, feature flags, dynamic imports, and graceful fallbacks so the product foundation does not need to be rebuilt later.

## 0. Phase model

| Phase | Purpose | Required outcome |
|---|---|---|
| Phase 1 — Foundation and first complete product | Establish the production architecture, design system, data model, public SEO website, broker workflow, core discovery, full media/security foundations, Hindi/Devanagari foundations, and all advanced capability contracts. | A deployable first product with complete core workflows, crawlable authority pages, premium UI foundations, real motion on approved surfaces, and every later capability integrated behind stable contracts. |
| Phase 2 — Activation and scale | Activate advanced search, map, semantic, media, localization, automation, and authority operations after Phase 1 contracts and benchmarks pass. | A richer marketplace with advanced discovery, stronger content coverage, operational automation, Hindi pages, and measured scale. |
| Phase 3 — Optimization and expansion | Optimize ranking, conversion, regional coverage, advanced AI, infrastructure resilience, and commercial workflows without changing the foundation. | A measurable, scalable, multilingual, high-authority platform with continuous improvement and controlled expansion. |

### 0.1 Non-negotiable rule

Phase 1 includes the **architecture and production-ready integration contract for every approved technology**: R3F/Drei, GSAP, ScrollTrigger, Motion, Lenis, MapLibre, deck.gl, cmdk, pgvector, LLM fallback, Cloudflare R2/Stream, Trigger.dev, RERA adapters, OpenTelemetry, Search Console/Bing integrations, Hindi/Devanagari support, leads, security, privacy, and all page-authority systems.

Some expensive capabilities may initially be activated in a constrained surface, such as R3F only in the marketing hero, advanced deck.gl layers behind flags, or pgvector for one similarity use case. This is **scoped activation, not Phase 2 deferral**.

---

# Phase 1 — Foundation and first complete product

## 1. Phase 1 outcome

Phase 1 must deliver a usable, deployable, secure, crawlable, responsive first product. Users can discover Buy/Rent inventory, browse cities and localities, open project/listing/broker/RERA pages, use search and filters, view media, explore the map when requested, save and compare, submit leads, and use the platform on mobile. Brokers can onboard, create and manage listings, upload media, receive leads, and view operational status. Search engines and AI systems can crawl and understand the public entity graph.

The product must not depend on JavaScript, WebGL, an LLM, semantic search, or the map for the primary page facts or core discovery workflow.

## 2. Phase 1 repository and framework

Set up a monorepo or clearly separated packages with:

```text
apps/web              Next.js 16.3.1 or latest stable security-patched 16.x
apps/worker           Trigger.dev jobs and integrations
packages/ui           shadcn/ui, Radix, design tokens, Storybook stories
packages/domain       entities, typed contracts, permissions, route models
packages/seo          canonical, metadata, JSON-LD, sitemap, robots, links
packages/search       parser, filters, provider abstraction, ranking contracts
packages/media        upload, derivatives, R2/Stream adapters, moderation
packages/i18n         locale model, dictionaries, aliases, formatting
packages/config       environment schema and feature flags
packages/testing      fixtures, golden queries, accessibility and SEO helpers
```

Pin exact dependency versions with a lockfile. Enable TypeScript strict mode, ESLint, Prettier, import boundaries, secret scanning, dependency scanning, SBOM generation, and reproducible CI builds.

### 2.1 Next.js stability gate

Use Next.js 16.3.1 or the latest stable patched 16.x release available at implementation start. Enable Cache Components and verify `cacheLife`, `cacheTag`, Suspense, route groups, metadata, and `proxy.ts` behavior in a production-like preview. Do not use a canary release in production.

The gate must cover security-patch monitoring, Server Action limits, cache isolation, authenticated data leakage, request-boundary redirects, security headers, raw HTML, JavaScript-disabled crawling, accessibility, visual regression, and rollback to the previous tested version.

## 3. Phase 1 design system and UI foundation

### 3.1 Design tokens

Create semantic tokens in OKLCH for:

```text
brand accent
background/surface/elevated surface
text/muted/disabled
border/divider/focus
success/warning/error/info
RERA verified/trust/verified broker
buy/rent/property-type states
map selection/cluster/heat intensity
light/dark/high-contrast/reduced-motion themes
```

Use CSS custom properties wired to Tailwind v4. Validate text and interactive contrast, focus visibility, disabled states, dark mode, and Devanagari rendering.

### 3.2 Typography and India language readiness

Use Bricolage Grotesque and Inter only after verifying Devanagari coverage and licensing. Add a Devanagari-capable fallback font or a dedicated Hindi font strategy. Test English, Hindi, and mixed-language line wrapping, prices, filters, cards, metadata, buttons, breadcrumbs, tables, and forms.

Use locale-aware INR, dates, area units, pluralization, number grouping, and sentence construction. Do not assume English text width. Keep layout resilient to 30–70% text expansion.

### 3.3 Components

Build and document primitives with shadcn/ui, Radix, and custom components:

```text
buttons, links, icons, inputs, selects, comboboxes, date/number fields
badges, trust labels, RERA labels, alerts, tooltips, dialogs, drawers
skeletons, empty/error/loading states, cards, tables, tabs, breadcrumbs
search bar, filter rail, filter sheet, command palette, gallery
map/list controls, media player, upload dropzone, lead form, broker forms
```

Lucide is the primary icon system. Phosphor is permitted only for approved marketing/hero art. Storybook covers primitives, compound components, all result-card states, media states, broker form states, reduced motion, high contrast, and localized text lengths. Full pages use Playwright and visual regression.

## 4. Phase 1 information architecture and page authority

Create the canonical page hierarchy:

```text
Home
→ Buy/Rent/Projects/RERA/Brokers/Guides hubs
→ City pages
→ Locality pages
→ Qualified intent pages
→ Project pages
→ Listing pages
→ Broker pages
→ RERA pages
→ Guides
```

Public URL patterns remain stable ASCII-slug routes:

```text
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
```

`SeoPage` is the canonical source of truth. The typed canonical builder is used by routing, metadata, JSON-LD, sitemaps, internal links, redirects, and audits. Stable listing IDs survive title changes. Store old-slug redirects and test redirect loops/chains.

## 5. Phase 1 SEO control plane

Implement the full control plane before large-scale page publication:

```text
SeoPage registry
→ index and quality policy
→ server-rendering contract
→ metadata generators
→ JSON-LD generators
→ canonical consistency
→ sitemap generation
→ internal link graph
→ freshness/lifecycle states
→ Search Console/Bing/RUM ingestion
→ SEO authority dashboard
```

### 5.1 Server-rendering contract

Public initial HTML must include title, H1, primary facts, meaningful description, canonical, robots, breadcrumbs, and crawlable links. Client components may add save, compare, map, filters, gallery, video, and lead interactions but never gatekeep the main content.

Use marketing, public, and app route groups. Marketing may load motion. Public SEO pages must avoid heavy motion dependencies. Authenticated routes are client-rich and protected/noindex.

Required tests:

```text
raw response HTML assertions
JavaScript-disabled Playwright crawl
server view-model contract tests
metadata/canonical/breadcrumb assertions
public link discovery test
```

### 5.2 Metadata and structured data

Create typed metadata generators for listing, city, locality, intent, project, broker, RERA, and guide pages. Use the same entity snapshot for visible content, metadata, and JSON-LD. Omit unsupported facts rather than inventing them. Test uniqueness, freshness, and drift.

Create pure JSON-LD graph generators using canonical page IDs, visible facts, breadcrumbs, organizations, brokers, projects, media, and RERA relationships. Validate locally in CI and use Rich Results Test/Schema Markup Validator during development. Monitor Search Console after deployment.

### 5.3 Sitemaps

Create a sitemap index and canonical-only partitions for cities, localities, intents, projects, active listings, brokers, RERA, guides, images, and videos. Use approximately 10,000 URLs per partition while respecting the 50,000 URL/50MB limits. Use `lastMeaningfulEdit`, not generic `updatedAt`. Test all partition URLs, canonical status, robots policy, noindex, response codes, duplicates, freshness, and media completeness.

### 5.4 Crawlable links and authority

Use real `<a href>` elements for all public navigation. Use contextual breadcrumbs, related entities, locality/project/listing/broker/guide links, descriptive anchors, click-depth checks, and orphan detection. Client navigation remains valid for private and application interactions.

### 5.5 Qualified intent and facets

Create a quality state machine for intent pages. An indexable intent page requires stable intent, sufficient current inventory, original content, evidence, useful links, verified metadata, freshness, and approved quality status.

Create a parameter registry for transaction, city, locality, property type, BHK, budget, area, furnishing, amenities, RERA, sort, page, map viewport, tracking, compare, session, and saved state. Arbitrary combinations work in the application but do not automatically become indexable pages.

### 5.6 Lifecycle and freshness

Implement listing states from draft through active, temporarily unavailable, sold/rented, expired, archived, and deleted. Return correct 200/301/404/410 behavior. Create grace periods before noindexing degraded pages. Update `lastMeaningfulEdit` only after substantive changes. Trigger revalidation, sitemap updates, IndexNow notification, and audit records after validated changes.

## 6. Phase 1 entity and data model

Create PostgreSQL/PostGIS/Prisma models for:

```text
User, Session, Passkey, Organization, OrganizationMember, Role
BrokerProfile, BrokerVerification, Listing, ListingStatus, ListingVersion
Project, Developer, Locality, City, State, Country
RERAProject, RERARegistration, RERASource, RERAEvidence
MediaAsset, ImageDerivative, VideoAsset, Caption, Transcript
SeoPage, Redirect, InternalLink, Breadcrumb, ContentEvidence
Guide, GuideAuthor, GuideReview, QualifiedIntent, SearchAlias
SavedSearch, SavedListing, CompareSet, Alert
Lead, LeadEvent, LeadConsent, Notification, AuditEvent
Embedding, SearchQuery, SearchFeedback, FeatureFlag, JobRun
```

Add English/Hindi names, aliases, transliterations, phonetic forms, locale, translation status, alternate URLs, and editorial review status. Store source URLs, retrieval time, parser version, confidence, provenance, and meaningful-edit timestamps.

## 7. Phase 1 database, cache, and operations

Use PostgreSQL 16+ with PostGIS, `pg_trgm`, pgvector, Redis 7, Prisma, and a provider-neutral search boundary. Use PgBouncer transaction pooling or one explicitly selected compatible alternative. Configure connection limits, statement timeouts, serverless burst tests, pool alerts, and Prisma client reuse.

Use Railway as the primary persistent-services platform:

```text
Vercel: Next.js web, edge delivery, previews
Railway: API, workers, scheduled jobs, private services
Managed PostgreSQL: PostGIS, backups, PITR where available
Managed Redis: cache/rate limits/jobs
Cloudflare R2/Stream: media
```

Choose and document one primary region close to Indian users/data requirements. Keep containers portable but do not maintain a second equal production deployment path.

Backups require daily minimum, hourly target where supported, encryption, 30-day minimum retention, pre-migration snapshots where needed, alerts, and quarterly isolated restore drills with measured RPO/RTO.

## 8. Phase 1 authentication, security, privacy

Use Better Auth with organizations, role-based access, sessions, 2FA, magic links, recovery, WebAuthn/passkeys, audit events, secure cookies, CSRF protection, CSP, HSTS, Permissions Policy, WAF/bot controls, rate limits, SSRF controls, safe redirects, and upload authorization.

Media uploads require signed URLs, MIME and size validation, malware scanning, EXIF removal, image/video moderation, derivatives, quotas, retention, public/private ACLs, and provenance.

Listing descriptions are plain text by default. If rich text is permitted, sanitize with a strict server-side allowlist. Validate RERA formats, detect spam/phishing/discriminatory/unverifiable claims, and moderate first-time broker submissions.

Implement India DPDP privacy posture: notices, purpose limitation, consent/withdrawal, access/correction/deletion, processor inventory, retention, PII redaction, child safeguards, encryption, role boundaries, breach response, and legal review.

## 9. Phase 1 search and discovery

Implement PostgreSQL FTS, weighted fields, `pg_trgm`, locality aliases, PostGIS distance/viewport queries, URL-driven filters, cmdk, autocomplete, recent searches, saved searches, and typed query contracts.

The deterministic parser supports Indian prices, BHK, area, transaction, locality aliases, furnishing, amenities, and radius. The LLM fallback is an isolated optional adapter for ambiguity/zero results. Validate output with Zod. Never allow the LLM to invent listing facts.

Implement `ListingSearchProvider` so PostgreSQL is the source implementation and a future Typesense/OpenSearch/Elasticsearch provider can be added without changing UI/API contracts.

## 10. Phase 1 public pages

Build server-first templates for:

```text
Home and trust
Buy/Rent hubs
City pages
Locality pages
Qualified intent pages
Project pages
Listing detail pages
Broker pages
RERA registration pages
City/locality/buying/renting/RERA guides
```

Every page has visible purpose, unique content, primary facts, breadcrumbs, related entities, schema where accurate, freshness, source/methodology evidence, and mobile layout.

## 11. Phase 1 results, maps, and mobile

Desktop composition: filter rail, listing grid/list, map panel. Mobile composition: full-width feed, sticky search, filter bottom sheet, explicit Map toggle. Do not load the desktop map panel into the initial mobile composition.

Use TanStack Query, Zustand, TanStack Virtual, MapLibre, react-map-gl, deck.gl, clusters, selected marker/card synchronization, viewport search, list fallback, and accessible keyboard/touch interaction.

Phase 1 implements the layer contracts and benchmark harness. Core markers/clusters can be active first. Heatmap, ScreenGrid, price surfaces, and other advanced layers are feature-flagged until the Redmi Note-class Android/4x CPU/4G benchmark passes. This is scoped activation, not removal.

## 12. Phase 1 media

Use Cloudflare R2 for images and Cloudflare Stream/HLS for video. Implement signed direct upload, processing states, AVIF/WebP derivatives, `srcset`, BlurHash/placeholder, image sitemap, poster-first video, captions, transcripts, video sitemap, hls.js fallback, moderation, EXIF stripping, and lifecycle cleanup.

## 13. Phase 1 conversion and broker operations

Implement listing gallery, video, RERA trust, broker identity, save, compare, similar listings, masked-contact leads, consent, dedupe, spam/risk checks, routing, broker notifications, user confirmations, event history, analytics, retention, and deletion.

Use Resend + React Email behind an `EmailProvider` interface. Implement Broker onboarding, organization roles, listing drafts, multi-step forms, autosave, media uploads, moderation queue, listing management, lead inbox, notifications, and audit history.

## 14. Phase 1 motion and premium UI

Implement GSAP, ScrollTrigger, Motion, CSS scroll-driven animation, and Lenis only on marketing routes. The home hero may use dynamic R3F/Drei with a static 2D fallback, reduced-motion fallback, no-WebGL fallback, and no impact on public SEO routes.

Motion includes hero entrance, scroll storytelling, cards, gallery transitions, page transitions, hover/focus states, filter-sheet transitions, upload progress, map/list synchronization, and broker dashboard feedback. Avoid motion on critical text or actions when it harms accessibility or performance.

## 15. Phase 1 jobs and integrations

Trigger.dev jobs include RERA adapters, source synchronization, media processing, embeddings, search refresh, cache revalidation, sitemap partitions, IndexNow, Search Console API, Bing Webmaster REST API, saved-search alerts, email notifications, freshness reviews, internal-link audits, canonical checks, structured-data checks, DNS registry checks, backup checks, and observability aggregation.

All jobs require idempotency keys, retries/backoff, dead-letter handling, run history, alerting, and safe replay.

## 16. Phase 1 tests and release gate

Required testing includes:

```text
TypeScript/lint/unit/integration
raw HTML and JavaScript-disabled SEO tests
canonical/metadata/JSON-LD/sitemap tests
redirect/lifecycle/facet/pagination tests
internal-link/orphan/click-depth tests
Playwright desktop/mobile/responsive tests
axe/WCAG 2.2 AA checks
Storybook and visual regression
map benchmark on Android/desktop
Fast 3G/4x CPU smoke tests
Core Web Vitals RUM instrumentation
security/upload/auth/CSRF/SSRF tests
migration/backups/restore/pool exhaustion tests
lead/notification/moderation/privacy tests
RERA parser fixtures and provenance tests
Hindi/English/localization rendering tests
```

Phase 1 is complete only when the product is deployable, rollback-tested, crawlable, secure, responsive, and core flows work without WebGL, LLM, semantic search, or heavy map layers.

---

# Phase 2 — Activation and scale

## 17. Phase 2 outcome

Phase 2 activates the advanced capabilities already integrated in Phase 1 and expands the marketplace’s geographic, linguistic, search, content, and operational depth. No foundation rewrite is permitted.

## 18. Phase 2 activation work

### 18.1 Advanced maps

Activate heatmap, ScreenGrid, price surfaces, density overlays, advanced clustering, viewport prefetching, map-to-list transitions, and layer controls after benchmark results meet device-specific budgets. Keep list-first and reduced-data fallbacks.

### 18.2 Semantic search and recommendations

Activate pgvector embeddings for similar listings, project relationships, locality intent, guide-to-entity links, natural-language preference matching, and personalized recommendations. Version embedding models, store model/version/timestamp, monitor drift, and provide keyword-search fallback.

### 18.3 LLM query interpretation

Enable LLM fallback for ambiguous and zero-result queries. Measure parse confidence, corrections, latency, cost, zero-result recovery, and conversion. Add prompt/version logging without storing unnecessary PII. Maintain deterministic parser supremacy for common queries.

### 18.4 Hindi and multilingual SEO publication

Publish reviewed Hindi pages for priority cities, localities, projects, guides, and high-value intents. Use stable ASCII slugs, localized visible names, locale-specific metadata, correct `hreflang`, translated JSON-LD where appropriate, and separate Search Console properties if needed.

Never mass-publish machine-translated thin pages. Each Hindi page requires translation status, editorial review, source alignment, freshness, canonical/alternate validation, and useful internal links. Add other Indian languages only after content ownership and quality processes are established.

### 18.5 Content and authority growth

Expand original city/locality guides, market methodology, RERA explainers, buying/renting guides, project comparisons, broker verification content, and locality intelligence. Use author/reviewer identity, citations, evidence, limitations, review cadence, freshness, and entity links.

Run authority dashboards showing page clusters, impressions, clicks, CTR, ranking distribution, citations, organic saves, leads, conversion, orphan pages, page quality, stale content, and crawl/indexation changes.

### 18.6 Media and rich experience

Activate richer Cloudflare Stream experiences, adaptive video, transcripts, captions, cinematic galleries, project walkthroughs, optional 3D marketing scenes, and richer card motion. Keep poster-first, reduced-motion, no-video, and low-data fallbacks.

### 18.7 Broker and lead operations

Add lead assignment rules, broker SLAs, notification escalation, masked-contact analytics, saved-search alerts, broker performance dashboards, verification levels, listing quality scores, duplicate detection, bulk editing, and controlled API/feed imports.

Do not introduce pay-per-lead billing until legal, commercial, consent, dispute, attribution, fraud, and invoice requirements are approved. The v7/v8 Lead schema remains compatible with future billing.

### 18.8 SEO automation

Increase event-driven audits and implement:

```text
crawl anomaly alerts
canonical/indexation anomaly detection
sitemap partition health
structured-data coverage
page-authority distribution
internal-link recommendations
stale content queues
RERA freshness alerts
Bing/Search Console trend reporting
AI citation/grounding measurement
```

## 19. Phase 2 scale and reliability

Load-test results, map, listing detail, broker dashboard, lead, RERA, sitemap, and search APIs. Validate Redis hot keys, PgBouncer limits, background job concurrency, media processing throughput, email delivery, rate limits, WAF rules, and database restore time.

Introduce read replicas or a provider-neutral search engine only when measured query volume or latency justifies it. The UI and domain contracts must not change.

## 20. Phase 2 gates

Phase 2 is complete when advanced maps, semantic search, LLM fallback, localized pages, rich media, and automation meet their benchmarks; Hindi pages pass editorial and SEO checks; no new thin-page/index bloat appears; lead and broker operations meet SLAs; and the platform remains functional under all fallbacks.

---

# Phase 3 — Optimization and expansion

## 21. Phase 3 outcome

Phase 3 improves measurable business performance and expands geography, languages, data partnerships, AI assistance, infrastructure resilience, and commercial operations without changing the core contracts.

## 22. Phase 3 optimization work

### 22.1 SEO and authority optimization

Use controlled experiments for title patterns, content modules, internal-link placement, images, video, structured data completeness, guides, and conversion blocks. Evaluate by page cluster and intent, not by isolated vanity rankings.

Improve page authority through original data, verified RERA evidence, locality intelligence, broker trust, useful comparisons, research-backed guides, public methodology, citations, partner relationships, and high-quality editorial links. Avoid paid or manipulative link schemes and copied portal content.

### 22.2 Search and AI optimization

Improve ranking models, Hindi transliteration, mixed-language search, synonym/alias coverage, semantic similarity, zero-result recovery, query understanding, recommendations, and personalization. Add human review for high-impact AI-generated outputs. Continue to prevent invented property facts, prices, availability, or regulatory claims.

Measure AI-search grounding through answer visibility, citation quality, source selection, page/entity accuracy, freshness, and conversion—not through unsupported promises of AI ranking.

### 22.3 Regional and language expansion

Expand city, locality, state, RERA, and guide coverage only when there is sufficient inventory, source quality, editorial ownership, and operational support. Add Marathi, Bengali, Tamil, Telugu, Kannada, Gujarati, Malayalam, Punjabi, or other languages only with a translation/evidence workflow comparable to Hindi.

Use stable route and entity identifiers, locale-specific dictionaries, aliases, `hreflang`, localized metadata, and separate quality monitoring.

### 22.4 Commercial and broker expansion

Evaluate verified broker subscriptions, lead-quality tiers, enterprise broker organizations, partner feeds, transparent analytics, optional pay-per-lead, sponsored inventory policies, and commercial reporting only after privacy, consent, fraud, attribution, dispute, and regulatory controls are complete.

Commercial surfaces must not compromise canonical pages, user trust, disclosure, page experience, or organic crawlability.

### 22.5 Infrastructure resilience

Evaluate multi-region services, database replicas, disaster recovery, cross-provider recovery, queue failover, media redundancy, regional data requirements, and incident exercises. Railway remains the primary platform unless measured requirements justify a migration. Fly.io may be evaluated as a controlled recovery target, not a second unmanaged production system.

### 22.6 Product optimization

Use field RUM, funnel analytics, search corrections, map/list behavior, saved-search usage, lead quality, broker response, media engagement, accessibility feedback, and support data to improve UI. Keep full motion only where it improves comprehension, delight, trust, or conversion. Maintain reduced-motion and low-data quality as first-class experiences.

## 23. Phase 3 gates

Phase 3 changes require:

```text
baseline metrics
→ hypothesis and affected page/feature cluster
→ experiment or controlled rollout
→ accessibility/performance/security review
→ SEO/canonical/indexation review
→ conversion and quality analysis
→ rollback plan
→ documented decision
```

No optimization may introduce duplicate indexable pages, stale metadata, inaccessible motion, hidden primary facts, unverified AI claims, unsafe media, PII leakage, or unexplained infrastructure risk.

---

# 24. Cross-phase ownership model

| Area | Phase 1 owner | Phase 2 owner | Phase 3 owner |
|---|---|---|---|
| Architecture/framework | Tech lead/platform | Platform lead | Architecture council |
| UI/design system | Design lead/frontend | Frontend/product design | Product design/research |
| SEO/page authority | SEO lead/backend | SEO/content/data | SEO/growth/partnerships |
| Data/search | Backend/data lead | Search/ML lead | Search/ML/product |
| Localization | Product/content + frontend | Localization/editorial | Regional expansion team |
| Infrastructure | Platform/DevOps | SRE/platform | SRE/architecture |
| Security/privacy | Security lead + counsel | Security/platform | Security/compliance |
| Broker/lead operations | Product/operations | Revenue operations | Commercial/product |
| Quality | QA/accessibility | QA/SRE | QA/experimentation |

# 25. Cross-phase definition of done

Every phase must leave the system:

```text
typed
versioned
observable
secure
accessible
crawlable where public
privacy-reviewed
rollback-capable
fallback-capable
documented for AI and human engineers
```

Any feature that cannot meet these conditions remains behind a feature flag or is not exposed publicly. It is not deleted from the architecture.

# 26. Final phase summary

```yaml
phase_1:
  name: foundation_and_first_complete_product
  includes:
    - full data model and domain contracts
    - Next.js 16 stable implementation and Cache Components validation
    - design system and Storybook
    - English and Hindi/Devanagari foundations
    - public page authority and SEO control plane
    - crawlable pages and sitemaps
    - PostgreSQL/PostGIS/pg_trgm/pgvector schema
    - deterministic search and optional LLM contract
    - MapLibre/deck.gl contract and benchmark harness
    - media, RERA, broker, leads, auth, security, privacy
    - premium motion with fallbacks
    - Railway production-services decision
    - testing, observability, backup, restore, and release gates

phase_2:
  name: activation_and_scale
  includes:
    - advanced map layers
    - semantic search and recommendations
    - LLM fallback activation
    - reviewed Hindi SEO publication
    - richer guides and authority operations
    - richer video/3D/media experiences
    - broker/lead automation
    - SEO/Search Console/Bing/RUM automation
    - measured scale and reliability improvements

phase_3:
  name: optimization_and_expansion
  includes:
    - SEO and conversion experiments
    - AI/search ranking optimization
    - additional Indian languages and regions
    - commercial broker products
    - resilience and disaster recovery expansion
    - evidence-based UX and motion optimization
```

# Final implementation statement

This three-phase plan preserves the complete approved solution. Phase 1 is the architectural and first-product foundation, Phase 2 activates advanced capability depth and scale, and Phase 3 optimizes and expands the platform. The separation prevents uncontrolled complexity from blocking delivery while ensuring that no major technology, UI system, SEO structure, localization foundation, or operational contract needs to be rebuilt later.
