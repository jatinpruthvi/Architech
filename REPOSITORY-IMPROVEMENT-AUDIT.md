# Architech Repository Improvement Audit

**Author:** Manus AI  
**Audit date:** 25 August 2026  
**Repository revision reviewed:** `a77e526` — `feat(governance/order): authority registry + API, media-attach audit hardening (#30)`

## Executive assessment

Architech has moved well beyond a visual prototype. The repository now contains a Next.js 16 App Router application, a domain model, public SEO routes, broker and moderation workflows, Prisma persistence, media contracts, observability, Storybook and Playwright configuration, and a substantial unit-test suite. The architectural direction is strong and unusually explicit for an early marketplace product.

The principal risk is no longer missing capability. It is **activation safety**: several production-looking routes still operate through demo or fallback modes, and private API handlers need a uniform server-side authorization boundary before real broker, lead, media, or authority data is connected. The next improvement cycle should therefore prioritize production safety and contract correctness before adding more visual features.

| Area | Current assessment | Priority | Main reason |
|---|---|---:|---|
| Product foundation | Strong prototype-to-product transition | P1 | Public, broker, moderation, saved-search, RERA, and media surfaces exist. |
| SEO architecture | Strong design, incomplete runtime proof | P1 | Registry and generators exist, but route-level HTML and production-data gates need continuous verification. |
| Security and authorization | Highest risk area | P0 | Several private API routes do not visibly derive authorization from a live request session. |
| Performance | Good intent, failed full build in this environment | P1 | `next build` was terminated with exit 143 under sandbox memory pressure; image and bundle strategy still needs measurement. |
| Test quality | Broad coverage with one failing contract test | P1 | 227 of 228 tests passed; the Better Auth test is not hermetic against ambient environment variables. |
| Documentation/governance | Rich but internally drifting | P1 | README, historical reviews, and current application structure describe different repository eras. |
| UI/UX | Distinctive foundation | P2 | The next gains should come from real data states, progressive disclosure, and workflow feedback rather than additional decorative motion. |

## Validation performed

The following checks were run against the pulled repository. `pnpm check` passed. `pnpm lint` completed with one warning for an unused `authorityOutreachGet` import in [`client/src/lib/api-contract.test.ts`](../client/src/lib/api-contract.test.ts). The unit suite ran 47 test files: 46 passed and one failed. The failing test is [`client/src/lib/auth/auth.test.ts`](../client/src/lib/auth/auth.test.ts), where the test expects `DATABASE_URL` to be reported missing, but the process environment already supplies it. The implementation in [`client/src/lib/auth/source.ts`](../client/src/lib/auth/source.ts) is therefore being tested against ambient environment state rather than a hermetic fixture.

`pnpm build` reached the optimized Next.js build stage but was terminated with exit code 143 while compiling. This is consistent with the sandbox’s high memory-pressure warning and should not be treated as proof of an application compile error. It is nevertheless a release concern: the repository should document a memory-safe build profile and measure the build in CI with a known resource budget.

The development server restarted successfully on Next.js 16.3.2 after the pull. The preview rendered the Ahmedabad editorial home surface, including the newer header controls and `List your property` navigation.

## P0 — secure the production boundary before real data activation

### 1. Centralize server-side authorization for every private route

The most important improvement is a single server-only request authorization layer used by every broker, admin, moderation, media-management, authority, observability, and saved-data handler. The current routes such as [`app/api/broker/listings/route.ts`](../app/api/broker/listings/route.ts), [`app/api/admin/moderation/listings/route.ts`](../app/api/admin/moderation/listings/route.ts), [`app/api/admin/media/[uploadId]/moderate/route.ts`](../app/api/admin/media/[uploadId]/moderate/route.ts), and [`app/api/authority/assets/route.ts`](../app/api/authority/assets/route.ts) do not visibly require a live session or permission before reading or mutating data.

The use of `demoBrokerSession` in the broker listing route is acceptable for a controlled prototype but dangerous if the route can remain reachable after production deployment. Production behavior should fail closed when Better Auth, the database, or the organization context is unavailable. Demo sessions should be enabled only under an explicit development/demo flag and should never be used for an `APP_ENV=production` request.

| Required control | Acceptance evidence |
|---|---|
| `requireSession()` server helper | Unauthenticated request receives 401 without touching the repository. |
| `requirePermission()` server helper | Authenticated but unauthorized request receives 403. |
| Organization scoping | Every broker/admin query includes the authenticated organization or platform scope. |
| Demo-mode gate | Demo sessions are impossible when `APP_ENV=production`. |
| Audit correlation | Mutation routes record actor ID, organization ID, request ID, and entity ID. |
| Contract tests | Each private route has unauthenticated, unauthorized, authorized, and cross-tenant tests. |

This item should be completed before connecting live leads, media uploads, RERA corrections, authority outreach, or broker data.

### 2. Make privacy and abuse controls executable, not only documented

Lead, media, authority, and AI endpoints need explicit rate limits, request-size limits, CSRF/origin controls where cookie authentication is used, idempotency keys for retried mutations, and structured redacted logging. These contracts are partly represented in the repository, but the route handlers should be tested as deployed HTTP boundaries, not only through helper functions. AI routes in [`app/api/ai`](../app/api/ai) should also have cost, payload, and abuse budgets enforced at the handler boundary.

### 3. Tighten the Content Security Policy by environment

[`next.config.ts`](../next.config.ts) currently permits `'unsafe-inline'` and `'unsafe-eval'` in `script-src`, while `frame-ancestors` allows `https://*.e2b.app`. These choices are understandable for a managed preview and the inline pre-paint theme script, but they should not be the default production policy. Use environment-specific headers, nonce-based inline scripts or an external theme bootstrap, and a narrowly scoped frame policy. The production policy should explicitly include only the real image, map, Sentry, and API origins required by the deployed application.

## P1 — make SEO claims continuously provable

### 4. Add route-level SEO acceptance tests against rendered HTML

The repository has a strong SEO contract library and route registry, including canonical URL policy, lifecycle decisions, sitemap generation, robots behavior, and JSON-LD expectations. The next improvement is to test the output of real public routes. For every representative route class, assert the response status, canonical URL, title, description, `robots` behavior, breadcrumb JSON-LD, primary entity JSON-LD, visible heading, and crawlable internal links. Add explicit tests for an active, sold, expired, removed, duplicate, draft, and unknown listing lifecycle.

The current test suite proves many individual decisions, but it does not yet provide a single release gate saying: **the browser and raw HTML receive the same canonical, indexability, and entity facts**. That gap matters for a Google-first product because client-side success is not equivalent to crawlable output.

### 5. Introduce a production-data indexability gate

The README correctly states that listings, statistics, testimonials, and RERA numbers are illustrative demo data ([`README.md`](../README.md), line 28). The same repository also exposes indexable public pages and JSON-LD. Add a hard gate so demo or unapproved data cannot accidentally be served with indexable metadata in production. A public route should be one of three explicit states: production-approved and indexable, real but noindex while under review, or demo-only and blocked from indexing.

This should cover pages, structured data, sitemaps, OG images, guides, locality counts, broker identity, and RERA evidence. It should also prevent illustrative values such as `GJ/RERA/AHM/2026/04821-DEMO` in [`prisma/seed.mjs`](../prisma/seed.mjs) from entering a production sitemap or public trust surface.

### 6. Add SEO freshness and content quality observability

The architecture emphasizes freshness, source trails, and authority, but the operational layer should expose measurable alerts: pages with stale evidence, indexable pages with no source, pages below the minimum content threshold, orphan pages, sitemap-to-registry mismatches, and canonical URLs that return non-200 responses. These checks belong in CI and in the observability dashboard, not only in a document.

## P1 — improve performance and delivery reliability

### 7. Measure and reduce the critical JavaScript and image path

The application has many capabilities in one repository: MapLibre, Storybook, Radix primitives, broker workflows, AI helpers, media, and public pages. Public marketing and locality routes should not pay for authenticated broker and map functionality before it is needed. Establish route-level bundle budgets and inspect the client graph with a bundle analyzer. MapLibre and broker-only controls should be dynamically imported behind the relevant route or interaction.

[`next.config.ts`](../next.config.ts) sets `images.unoptimized: true`, and the root layout uses a plain `<img>`/preload strategy documented as pre-generated derivatives. This is workable for a static asset prototype but leaves bandwidth, responsive sizing, cache behavior, and content negotiation to manual discipline. Move toward `next/image` or a tested image loader contract for R2/CDN derivatives, with explicit `sizes`, AVIF/WebP negotiation, low-quality placeholders, and a single above-the-fold priority image per route.

### 8. Establish a reproducible low-memory build profile

The production build was terminated with exit code 143 in the sandbox during optimization. CI should run the same build with a documented memory budget and produce a clear diagnostic when the process is killed. If the build is consistently memory-heavy, investigate route graph size, source-map settings, Turbopack/webpack mode, and generated artifacts before adding more dependencies. The goal is not merely to make one sandbox build pass; it is to make the release build predictable on the selected free-first infrastructure.

### 9. Replace external font stylesheet loading with an owned font strategy

The root layout loads Google Fonts from [`app/layout.tsx`](../app/layout.tsx). For a premium India-first experience, use a controlled `next/font` strategy or self-host reviewed font files, including only the Latin and Devanagari subsets that are actually required. This improves privacy, reduces an external rendering dependency, and makes the typography budget explicit. Validate Hindi line wrapping at mobile widths after the change.

## P1 — reconcile repository truth and developer workflow

### 10. Rewrite the README around the current reality

The README simultaneously says that the repository is “the architecture source, not the application source code” and that it contains the working Next.js application ([`README.md`](../README.md), lines 7–11). That contradiction will mislead both human engineers and AI coding systems. Replace it with a clear split: the repository is the **architecture, governance, and reference implementation**; the `app/`, `client/`, `prisma/`, `seo/`, and `governance/` directories are named sources of truth for their respective concerns.

The README should also reconcile the approved hosting table with the current free-first strategy, identify which integrations are mocked or fallback-backed, and state the exact production activation gates. Historical documents such as [`IMPROVEMENT-REVIEW-2.md`](../IMPROVEMENT-REVIEW-2.md) still describe the earlier Vite/wouter era and should be marked as historical or moved under `history/` so they are not mistaken for current work instructions.

### 11. Add a generated repository status page

The breadth of the repository makes manual status drift likely. Generate a compact `STATUS.md` or README section from tests and contract registries showing current revision, implemented work IDs, open gates, data-source mode, indexability mode, and environment readiness. This would make the project easier for another AI system to understand without requiring it to infer state from several historical documents.

## P1 — strengthen data correctness and operational durability

### 12. Make fallback adapters explicit in production

The codebase uses provider-neutral interfaces and fallback modes, which is a good architectural choice. The risk is silent fallback. Every fallback should emit a typed health signal, be visible in `/api/observability/status`, and be capable of failing the production readiness check when the feature is required. For example, a demo lead store or demo RERA adapter should not look equivalent to a live source in the broker or public trust UI.

### 13. Add transactional and idempotent mutation tests

Broker listing submission, media attachment, media completion, lead status changes, consent revocation, moderation, authority outreach, and RERA correction flows should be tested for retries, duplicate requests, partial failures, and concurrent updates. The current contracts have good unit coverage, but the durable behavior should be verified at the repository and route level with explicit idempotency keys and transaction boundaries.

### 14. Verify database indexes against actual query shapes

Before importing a meaningful Ahmedabad inventory, review the Prisma schema and migrations against the query patterns used by locality pages, search suggestions, map viewport queries, organization-scoped broker lists, lead inboxes, and lifecycle filters. Add explain-plan checks for the top public queries and tenant-scoped mutations. PostGIS, trigram, and full-text capabilities should be activated only where measurements show they are needed; the important requirement is predictable latency and correct scoping.

## P2 — improve product UX without adding spectacle

### 15. Complete the real user-state matrix

The visual direction is distinctive and the motion system is appropriate, but the next UX improvement should be the state completeness of the product. Every important action should have loading, success, failure, retry, disabled, permission-denied, and offline/reconnect behavior. The highest-value flows are save, compare, search suggestions, map/list switching, broker lead submission, media upload, moderation, and saved-search creation.

The interface should preserve the Editorial Terracotta character through evidence-aware progressive disclosure: source and freshness details can expand without layout jumps; the map can remain an enhancement to the crawlable list; and motion should communicate state changes rather than merely decorate sections. Keep `prefers-reduced-motion` coverage and keyboard focus visible as the application becomes more interactive.

### 16. Make Hindi a tested product path

The repository has a Hindi foundation and localized names, but the next step is to test the actual language toggle across navigation, titles, metadata, breadcrumbs, search aliases, empty states, form validation, and broker surfaces. Do not publish Hindi SEO alternates until each alternate is genuinely translated and equivalent. Add visual regression snapshots for Devanagari wrapping at 320px, 390px, and 768px widths.

### 17. Add honest data-density cues to search and locality pages

Counts, “updated today,” source-review labels, and availability should be derived from data state rather than static fixtures. When data is partial, display the coverage window and source scope. When a locality has no approved inventory, show a useful guide or saved-search path instead of a thin indexable page. This will improve user trust and protect the page-authority model from low-value expansions.

## Recommended implementation sequence

| Order | Work package | Priority | Effort | Definition of done |
|---:|---|:---:|---:|---|
| 1 | Central private-route authorization and production demo gate | P0 | 2–4 days | All private routes have 401/403 tests, organization scoping, and no demo session in production. |
| 2 | Hermetic test environment and failing Better Auth contract repair | P0 | 0.5 day | 228/228 tests pass regardless of injected sandbox environment variables. |
| 3 | Rendered HTML SEO release gate | P1 | 2–3 days | Representative route classes pass raw HTML, metadata, JSON-LD, sitemap, and lifecycle checks. |
| 4 | Build and bundle budget investigation | P1 | 1–2 days | CI build is reproducible within the declared memory budget; public route bundle limits are recorded. |
| 5 | Image/font delivery hardening | P1 | 1–2 days | Responsive images, controlled fonts, LCP image policy, and mobile bandwidth checks are automated. |
| 6 | CSP and mutation abuse controls | P1 | 1–2 days | Production CSP is strict, mutation routes have rate/idempotency/origin controls, and logs are redacted. |
| 7 | Documentation and status consolidation | P1 | 1 day | README, historical reviews, Phase 1 tracker, and environment gates tell one consistent story. |
| 8 | Data-backed UX state matrix | P2 | 2–4 days | Save, compare, search, map/list, leads, media, and moderation flows have complete async/error states. |
| 9 | Hindi visual and route QA | P2 | 1–2 days | English/Hindi behavior is tested at mobile breakpoints and alternates are only published when equivalent. |

## Suggested first three implementation tickets

**Ticket A — `P1-AUTHZ-001`:** Create `requireRequestSession`, `requirePermission`, and `requireOrganizationScope` server helpers. Migrate one route from each private family—broker, admin, media, authority, leads, and saved searches—and add 401, 403, cross-tenant, and success tests before migrating the rest.

**Ticket B — `P1-SEO-HTML-001`:** Add a Playwright/raw-response route matrix for home, city, locality, listing, guide, search, and lifecycle variants. Assert canonical URL, indexability, JSON-LD entity type, breadcrumbs, visible heading, status code, and sitemap membership.

**Ticket C — `P1-RELEASE-001`:** Make the test environment hermetic, repair the Better Auth missing-secret assertion, remove the unused lint import, document the build-memory profile, and require `pnpm test`, `pnpm lint`, `pnpm check`, `pnpm build`, and SEO/a11y smoke checks before a release checkpoint.

## Conclusion

Architech’s next phase should be **hardening, not feature accumulation**. The repository already contains enough capability to demonstrate the product thesis. The highest return now comes from making every private mutation genuinely authorized, every indexable page demonstrably production-safe, every build reproducible, and every status document consistent. Once those foundations are closed, advanced motion, maps, AI assistance, richer media, Hindi publication, and broader Ahmedabad coverage can be activated without creating avoidable trust or operational debt.

## Repository references

[1]: ../README.md "Architech repository README and architecture summary"  
[2]: ../next.config.ts "Next.js configuration and security headers"  
[3]: ../app/layout.tsx "Root layout, metadata, fonts, providers, and structured data"  
[4]: ../client/src/lib/auth/source.ts "Better Auth environment contract"  
[5]: ../client/src/lib/auth/auth.test.ts "Better Auth contract tests"  
[6]: ../app/api/broker/listings/route.ts "Broker listing API route"  
[7]: ../app/api/admin/moderation/listings/route.ts "Admin moderation API route"  
[8]: ../app/api/admin/media/[uploadId]/moderate/route.ts "Media moderation API route"  
[9]: ../app/api/authority/assets/route.ts "Authority asset API route"  
[10]: ../prisma/seed.mjs "Illustrative seed data and demo RERA fixture"  
[11]: ../IMPROVEMENT-REVIEW-2.md "Historical Vite-era improvement review"  
[12]: ../client/src/lib/api-contract.test.ts "API contract test with lint warning"
