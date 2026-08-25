# Final Technical Stack Recommendation v5
## 2026 Technology-Gap Review and Production Architecture
### India Real Estate Aggregator — Full First-Phase Build

**Author:** Manus AI  
**Revision:** v5  
**Purpose:** Verify the v4 architecture against current 2026 technology guidance, identify missing production capabilities, and update the stack without removing any existing feature or technology.

## 1. Executive conclusion

Recommendation v4 was already architecturally strong. The v5 review found that the product does not need a replacement stack; it needs several **production-grade updates and explicit platform contracts**.

The existing UI, motion, SEO, page-authority, AI-search, mapping, media, RERA, broker, and data capabilities remain in first-phase scope. v5 adds or clarifies the following important 2026 requirements:

| v5 update | Decision |
|---|---|
| Next.js rendering | Replace the old `experimental_ppr` wording with **Next.js 16 Cache Components**. Do not configure Next.js 15 experimental PPR for a new production build. Next.js 16 removes the previous PPR configuration in favor of Cache Components.[1] |
| Request boundary | Use **`proxy.ts`** for Next.js 16 request interception. Treat old `middleware.ts` wording as legacy unless an edge-specific compatibility requirement exists.[1] |
| React performance | Add **React Compiler as an evaluated, opt-in production capability**. Enable it only after profiling because Next.js documents build-time overhead and it is not enabled by default.[1] |
| Observability | Add **OpenTelemetry** as the vendor-neutral trace and metrics layer, alongside Sentry and Pino. Next.js recommends OpenTelemetry and supports instrumentation out of the box.[2] |
| Authentication | Add **passkeys/WebAuthn** as a first-class authentication option, while retaining Better Auth, 2FA, magic links, and recovery flows. WebAuthn Level 3 is a 2026 W3C Candidate Recommendation Snapshot.[3] |
| Security | Add CSP, Permissions Policy, HSTS, secure cookie policy, CSRF protection, rate limits, upload scanning, dependency provenance, and supply-chain checks. CSP provides defense in depth against XSS and clickjacking.[4] |
| Media uploads | Add malware scanning, MIME/content verification, EXIF stripping, moderation/abuse review, resumable uploads, quotas, and media provenance. |
| Search | Keep PostgreSQL, `pg_trgm`, PostGIS, and pgvector. Add a **search abstraction** so Typesense/OpenSearch/Elasticsearch can be introduced without rewriting the UI if scale or relevance requires it. |
| Database reliability | Add connection pooling, read replicas when needed, PITR backups, restore drills, migration checks, and geospatial indexes. |
| SEO operations | Add automated crawl simulation, URL Inspection workflows, indexation telemetry, sitemap freshness checks, structured-data contract tests, and page-authority monitoring. |
| AI-search governance | Keep entity graph, citation-ready pages, IndexNow, Bing AI Performance, visible provenance, and freshness. Treat `llms.txt` as an optional supplemental file, never as a substitute for HTML, sitemaps, or robots controls. |
| Product analytics | Add privacy-aware event schemas, consent state, server-side conversion events, and search-quality metrics. |
| Resilience | Add error budgets, incident runbooks, feature flags, kill switches for 3D/motion/video/map layers, and graceful degradation. |

## 2. Full final stack — no capability removed

| Layer | v5 decision | 2026 update and implementation contract |
|---|---|---|
| Framework | **Next.js 16 App Router** | Use Cache Components, explicit `use cache`/cache profiles where appropriate, Suspense streaming, improved routing, and server-rendered public pages. |
| Bundler | **Turbopack stable** | Use the default Next.js 16 bundler. Keep a documented Webpack escape hatch only for an incompatible loader or third-party package. |
| Request boundary | **`proxy.ts`** | Use for redirects, security headers, locale/host routing, and request policy. Do not place database access or heavy business logic in the request boundary. |
| Language | **TypeScript strict mode** | Add generated API/entity types and compile-time route/metadata contracts. |
| React | **React 19.2-compatible setup** | Evaluate React Compiler; enable only after bundle, build, and runtime profiling. Use View Transitions and `useEffectEvent` where stable and beneficial. |
| Styling | **Tailwind CSS v4 + OKLCH CSS custom-property tokens** | Add semantic tokens for focus, contrast, status, surfaces, motion, reduced-motion, and high-contrast states. |
| Components | **shadcn/ui + Radix + custom compound components** | Add Storybook/component contracts, axe checks, keyboard behavior tests, and visual regression. |
| Server/client data | **Server Components + TanStack Query v5** | Server-render canonical SEO data; client query/cache for filters, maps, saves, compare, alerts, and mutations. |
| Client state | **Zustand v5** | Use only for ephemeral UI state. URL parameters remain canonical for search intent and filters. |
| Search | **PostgreSQL FTS + `pg_trgm` + locality normalization + search abstraction** | Start with PostgreSQL. Add Typesense/OpenSearch/Elasticsearch through an adapter when index scale, typo tolerance, ranking, faceting, or latency demands it. |
| Semantic search | **pgvector** | Use embeddings for locality intent, similar listings, project similarity, and natural-language search after normalized data and evaluation queries exist. |
| Geography | **PostGIS** | Store canonical city/locality boundaries, coordinates, nearby relationships, viewport search, and distance calculations. |
| Maps | **MapLibre GL + deck.gl + react-map-gl** | Full map experience, clusters, heatmaps, scatter/grid layers, marker/card sync, and accessible list fallback. |
| Search UX | **cmdk + conventional responsive search UI** | Command palette for power users; visible locality autocomplete and filters for ordinary users. |
| Images | **Cloudflare R2 + CDN + `next/image` + responsive AVIF/WebP** | Add responsive `srcset`, stable aspect-ratio placeholders, dominant-color/BlurHash, EXIF stripping, alt text, image sitemap, and media provenance. |
| Video | **Cloudflare Stream + HLS + hls.js** | Add poster frames, captions/transcripts, upload retry, content moderation, bandwidth-aware playback, and video sitemap. |
| Motion | **GSAP + ScrollTrigger + Motion + CSS scroll-driven animation + Lenis** | Retain real premium animation. Add motion budget, reduced-motion mode, kill switch, and route-specific loading boundaries. |
| 3D | **React Three Fiber + Drei** | Retain hero/marketing canvas. Add WebGL capability detection, device/battery-aware fallback, static poster, and no-3D core path. |
| Forms | **React Hook Form + Zod** | Add autosave drafts, resumable upload state, server-side validation, CSRF protection, and recovery UX. |
| Fonts/icons | **Bricolage Grotesque + Inter; Lucide + Phosphor** | Confirm exact font-file language coverage, subset fonts, and test CLS/FOIT/FOUT. |
| Database | **PostgreSQL 16+ + PostGIS + Redis 7 + pgvector + pg_trgm** | Add connection pooling, PITR, encrypted backups, restore drills, migration checks, and index health monitoring. |
| ORM | **Prisma** | Use typed access and migrations. Isolate raw SQL for PostGIS/vector/index-specific features. |
| Auth | **Better Auth current production release + WebAuthn/passkeys** | Retain orgs, roles, 2FA, magic links, recovery, and add passkeys for users/brokers where supported. |
| API | **tRPC v11** | Add API versioning policy, input size limits, idempotency keys for mutations, audit logs, and contract tests. |
| Virtualization | **TanStack Virtual** | Preserve accessible keyboard focus and stable DOM semantics in virtualized results. |
| Protection | **Upstash Ratelimit + Redis + WAF/bot controls** | Apply per-IP, per-account, per-broker, per-route, and upload limits. Protect autocomplete and lead endpoints. |
| Jobs | **Trigger.dev v3** | Add idempotency, dead-letter/retry policy, job audit records, revalidation, sitemap, IndexNow, RERA, embeddings, notifications, and media workflows. |
| RERA | **Playwright/CSV/source-specific adapters** | Add legal review, source terms, parser version, retrieval date, confidence, provenance, and manual review queue. |
| Observability | **OpenTelemetry + Sentry + Pino + Web Vitals** | OpenTelemetry provides portable traces/metrics; Sentry provides issue workflow; Pino provides structured logs. |
| Testing | **Vitest + Playwright + axe + visual regression + SEO crawler tests** | Add auth/security tests, upload abuse tests, schema tests, indexability tests, and low-end device/4G tests. |
| CI/CD | **GitHub Actions + dependency/security scanning** | Add lockfile integrity, SBOM/provenance, secret scanning, CodeQL or equivalent, container scanning, migration checks, and preview deploys. |
| Deployment | **Vercel web/edge + Railway/Fly.io persistent services** | Add health checks, rollback, database migration strategy, region/latency plan, backup policy, and incident runbook. |
| India performance | **Edge cache + AVIF + Network Quality API + device matrix** | Add adaptive animation, reduced-data mode, offline/error recovery, map simplification, and network-aware media. |
| SEO | **Page-authority graph + structured data + sitemaps + IndexNow + Search Console/Bing monitoring** | Add automated quality gates, orphan detection, URL policy, lifecycle management, freshness SLA, and citation tracking. |

## 3. Technology updates in detail

### 3.1 Next.js 16 Cache Components replaces old PPR wording

The original plan’s PPR concept remains correct, but the implementation language must be updated. In v5, use:

```ts
// next.config.ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  cacheComponents: true,
}

export default nextConfig
```

Use cache boundaries for stable city/locality/project content, explicit revalidation for listing updates, and Suspense boundaries around personalized or request-time sections. Do not copy the old `experimental_ppr` flag into a new project.

Use `revalidateTag()` with an explicit cache profile, such as `'max'`, or a documented custom profile. Tag routes by entity and cluster:

```text
listing:{listingId}
project:{projectId}
locality:{localityId}
city:{cityId}
rera:{registrationNumber}
seo-page:{canonicalUrl}
```

A listing update should revalidate the listing page, its project/locality/city summaries, related sitemap partition, and any cached search result that includes it.

### 3.2 React Compiler is an evaluation, not a blind switch

React Compiler can reduce manual memoization, but it may increase compilation cost. Add it to the first-phase architecture as a supported capability with an explicit benchmark gate:

| Test | Pass condition |
|---|---|
| Results route build time | No unacceptable CI/build regression. |
| Map/deck.gl route | No compiler incompatibility or hydration regression. |
| Broker dashboard | No form/input performance regression. |
| Production runtime | No increase in interaction latency or memory use. |
| Bundle | No unexplained increase in route JavaScript. |

If the gate fails, keep the compiler disabled while retaining correct component memoization and profiling. This is an update to the implementation decision, not a removal of the capability.

### 3.3 OpenTelemetry becomes the observability backbone

Add `instrumentation.ts` with OpenTelemetry. Sentry and Pino remain. Instrument the following spans and metrics:

| Signal | Required attributes |
|---|---|
| Page render | Route pattern, page type, cache hit/miss, city, locality, status. |
| Search | Query type, filter count, result count, latency, zero-result state, cache status. |
| Map | Viewport, cluster count, layer type, marker selection latency, fallback mode. |
| Media | Asset type, size, transformation, playback start, stall, failure, network class. |
| SEO | Canonical URL, index policy, sitemap group, metadata generation, render duration. |
| Jobs | Job type, entity ID, attempt, duration, error category, final status. |
| Leads | Page cluster, listing/project/broker ID, form completion, failure reason. |

Do not place personal phone numbers, email addresses, exact user location, or raw query text in traces without a privacy review and redaction policy.

### 3.4 Passkeys/WebAuthn for account security and conversion

Retain magic links and OTP-style recovery where required, but add passkey registration and sign-in for users and brokers. Passkeys reduce password friction and are especially useful for broker dashboards and saved-search alerts. WebAuthn credentials are scoped to the relying-party origin and use public-key authentication.[3]

Required flows:

```text
Register account
→ Add passkey
→ Sign in with passkey
→ Add second passkey/recovery method
→ Revoke lost device
→ Recovery with verified email/phone and risk checks
→ Audit security events
```

Use platform authenticators and security keys. Never create a recovery flow that bypasses organization roles or broker verification without audit logging.

### 3.5 Security baseline for a media-rich broker platform

Add the following security headers and controls:

| Control | Implementation |
|---|---|
| CSP | Start with `Content-Security-Policy-Report-Only`, then enforce a nonce/hash-based policy. Allow only required origins for R2, Stream, maps, analytics, fonts, Sentry, and auth. CSP is defense in depth, not a substitute for sanitization.[4] |
| HSTS | Enforce HTTPS after confirming every asset and subdomain is HTTPS-safe. |
| Permissions Policy | Restrict camera, microphone, geolocation, fullscreen, autoplay, and WebAuthn-related browser capabilities to required origins. |
| Cookies | Secure, HttpOnly, SameSite, short-lived session cookies with rotation and revocation. |
| CSRF | SameSite cookies plus server-side CSRF protection for state-changing requests. |
| XSS | Sanitize user descriptions, broker text, URLs, SVG/media metadata, and guide HTML. Never trust listing content. |
| Upload security | Signed direct uploads, content-type verification, size/duration limits, virus scanning, EXIF stripping, moderation queue, and private originals. |
| Authorization | Server-side ownership/organization checks on every broker/listing/media/lead operation. |
| Audit log | Auth changes, role changes, listing changes, RERA edits, media replacements, leads, exports, and admin actions. |
| Supply chain | Lockfile integrity, dependency review, SBOM, secret scanning, CodeQL/equivalent, container scans, and signed build provenance. |
| Abuse | Bot detection, rate limits, lead abuse controls, upload quotas, spam reports, and account/device risk signals. |

## 4. Search architecture update

The v4 PostgreSQL search plan remains the starting point. v5 formalizes a provider-neutral search interface:

```ts
interface ListingSearchProvider {
  autocomplete(input: AutocompleteInput): Promise<AutocompleteResult[]>
  search(input: ListingSearchInput): Promise<ListingSearchResult>
  similar(input: SimilarListingInput): Promise<ListingSummary[]>
  nearby(input: NearbySearchInput): Promise<ListingSummary[]>
}
```

### 4.1 Search phases inside the same first phase

| Search capability | v5 implementation |
|---|---|
| Exact structured filters | PostgreSQL indexes and typed query builder. |
| Locality autocomplete | Normalized locality tables, aliases, transliteration, `pg_trgm`, popularity/freshness scoring. |
| Geographic search | PostGIS geometry, bounding boxes, distance, locality containment. |
| Full-text query | PostgreSQL FTS with weighted fields for title, locality, project, amenities, and description. |
| Natural-language query | Query parser extracts intent, city/locality, budget, BHK, property type, and preference signals. |
| Semantic similarity | pgvector embeddings for similar listings/localities/guides. |
| High-scale faceting | Search adapter can route to Typesense/OpenSearch/Elasticsearch after measured need. |
| Search quality | Golden query set, offline NDCG/precision checks, zero-result analysis, click-through and lead conversion feedback. |

Never let an AI parser invent a listing fact. The parser may infer a filter; the final result must come from structured data and visible provenance.

## 5. 2026 SEO and AI-search updates

### 5.1 Keep the page-authority architecture

The v4 hierarchy remains:

```text
Trust and brand
→ Intent hubs
→ City authorities
→ Locality authorities
→ Qualified intent pages
→ Project / broker / RERA entities
→ Active listing pages
```

v5 adds three controls:

1. **Page authority registry:** every indexable page stores its primary intent, parent entity, canonical URL, quality state, sitemap group, reviewer, last meaningful edit, and index policy.
2. **Authority graph monitoring:** nightly jobs find orphan pages, excessive click depth, unbalanced clusters, duplicate intent, and weak inbound links.
3. **Quality threshold:** a locality or intent page cannot become indexable merely because a template exists; it must have current inventory, unique content, meaningful internal relationships, and verified data.

### 5.2 AI-search visibility is measured, not assumed

Retain JSON-LD, stable entity IDs, visible facts, provenance, freshness, image/video metadata, IndexNow, Bing AI Performance, and citation-ready answer blocks. Add:

| v5 addition | Solution |
|---|---|
| AI citation analytics | Record cited URL, grounding query, page type, fact block, freshness, and citation trend where available. |
| Answer-block quality | Ensure price, locality, BHK, area, RERA, broker, availability, and date are visible near the top. |
| Fact provenance | Link each important claim to source, retrieval date, broker submission/update, or methodology. |
| AI-generated content governance | Human reviewer, source links, originality check, disclosure where expected, and no mass-generated thin pages. |
| `llms.txt` | Maintain an optional concise index of important public resources if useful, but do not treat it as a recognized replacement for HTML, XML sitemaps, canonical links, or robots.txt. |
| Bot policy | Document allowed/blocked crawlers in robots.txt and review AI crawler policies intentionally; do not accidentally block search engines or desired citation systems. |

### 5.3 Search Console and Bing operating loop

Create a monthly SEO review that compares:

```text
Indexed canonical pages
→ Query impressions/clicks
→ Page cluster performance
→ Crawl errors and render issues
→ Web Vitals by route
→ Internal-link/orphan changes
→ Freshness and expired inventory
→ Bing AI citations and grounding queries
→ Leads and saves by organic page cluster
```

The goal is not simply more indexed URLs. The goal is more qualified organic discovery, useful AI citations, property saves, contact leads, and repeat visits.

## 6. Media pipeline v5

The original R2/Stream decision remains. Add a complete asset lifecycle:

```text
Broker direct upload
→ Signed upload URL
→ MIME/content validation
→ Malware scan
→ EXIF/location metadata removal
→ Image derivatives or Stream encoding
→ Moderation/review
→ Poster/BlurHash/caption generation
→ Entity association
→ CDN publication
→ Sitemap/JSON-LD/revalidation event
→ Retention/deletion policy
```

The system must distinguish original private upload, processed public asset, thumbnail, poster, transcript, and deleted/replaced asset. Never expose an unvalidated broker upload directly through a public URL.

For videos, support HLS, poster frames, captions, visible text summary, `VideoObject`, bandwidth-aware loading, playback telemetry, and a static fallback. For images, support `srcset`, `sizes`, AVIF/WebP, fixed aspect ratios, alt text, descriptive filenames, and image sitemap entries.

## 7. Privacy, consent, and Indian operations

Add a privacy architecture before analytics, lead routing, location features, and personalized alerts are implemented. This is not legal advice; the product team should obtain India-specific privacy and real-estate legal review.

Required capabilities include consent state, purpose limitation, data minimization, retention/deletion workflows, user export/deletion requests, broker organization boundaries, PII redaction from logs/traces, encrypted secrets, audit trails, and documented third-party data processing. Geolocation should be opt-in and approximate unless precise location is genuinely required.

## 8. Reliability and disaster recovery

Add production operating contracts:

| Area | Requirement |
|---|---|
| Backups | Automated PostgreSQL backups, PITR where available, encrypted backup storage, and retention policy. |
| Restore | Scheduled restore drills with measured RTO/RPO. |
| Deployments | Preview, canary or controlled rollout, migration compatibility, rollback plan. |
| Jobs | Idempotency keys, retries, dead-letter state, replay tools, and job audit history. |
| Cache | Tagged invalidation, stale-while-revalidate policy, emergency purge, and cache-miss metrics. |
| Dependencies | Provider failure fallback for maps, video, search, email/OTP, and analytics. |
| Feature flags | Kill switch for R3F, advanced deck.gl, autoplay video, Lenis, heavy animations, semantic search, and external search provider. |
| Incident response | Ownership, alert thresholds, runbook, status communication, and post-incident review. |
| SLOs | Availability, search latency, page-render latency, media-start success, upload completion, and job success. |

## 9. Frontend architecture for premium motion and resilience

### 9.1 Route bundles

| Route group | Allowed heavy capability | Required fallback |
|---|---|---|
| Marketing home | GSAP, ScrollTrigger, Lenis, R3F/Drei, gradient mesh | Static hero and normal scrolling. |
| City/locality SEO pages | Motion transitions, light card reveals, map optional | Server-rendered content and list-first layout. |
| Results | MapLibre, deck.gl, Motion, TanStack Virtual | Text/list results, static map placeholder, reduced layer mode. |
| Detail | Gallery, hls.js, Motion, video | Static image, poster, text summary, accessible lightbox. |
| Broker dashboard | Motion feedback, upload progress | Functional forms without decorative animation. |

### 9.2 Interaction budgets

The team must measure and enforce route budgets rather than use generic bundle claims:

| Metric | Target |
|---|---:|
| LCP on key public mobile route | ≤ 2.5 seconds at the selected field threshold. |
| INP on search/save/filter interaction | ≤ 200 milliseconds target. |
| CLS | ≤ 0.1 target. |
| Server response | Stable TTFB/latency by region and cache state. |
| Result interaction | Filter state visible immediately; no full-page blocking spinner. |
| Video start | Poster visible immediately; playback is optional and adaptive. |
| WebGL fallback | Core task completion without WebGL. |
| Reduced motion | All core tasks complete with animation disabled. |

## 10. Testing and CI v5

| Test class | New v5 coverage |
|---|---|
| Unit | URL grammar, index policy, metadata, canonical builders, price/area, RERA parsing, search parser, permission checks. |
| Integration | Auth/passkeys, broker organization isolation, media signing/scanning, DB migrations, job idempotency, cache revalidation. |
| E2E | Search, filters, map/list, detail, save, compare, broker upload, RERA display, expired listing, account recovery. |
| SEO | Rendered HTML, title/H1, canonical, robots, JSON-LD, sitemap membership, 404/410, redirects, orphan pages, parameter policy. |
| Accessibility | axe, keyboard-only, screen reader smoke tests, focus restoration, reduced motion, map/list equivalence. |
| Security | CSP report-only/enforce, XSS payloads, CSRF, authorization, rate limits, upload abuse, dependency audit, secret scan. |
| Performance | 4G, low-end Android, CPU throttling, WebGL/no-WebGL, video-disabled, cache hit/miss, cold/warm render. |
| Visual | Responsive screenshots, motion-on/off snapshots, gallery, map, broker forms, dark/light/high-contrast themes. |
| Observability | Trace propagation, PII redaction, errors linked to route/entity/job, Web Vitals ingestion. |

## 11. Updated first-phase execution sequence

Nothing is deferred from first phase. The sequence prevents rework.

| Order | Workstream | v5 output |
|---:|---|---|
| 1 | Next.js 16, TypeScript, Turbopack, Cache Components, `proxy.ts`, tokens, fonts, shadcn/Radix | Current framework foundation. |
| 2 | Entity/page-authority model, URL grammar, indexability policy, canonical/robots contract | SEO architecture before templates. |
| 3 | PostgreSQL/PostGIS/Redis/pgvector/pg_trgm/Prisma, pooling, backups, migrations | Reliable domain and search data layer. |
| 4 | Better Auth, passkeys/WebAuthn, 2FA, magic links, recovery, audit logs | Secure account and organization model. |
| 5 | Search abstraction, locality normalization, structured search, semantic parser, quality evaluation | Strong discovery engine. |
| 6 | City/locality/project/listing/broker/RERA/guide templates and server rendering | Page-authority website. |
| 7 | Internal-link graph, sitemaps, JSON-LD, metadata, IndexNow, Search Console/Bing integration | Crawl, index, and AI-discovery operations. |
| 8 | MapLibre/deck.gl/react-map-gl, list fallback, virtualized results | Full map/list UI. |
| 9 | R2/Stream, scanning, EXIF removal, derivatives, captions, posters, moderation | Secure rich-media pipeline. |
| 10 | Detail, gallery, video, RERA trust, save, compare, similar listings | Premium conversion experience. |
| 11 | Broker dashboard, forms, drafts, resumable uploads, leads, notifications | Complete partner experience. |
| 12 | GSAP, ScrollTrigger, Motion, CSS scroll-driven, Lenis, R3F/Drei | Real premium motion system. |
| 13 | OpenTelemetry, Sentry, Pino, Web Vitals, analytics, privacy/consent | Observable and privacy-aware product. |
| 14 | Security headers, CSP, WAF/bot controls, dependency security, upload security | Production security baseline. |
| 15 | Trigger.dev jobs, RERA, embeddings, revalidation, authority audits, citation monitoring | Automated freshness and authority operations. |
| 16 | Vitest, Playwright, axe, security, SEO crawler, visual, performance, device testing | Release readiness. |

## 12. Final v5 checklist: missing items resolved

| Potential missing item | Status in v5 |
|---|---|
| Current Next.js rendering model | Updated to Cache Components. |
| Current request boundary | Updated to `proxy.ts`. |
| React Compiler | Added as profiled opt-in capability. |
| OpenTelemetry | Added alongside Sentry and Pino. |
| Passkeys/WebAuthn | Added alongside existing auth methods. |
| CSP and modern browser security | Added. |
| Permissions Policy/HSTS/secure cookies | Added. |
| CSRF and XSS defense | Added. |
| Upload malware scanning and EXIF removal | Added. |
| Media moderation and retention | Added. |
| Search-provider abstraction | Added without replacing PostgreSQL. |
| PostGIS | Added explicitly. |
| DB backups and restore drills | Added. |
| Job idempotency/dead-letter handling | Added. |
| SBOM, dependency, secret, and code scanning | Added. |
| Privacy/consent/PII redaction | Added. |
| Feature flags and graceful degradation | Added. |
| Error budgets/SLOs/incident runbooks | Added. |
| AI-search measurement | Added through Bing AI Performance and citation telemetry. |
| `llms.txt` positioning | Added as optional supplemental file, not a primary SEO control. |
| SEO crawler and authority graph monitoring | Added. |
| No-WebGL/no-video/reduced-motion paths | Added. |
| Passkey/account recovery audit logging | Added. |

## 13. Final recommendation

The v5 recommendation is to **keep the complete original architecture and make it production-current through explicit contracts**. The solution should not remove advanced motion, 3D, deck.gl, semantic search, RERA automation, or rich media. Instead, it should place each capability behind a clean boundary:

```text
Server-rendered authority pages
+ canonical entity graph
+ explicit cache/revalidation
+ secure authenticated application
+ resilient media pipeline
+ provider-neutral search
+ premium motion with fallbacks
+ OpenTelemetry/Sentry/Pino observability
+ security/privacy/recovery controls
+ automated SEO and authority operations
```

The largest v5 risk is no longer a missing frontend library. It is operational complexity. The project should therefore enforce ownership boundaries, explicit contracts, observability, security testing, page-quality gates, and graceful fallbacks from the first commit.

The architecture is now current for 2026 while preserving the user’s requirement that the full capability set be implemented in the first phase.

## References

[1]: https://nextjs.org/blog/next-16 "Next.js 16 release announcement"
[2]: https://nextjs.org/docs/app/guides/open-telemetry "Next.js OpenTelemetry instrumentation guide"
[3]: https://www.w3.org/TR/webauthn-3/ "W3C Web Authentication Level 3 Candidate Recommendation Snapshot"
[4]: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CSP "MDN Content Security Policy guide"
[5]: https://developers.google.com/search/docs/fundamentals/seo-starter-guide "Google Search Central SEO Starter Guide"
[6]: https://developers.google.com/search/docs/fundamentals/creating-helpful-content "Google Search Central people-first content guidance"
[7]: https://developers.google.com/search/docs/essentials/spam-policies "Google Search Central spam policies"
[8]: https://developers.google.com/crawling/docs/crawl-budget "Google Crawling Infrastructure crawl budget guidance"
[9]: https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics "Google Search Central JavaScript SEO basics"
[10]: https://blogs.bing.com/webmaster/February-2026/Introducing-AI-Performance-in-Bing-Webmaster-Tools-Public-Preview "Bing AI Performance public preview"
[11]: https://www.indexnow.org/documentation "IndexNow documentation"
