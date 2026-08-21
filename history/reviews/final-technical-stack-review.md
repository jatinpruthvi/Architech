# Final Technical Stack Recommendation — UI-First Review

**Author:** Manus AI  
**Scope:** India real-estate aggregator with broker-submitted listings, rich media, RERA enrichment, search, map view, and broker operations.

## Executive assessment

The current recommendation is ambitious and contains many strong choices, particularly **Next.js, TypeScript, PostgreSQL, Cloudflare media delivery, MapLibre, accessible primitives, schema validation, and end-to-end testing**. It is capable of producing a premium interface.

However, it currently optimizes for an impressive technology inventory rather than the best user experience. The stack contains several overlapping solutions and a few claims that should be corrected. The biggest risk is not that the application will be too slow; it is that the team will spend time integrating animation, 3D, multiple state/data layers, and premature semantic-search infrastructure before the core search experience is reliable on mobile networks.

> **Recommendation:** Keep the overall direction, but simplify the runtime stack, make mobile and accessibility first-class, use the current Next.js rendering model rather than treating Next.js 15 PPR as the long-term decision, and define measurable UX budgets before adding advanced effects.

## What should change

| Area | Current plan | Recommended improvement | Reason |
|---|---|---|---|
| Framework | Next.js 15 + experimental PPR | **Next.js 16 App Router + Cache Components**, with a stable-rendering fallback if a dependency is incompatible | Next.js 16 replaces the old experimental PPR configuration with Cache Components and makes Turbopack stable. Next.js 15 PPR documentation explicitly labels PPR experimental and not recommended for production.[1] [2] |
| Data access | tRPC + TanStack Query + fetch + ISR/PPR | **Use Server Components and route handlers for initial/search-page data; use TanStack Query only for interactive client queries** | Avoids maintaining multiple fetching paradigms. Client caching should be reserved for map/list interactions, infinite scrolling, saved searches, and mutations. |
| State | TanStack Query + Zustand everywhere | **URL search parameters as the source of truth; Zustand only for transient UI state** | Search links become shareable, indexable, back-button friendly, and resilient to refresh. Zustand should not duplicate filter state already represented in the URL. |
| Search | Cmdk as a primary search pattern | **Dedicated mobile-first search/filter experience; Cmdk as an optional power-user enhancement** | Most users need locality autocomplete, Buy/Rent, budget, property type, BHK, and more filters—not a command palette. |
| Maps | MapLibre + react-map-gl + deck.gl from the start | **MapLibre with server-side clustering first; add deck.gl only when measured data volume requires it** | A simpler map is easier to debug, more accessible, and more reliable on low-end devices. GPU layers are an optimization, not a product requirement. |
| Animation | GSAP + CSS scroll-driven animation + Motion + Lenis | **CSS transitions plus one React motion library; reserve GSAP for a small marketing surface** | Four motion systems increase bundle, QA, and accessibility complexity. Listing/search screens should feel fast and calm rather than cinematic. |
| 3D | React Three Fiber hero | **Do not include in MVP; add only after performance budgets are met** | 3D rarely improves property discovery and adds GPU, battery, hydration, and accessibility costs. A high-quality image/video hero is safer. |
| UI foundation | shadcn/ui + Radix + custom components | **Keep, but formalize a product design system and accessibility contract** | The important advantage is ownership and composability, not the library name. |
| Fonts | Bricolage Grotesque + Inter | **Use one display family and one highly legible UI family only if both pass language and readability tests** | Confirm Devanagari coverage and fallback behavior before promising Hindi support. Use display typography only on marketing surfaces. |
| Media | R2 + Cloudflare Stream | **Keep; add upload validation, responsive image derivatives, poster frames, and low-bandwidth behavior** | Cloudflare Stream provides encoded adaptive-bitrate delivery; the user experience still depends on correct posters, lazy loading, captions, and upload progress.[3] |
| Database | PostgreSQL + Redis + pgvector + pg_trgm at launch | **PostgreSQL with full-text/trigram search first; introduce vector search after real query data exists** | Semantic search is valuable, but it should follow proven user language and listing-quality data. |
| Backend hosting | Vercel + Railway/Fly.io + Trigger.dev + Upstash | **Choose one primary operational model and document ownership boundaries** | The current combination is viable but operationally fragmented. Keep external services only where they clearly improve media, jobs, or reliability. |
| Quality | Lighthouse 90+ | **Use Core Web Vitals, device/network matrices, accessibility, and task completion as acceptance criteria** | A single Lighthouse score does not represent a real user on an inexpensive Android phone or a slow 4G connection. |

## Revised final stack

| Layer | Final recommendation |
|---|---|
| Web framework | **Next.js 16 App Router, TypeScript strict mode, React 19.2-compatible setup**. Use Cache Components where supported, with route-level caching and Suspense boundaries. Turbopack is the default bundler in Next.js 16.[2] |
| Rendering | Static and cached rendering for city, locality, project, and listing-detail SEO pages. Dynamic rendering for personalized dashboards and broker workflows. Stream only meaningful dynamic regions; do not stream every result card by default. |
| Styling and tokens | **Tailwind CSS v4 plus CSS custom properties**, with semantic tokens for surfaces, text, borders, focus, status, spacing, radii, elevation, and motion. Keep OKLCH where browser support and contrast testing are verified. |
| Components | **shadcn/ui, Radix primitives, and custom compound components**. Add Storybook or an equivalent component-review workflow, plus automated accessibility checks. |
| Client data | **TanStack Query** for interactive search results, map/list synchronization, infinite loading, optimistic saves, and mutations. Use native server fetching for initial page data. |
| Client state | **URLSearchParams** for filters and sorting. Use Zustand only for ephemeral state such as drawer visibility, map viewport, selected listing, compare tray, and upload progress. |
| Search | PostgreSQL full-text search, `pg_trgm`, curated locality aliases, normalized Indian addresses, and server-side autocomplete. Add OpenSearch/Typesense only when measured search scale or relevance requirements justify it. Add embeddings later for natural-language discovery. |
| Maps | **MapLibre GL** with server-side vector-tile or cluster endpoints. Use accessible list/map synchronization and a “show results in this area” action. Add deck.gl only after profiling on target devices. |
| Images | **Cloudflare R2 plus an image transformation/CDN layer**, responsive `srcset`, AVIF/WebP where supported, fixed aspect-ratio placeholders, blur or dominant-color placeholders, and lazy loading below the fold. Above-the-fold hero media should be explicitly prioritized. |
| Video | **Cloudflare Stream** for upload, encoding, adaptive bitrate, poster frames, captions where applicable, muted autoplay only when appropriate, and a clear low-bandwidth fallback. Stream supports adaptive-bitrate delivery across multiple resolutions.[3] |
| Forms | **React Hook Form + Zod**, with resumable multi-step broker onboarding, autosave drafts, upload retry, progress states, and server-side validation. |
| Motion | CSS transitions and keyframes for product UI. Use one React animation library for state transitions. Use GSAP only for a limited marketing/hero route. Honor `prefers-reduced-motion` and provide non-animated equivalents. |
| Authentication | Keep **Better Auth** only after verifying its current production maturity, adapter support, organization model, session security, and operational fit. Otherwise use the authentication provider that minimizes custom security maintenance. Do not describe it as “formerly Auth.js v5” without verification. |
| API boundary | Prefer a small, explicit API surface. Keep **tRPC** if the team values end-to-end TypeScript and the client/server boundary is primarily TypeScript; otherwise use typed route handlers or an API contract generator. Do not introduce tRPC merely because TanStack Query is present. |
| Database | **PostgreSQL 16+** with PostGIS if geographic queries are important, `pg_trgm`, full-text search, and appropriate indexes. Add Redis for rate limits and narrowly defined hot caches. |
| Jobs | Trigger.dev or an equivalent durable job runner for media processing, RERA synchronization, notifications, and embeddings. Every job must be idempotent, observable, retryable, and auditable. |
| Observability | Sentry for errors and traces, structured server logs, product analytics with privacy controls, and Web Vitals collection by route, device class, city, and network quality. |
| Testing | Vitest, Playwright, axe-based accessibility tests, visual regression tests for critical components, and performance tests on representative low-end Android and 4G profiles. |
| Delivery | Use one primary deployment provider for the web application and a clearly documented managed PostgreSQL/Redis/media arrangement. Keep media delivery separate if it materially improves cost or reliability. |

## UI architecture that will produce the best experience

The best interface should be **search-first, mobile-first, and confidence-building**. The home page should let a visitor choose Buy or Rent, select a locality, set a budget, and see useful inventory without learning the product. The results page should preserve the query in the URL, maintain the filter context while navigating, and make list/map switching instant. The detail page should make the first viewport useful even when video has not loaded.

A responsive layout should use three intentional modes rather than merely shrinking desktop CSS. On mobile, use a full-width result feed with a sticky filter action, bottom-sheet filters, and an optional map mode. On tablet, use a compact list/map split. On desktop, use a persistent filter rail or top filter bar with a synchronized map. This is more important to perceived quality than bento grids or 3D effects.

The result card should prioritize decision-making information. It should show an honest image ratio, locality, price, area, BHK, verification/RERA status, freshness, broker identity, and a save action. Avoid overloading cards with every badge. Use progressive disclosure for amenities, descriptions, and secondary metadata. Skeletons must preserve the final layout dimensions to prevent cumulative layout shift.

The interaction model should make every important action reversible and explain system status. Examples include “Saved,” “Removed,” “Uploading 3 of 8,” “Map area updated,” “Price not disclosed,” and “RERA data last checked on [date].” For broker workflows, draft persistence and recoverable upload failures will improve the actual product experience more than decorative animation.

## Performance and accessibility budgets

| Metric or behavior | Initial acceptance target |
|---|---:|
| Largest Contentful Paint on representative mobile 4G | ≤ 2.5 seconds on key landing and detail routes |
| Interaction to Next Paint | ≤ 200 milliseconds for filter, save, and drawer interactions |
| Cumulative Layout Shift | ≤ 0.1 |
| Initial JavaScript on results route | Establish a route budget and fail CI when exceeded; do not rely on a generic library-size claim |
| Search response | Fast cached response for common filters; show useful partial state without blocking the shell |
| Accessibility | WCAG 2.2 AA target for keyboard, focus, contrast, labels, dialogs, map alternatives, and screen-reader announcements |
| Motion | Reduced-motion mode must remove nonessential movement and preserve task completion |
| Low-end device behavior | No mandatory WebGL or video playback for core discovery tasks |
| Media | Correct aspect-ratio placeholders, responsive derivatives, poster frame, lazy loading, and upload retry |

## Revised implementation sequence

| Phase | Deliverable | UI value |
|---|---|---|
| 1 | Design tokens, responsive shells, accessible primitives, URL filter model, realistic seed data | Establishes a coherent product foundation |
| 2 | Search, locality autocomplete, filter persistence, result cards, loading/error/empty states | Delivers the core discovery loop |
| 3 | Detail pages, gallery, image optimization, save/compare, broker trust and RERA presentation | Builds confidence and conversion |
| 4 | MapLibre list/map mode, clustering, viewport search, mobile bottom sheet | Adds spatial discovery without making the map a dependency |
| 5 | Broker onboarding, resumable media uploads, drafts, validation, listing management | Improves inventory supply and partner satisfaction |
| 6 | SEO pages, structured metadata, sitemap, analytics, Core Web Vitals, accessibility and visual regression | Makes the experience discoverable and dependable |
| 7 | RERA jobs, notifications, saved alerts, relevance tuning | Adds retention and operational differentiation |
| 8 | Semantic search, deck.gl layers, advanced motion, or 3D only where product metrics justify them | Adds sophistication after the core experience is proven |

## Specific corrections to the original document

The statement that Next.js “dominates search results” should be removed. Search ranking is determined by content quality, technical SEO, crawlability, internal linking, structured data, authority, and user signals; no framework guarantees ranking. Similarly, a JavaScript-only application is not automatically invisible to search engines, although server-rendered or statically rendered HTML is usually a safer implementation for crawlability and performance.

The claims of “60fps at 50k+ points,” “10k markers in approximately 40ms,” exact bundle sizes, “70% CSS reduction,” and fixed development-time comparisons should not be presented as universal facts. They are benchmark-dependent. Replace them with a benchmark plan using representative Indian cities, realistic listing geometry, low-end Android hardware, and throttled networks.

The plan currently calls the design architecture “5 Pillars” but lists **six pillars**. Correct the heading. The suggested Bricolage Grotesque font characteristics and Devanagari coverage should also be verified against the exact font files selected before committing to Hindi support.

The RERA ingestion approach needs a source-by-source legal and reliability review. Public availability does not by itself guarantee permission for automated extraction, stable access, or unrestricted republication. Store provenance, retrieval time, source URL, parser version, confidence, and manual-review status for every enrichment record.

## Final decision

**Approve the stack direction, but do not approve the current stack table unchanged.** The revised choice should be:

> **Next.js 16 + TypeScript + Tailwind/CSS tokens + shadcn/Radix + URL-driven search state + TanStack Query for interactive data + PostgreSQL/PostGIS with trigram/full-text search + MapLibre with server-side clustering + R2/Cloudflare Stream + React Hook Form/Zod + durable jobs + Sentry/Playwright/axe/visual regression.**

Treat **deck.gl, pgvector, GSAP, Lenis, and React Three Fiber as conditional enhancements**, not foundational requirements. This version will provide a better UI because it concentrates engineering effort on fast search, stable responsive layouts, accessible controls, trustworthy listing information, resilient media, and measurable performance—the areas users experience on every visit.

## References

[1]: https://nextjs.org/docs/15/app/getting-started/partial-prerendering "Next.js 15 Partial Prerendering documentation"
[2]: https://nextjs.org/blog/next-16 "Next.js 16 release announcement"
[3]: https://developers.cloudflare.com/stream/ "Cloudflare Stream documentation"
