# Architech — Phase 1 Implementation Tracker

**Last updated:** 24 Aug 2026
**Purpose:** A step-by-step tracker for finishing Phase 1 one item at a time: pick one item, implement it, validate it, update this file, then move to the next item.

This tracker is derived from:

- `governance/contracts/IMPLEMENTATION-MATRIX.md`
- `governance/contracts/REQUIREMENTS.md`
- `architecture/normative/final-three-phase-architecture.md`
- Current merged implementation through PR #2: Next.js 16 migration, dark mode, Hindi foundation, and SSR/SEO prototype foundation.

---

## Status vocabulary

| Status | Meaning |
|---|---|
| `pending` | Not started. |
| `in-progress` | Being implemented now. |
| `prototype` | Implemented only for the current demo/prototype, not production-grade. |
| `partial` | Some production-relevant parts exist, but acceptance criteria are incomplete. |
| `implemented` | Code/config/docs exist. |
| `validated` | Required tests/evidence pass. |
| `enabled` | Approved for public/production exposure. |
| `blocked` | Waiting on access, account, legal, product, or platform decision. |

A workstream should not move to `validated` without linked evidence: test output, screenshots, benchmark report, audit result, deployment URL, legal approval, or CI artifact.

---

## Current baseline after PR #2

Merged baseline:

- PR: `#2`
- Commit on `main`: `d7de346` — `Next.js 16 migration, dark mode, Hindi foundation, SSR SEO (#2)`

Validated before merge:

```text
pnpm check  ✅
pnpm lint   ✅
pnpm test   ✅ 15 passed
pnpm build  ✅ Next.js production build passed
```

Implemented foundation:

- Next.js 16 App Router migration
- Server-rendered/static public routes
- Per-route metadata and canonical URLs
- JSON-LD for public entity pages
- Sitemap and robots routes
- True 404 behavior
- Dark mode foundation
- Hindi toggle foundation
- Persistent saved homes
- Compare tray
- PWA manifest/icons
- WebP responsive image pipeline
- ESLint, Vitest unit tests, and GitHub Actions CI foundation

Still not production-grade:

- Database/API/auth/broker/RERA/media/observability are not implemented yet.
- Search is fixture/client-backed, not PostgreSQL-backed.
- Map is not MapLibre synchronized map/list yet.
- Hindi coverage is partial and not ready for indexable Hindi SEO pages.
- Storybook, E2E, accessibility automation, performance budgets, and security scans are pending.

---

## How we will work

For every next item:

1. Select exactly one item from the backlog.
2. Mark it `in-progress` in this file.
3. Implement the smallest useful slice.
4. Run the listed validation commands/tests.
5. Update status and evidence in this file.
6. Commit the work.
7. Move to the next item.

Default validation for code changes:

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
```

For docs-only changes, TypeScript/build validation is optional unless package/config/source files changed.

---

# Recommended next sequence

## Immediate foundation sequence

| Order | Item | Workstream IDs | Status | Why next |
|---:|---|---|---|---|
| 1 | Add this Phase 1 tracker | P1-GOV-001 | implemented | Creates the working control board. |
| 2 | Central canonical URL builder | P1-SEO-001, SEO-001 | validated | Central helper added in `client/src/lib/seo/urls.ts`; used by metadata, JSON-LD, sitemap, and robots. |
| 3 | Formal `SeoPage` registry | P1-SEO-001, SEO-002, SEO-003 | validated | Registry added in `client/src/lib/seo/pages.ts`; sitemap is registry-driven. |
| 4 | No-JavaScript SEO tests | UX-001, SEO-006, P1-TEST-001 | validated | `pnpm test:seo` builds, starts Next, and verifies raw HTML facts for key public pages. |
| 5 | Accessibility automation | P1-UI-001, P1-TEST-001 | validated | Playwright + axe smoke tests cover main routes on desktop/mobile and keyboard checks. |
| 6 | Complete Hindi UI foundation | P1-I18N-001, UX-004 | validated | Hindi dictionary expanded across search, saved, locality, listing, cards, CTAs, and trust UI. |
| 7 | Storybook/component documentation | P1-UI-001 | validated | Storybook 10 added with stories for header, footer, cards, compare flow, and UI states. |
| 8 | Performance/bundle/Core Web Vitals budgets | PERF-001, PERF-002, P1-TEST-001 | validated | `pnpm test:perf` enforces route JS, gzip, HTML, chunk, image, and CWV target budgets. |
| 9 | Prisma/PostgreSQL/PostGIS schema | P1-DATA-001 | validated | Prisma 7 schema, migration, seed script, schema contract tests, and docs added. |
| 10 | Data access layer/repositories | P1-DATA-001, P1-SEO-002 | validated | Fixture-backed repository facades added and pages/components now consume repository functions. |

---

# Phase 1 workstream tracker

## Governance and platform

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-GOV-001 | Normative document, IDs, decision log, supersession manifest | partial | Governance files exist; this tracker added. | Confirm all active decisions have IDs and link this tracker from docs. |
| P1-PLAT-001 | Next.js 16, CI, environments, secrets, deployment | partial | Next.js 16 app exists; `.github/workflows/ci.yml` runs type, lint, unit, build, and no-JS SEO gates. | Real preview/prod deploy, environment management, rollback process, health checks, secret handling. |
| P1-PLAT-002 | Railway API/worker services and managed data services | pending | None. | Railway services, private networking, DB/Redis provisioning, backups, pool limits, alerts. |

## Data and domain model

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-DATA-001 | Prisma/PostgreSQL/PostGIS domain schema | partial | Prisma 7 schema, initial migration SQL, representative seed script, validation command, repository facade, schema/repository contract tests, and docs exist. | Run migration deploy and seed against provisioned PostgreSQL/PostGIS environment; add Prisma-backed repositories and spatial columns/indexes when DB service is active. |
| P1-DATA-002 | Audit, provenance, lifecycle, deletion, retention model | partial | Lead API now creates idempotent lead records with consent text, masked phone, and audit-event metadata; Prisma schema has Lead/AuditEvent models. | Persist audit/deletion/retention workflows in PostgreSQL after DB provisioning and legal gate records. |

## UI, design system, localization

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-UI-001 | Design tokens, typography, shadcn/Radix components, Storybook | partial | Amdavad Modern tokens, dark tokens, components, responsive pages, accessibility smoke tests, and Storybook documentation exist. | Visual regression and formal Devanagari layout tests. |
| P1-UI-002 | Premium motion system and fallbacks | prototype | Reveal/card motion and reduced-motion CSS exist. | Motion benchmarks, no-WebGL/no-video fallback evidence, device performance validation. |
| P1-I18N-001 | English/Hindi fields, aliases, transliteration, dictionaries, formatting | partial | Expanded Hindi UI dictionary, `<html lang>` switching, major-surface Hindi labels, partial-translation note, and dictionary coverage tests exist. | Entity locale fields, aliases/transliteration, mixed-language search tests, metadata tests, editorial review workflow. |

## SEO and content

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-SEO-001 | Canonical URL builder and `SeoPage` registry | validated | Central canonical URL builder plus formal `SeoPage` registry and tests exist; sitemap is registry-driven. | Continue expanding registry when production data, lifecycle states, and guide routes are added. |
| P1-SEO-002 | Server-rendered public templates and metadata/JSON-LD | partial | Next.js SSR/SSG routes, metadata, Place/Residence/Breadcrumb JSON-LD, repository-fed route params, and raw HTML SEO smoke tests exist. | Snapshot drift tests and production entity snapshots. |
| P1-SEO-003 | Links, facets, pagination, lifecycle, sitemaps, robots | partial | Crawlable links, registry-driven sitemap, robots, true 404s exist; search/saved excluded from indexable registry. | Lifecycle 301/404/410 rules, advanced faceted indexability gates, pagination policy, crawl simulation. |
| P1-SEO-004 | Google Search Console ingestion and SEO alerting | partial | Search Console setup docs, config audit, sitemap submission workflow, URL inspection samples, threshold helpers, alert tests, and CI audit exist. | Add live Search Console API ingestion after production domain verification and credential provisioning. |
| P1-CONT-001 | Focused city/locality/RERA/buying/renting guides | prototype | `/guide` page exists. | Real guide routes, author/reviewer/source/freshness fields, Article JSON-LD, editorial approval. |

## Search, maps, and discovery

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-SEARCH-001 | PostgreSQL FTS, aliases, trigram, filters, deterministic parser | partial | Backend `/api/search` contract, fixture-backed search service, deterministic parser/filter tests, and PostgreSQL FTS/trigram migration SQL exist. | Switch search service to live PostgreSQL, add aliases/transliteration, DB-backed golden-query accuracy, and latency tests after database provisioning. |
| P1-SEARCH-002 | cmdk and optional LLM adapter contract | pending | None. | cmdk search surface, typed optional LLM adapter, validation, cost/latency telemetry. |
| P1-MAP-001 | MapLibre/deck.gl contracts, clusters, list fallback, benchmark harness | partial | Search results now use a lazy-loaded MapLibre map with listing pins, locality cluster chips, selected listing sync, search-this-area UI, and no-WebGL/list fallback. | Add deck.gl layers and Redmi-class device benchmark before broader rollout. |

## Media, trust, auth, broker operations

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-MEDIA-001 | R2/Stream upload, derivatives, captions, transcripts, moderation | partial | Signed upload API contract, MIME/size/license validation, media-rights confirmation, EXIF policy, derivative plans, completion/moderation APIs, audit trail, docs, and tests exist. | Replace in-memory contract with R2/Stream, malware scanning, worker-generated derivatives, captions/transcripts, deletion/takedown workflow, and legal approval. |
| P1-RERA-001 | RERA adapter, provenance, freshness, correction workflow | partial | Demo RERA adapter, provenance evidence fields, freshness/stale/disputed states, correction request/resolve workflow, API routes, docs, and tests exist. | Replace demo adapter with approved Gujarat RERA source integration and legal review before public enablement. |
| P1-AUTH-001 | Better Auth, roles, passkeys, 2FA, recovery, audit | partial | `better-auth` dependency, demo session contract, role/permission helpers, `/api/auth/session`, broker dashboard shell, organization context, docs, and tests exist. | Wire live Better Auth sessions, secure cookies, passkeys/2FA/recovery, rate limits, and database-backed organization memberships. |
| P1-LEAD-001 | Masked/direct consented lead workflow | partial | Listing dialog posts to `/api/leads`; API validates consent, masks phone, provides idempotency, and returns audit metadata. | Replace in-memory fixture store with Prisma transaction, notifications, deletion workflow, and legal approval. |
| P1-BROKER-001 | Broker onboarding, verification, listing workflow, moderation | partial | Broker onboarding shell, listing draft UI, moderation queue UI, draft/create/submit/moderate API contracts, media-rights gate, audit trail, docs, and tests exist. | Persist drafts/review decisions in PostgreSQL, add media upload integration, lead inbox, and operations/legal approval. |

## Operations, authority, and testing

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-OBS-001 | Sentry, Pino, OpenTelemetry, RUM, dashboards, SLOs | partial | Sentry init, Pino logger, Web Vitals/RUM endpoint, observability health endpoint, env docs, runbook docs, and tests exist. | Provision Sentry/log drains, add OpenTelemetry traces, dashboards, alerts, SLOs, and incident runbook exercises. |
| P1-OFF-001 | Authority baseline, assets, relationship registry, outreach governance | partial | Google-first off-page authority strategy exists in docs. | Asset registry, outreach log, disclosure review, referral/reporting baseline. |
| P1-TEST-001 | Full unit/integration/E2E/accessibility/performance/security/SEO suite | partial | TypeScript, ESLint, Vitest, production build, no-JavaScript SEO, Playwright/axe accessibility, Storybook smoke, and performance budget checks pass. | Broader Playwright E2E journeys, security checks, release report. |

---

# Pick-one-item backlog

## Item 2 — Central canonical URL builder

**Status:** validated
**Workstream:** P1-SEO-001, SEO-001
**Goal:** Every route, metadata object, JSON-LD object, sitemap entry, and robots reference should use one canonical URL helper.

### Implementation tasks

- Create `client/src/lib/seo/urls.ts` or `app/lib/seo/urls.ts`.
- Add `SITE_URL` normalization from `NEXT_PUBLIC_SITE_URL`.
- Add route builders:
  - `homeUrl()`
  - `cityUrl(citySlug)`
  - `localityUrl(citySlug, localitySlug)`
  - `listingUrl(listingIdOrSlug)`
  - `guideUrl(...)`
  - `sitemapUrl()`
- Replace hardcoded canonical/sitemap/robots URLs.
- Add unit tests for trailing slash and absolute URLs.

### Acceptance

- Canonical URLs are consistent across metadata, sitemap, robots, and JSON-LD. ✅
- Tests fail if a URL loses trailing slash policy. ✅
- `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build` pass. ✅

### Evidence

- Added `client/src/lib/seo/urls.ts`.
- Added `client/src/lib/seo/urls.test.ts`.
- Replaced route-level hardcoded canonical URL construction in metadata, sitemap, robots, and JSON-LD.
- Validation: `pnpm check`, `pnpm lint`, `pnpm test` (19 passed), `pnpm build`.

---

## Item 3 — Formal `SeoPage` registry

**Status:** validated
**Workstream:** P1-SEO-001, SEO-002, SEO-003
**Goal:** Define which pages are indexable and why.

### Implementation tasks

- Add `SeoPage` type with:
  - ID
  - route type
  - canonical URL
  - primary intent
  - indexability
  - owner
  - quality state
  - freshness policy
  - entity IDs
- Register home, city, locality, listing, and guide pages.
- Generate sitemap from registry.
- Add tests that `/search` and `/saved` never enter indexable registry.

### Acceptance

- Sitemap only includes canonical, indexable pages. ✅
- Faceted/search pages are excluded unless explicitly approved later. ✅
- Tests pass. ✅

### Evidence

- Added `client/src/lib/seo/pages.ts` with `SeoPage` type, ownership, intent, indexability, quality state, freshness policy, entity IDs, and sitemap policy.
- Added `client/src/lib/seo/pages.test.ts`.
- Updated `app/sitemap.ts` to generate from `getIndexableSeoPages()`.
- Validation: `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`.

---

## Item 4 — No-JavaScript SEO tests

**Status:** validated
**Workstream:** UX-001, SEO-006, P1-TEST-001
**Goal:** Guarantee public page facts exist in raw server HTML.

### Implementation tasks

- Add a test command, likely `pnpm test:seo`.
- Fetch built pages from local Next server or render route output where practical.
- Assert raw HTML contains:
  - title
  - canonical
  - JSON-LD
  - listing price/locality facts
  - breadcrumbs or crawlable links

### Acceptance

- Tests cover `/`, `/buy/ahmedabad/`, `/buy/ahmedabad/paldi/`, `/listing/garden-courtyard/`. ✅
- Tests pass in CI. ✅ Added to `.github/workflows/ci.yml`.

### Evidence

- Added `scripts/seo/raw-html-smoke.mjs`.
- Added `pnpm test:seo` script.
- Updated CI to run lint and no-JavaScript SEO smoke tests.
- The SEO smoke test builds production Next.js, starts `next start`, fetches raw HTML, and verifies titles, canonicals, JSON-LD, crawlable links/breadcrumbs, locality facts, and listing price/locality facts.
- Validation: `pnpm test:seo`; full gate: `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`.

---

## Item 5 — Accessibility automation

**Status:** validated
**Workstream:** P1-UI-001, P1-TEST-001
**Goal:** Add automated accessibility checks for key flows.

### Implementation tasks

- Add Playwright and axe integration.
- Test pages:
  - Home
  - Search
  - Locality
  - Listing
  - Saved
- Validate skip link, modal focus, drawer focus, reduced-motion basics, and no obvious axe violations.

### Acceptance

- `pnpm test:a11y` exists and passes locally/CI. ✅

### Evidence

- Added `playwright.a11y.config.ts`.
- Added `tests/a11y/accessibility.spec.ts`.
- Added `pnpm test:a11y`.
- Updated CI to install Chromium dependencies and run accessibility smoke tests.
- Fixed real axe findings: screen-reader text for animated counters/word reveal, Radix tab panel linkage, sort select accessible name, and skip-link focus target.
- Coverage: Home, Search, Paldi locality, garden-courtyard listing, Saved, skip link, theme toggle, and language toggle on desktop and mobile Chromium.
- Validation: `pnpm test:a11y` passed 14 tests; full gate: `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`.

---

## Item 6 — Complete Hindi UI foundation

**Status:** validated
**Workstream:** P1-I18N-001, UX-004
**Goal:** Expand Hindi toggle beyond the current hero/header foundation.

### Implementation tasks

- Expand dictionary coverage for search, filters, saved, listing, locality, trust, empty states.
- Add locale-aware labels for INR, BHK, freshness, verification.
- Add translation-status notes where content remains English.
- Add tests for dictionary coverage and language toggle behavior.

### Acceptance

- Major UI labels are translated. ✅
- Editorial/listing content is clearly marked partial until reviewed. ✅
- No `hreflang` is emitted until equivalent reviewed pages exist. ✅

### Evidence

- Expanded `client/src/lib/i18n.ts` for search, saved, locality, listing, property cards, trust labels, dialogs, map copy, and common translation status.
- Updated major pages/components to consume the expanded dictionary: `ResultsPage`, `Saved`, `CityPage`, `ListingPage`, `PropertyCard`, and homepage stats/CTA labels.
- Added `client/src/lib/i18n.test.ts` to verify English/Hindi dictionary shape parity, major Hindi surface coverage, and partial-translation disclosure.
- Hindi remains a reviewed UI foundation only; property editorial prose and full SEO alternates are intentionally not marked as equivalent Hindi pages yet.
- Validation: `pnpm check`, `pnpm lint`, `pnpm test` (27 passed), `pnpm build`, `pnpm test:a11y`, `pnpm test:seo`.

---

## Item 7 — Storybook/component documentation

**Status:** validated
**Workstream:** P1-UI-001
**Goal:** Make the design system inspectable and reusable.

### Implementation tasks

- Install Storybook for React/Next.
- Add stories for Header, Footer, PropertyCard, CompareTray, filters, lead dialog, empty states.
- Add light/dark and Hindi/English story variants.
- Add accessibility addon.

### Acceptance

- `pnpm storybook` runs. ✅ (`pnpm storybook:smoke`)
- Core components have documented states. ✅

### Evidence

- Added Storybook 10 with `@storybook/nextjs-vite` and `@storybook/addon-a11y`.
- Added `.storybook/main.ts` and `.storybook/preview.tsx` with Tailwind/design CSS, static public assets, aliases, and preview-host allowlist.
- Added reusable `StorySurface` provider wrapper for light/dark and English/Hindi variants.
- Added stories for `Header`, `Footer`, `PropertyCard`, interactive compare flow, empty state, and filter states.
- Added scripts: `pnpm storybook`, `pnpm storybook:smoke`, and `pnpm build-storybook`.
- Updated CI to run the Storybook smoke test.
- Validation: `pnpm storybook:smoke`, `pnpm build-storybook`, `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm test:a11y`, `pnpm test:seo`.

---

## Item 8 — Performance and Core Web Vitals budgets

**Status:** validated
**Workstream:** PERF-001, PERF-002, P1-TEST-001
**Goal:** Establish budgets before adding heavy production features.

### Implementation tasks

- Add bundle analyzer or Next build size report.
- Add Lighthouse CI or Playwright performance smoke.
- Define initial JS, LCP, CLS, and route budget thresholds.
- Document baseline.

### Acceptance

- Performance command exists. ✅
- CI can detect major regressions. ✅

### Evidence

- Added `performance/budgets.json` with Phase 1 budgets for route first-load JS, gzip JS, HTML, static chunks, image assets, and Core Web Vitals targets.
- Added `scripts/performance/budget.mjs`.
- Added `docs/performance/phase-1-baseline.md`.
- Added `pnpm test:perf`.
- Updated CI to run the performance budget gate.
- Current baseline: home first-load JS ~698 KiB raw / ~213 KiB gzip; total static JS ~899 KiB; largest JS chunk ~224 KiB raw / ~70 KiB gzip; largest sampled HTML ~97 KiB.
- Validation: `pnpm test:perf`, plus full gate `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`, `pnpm storybook:smoke`, `pnpm build-storybook`, `pnpm test:a11y`, `pnpm test:seo`.

---

## Item 9 — Prisma/PostgreSQL/PostGIS schema

**Status:** validated
**Workstream:** P1-DATA-001
**Goal:** Create the canonical production data model.

### Implementation tasks

- Add Prisma.
- Add schema for City, Locality, Listing, Media, BrokerOrganization, User/BrokerUser, ReraRecord, Lead, AuditEvent, SavedSearch.
- Add lifecycle/verification/translation/media moderation enums.
- Add seed data equivalent to current Ahmedabad fixtures.

### Acceptance

- `prisma validate` passes. ✅
- Migration exists. ✅
- Seed command creates representative demo data. ✅ Script exists; live execution requires `DATABASE_URL`.

### Evidence

- Added Prisma 7 dependencies and `prisma.config.ts`.
- Added `prisma/schema.prisma` for City, Locality, Listing, PropertyMedia, BrokerOrganization, User, BrokerUser, ReraRecord, Lead, AuditEvent, and SavedSearch.
- Added lifecycle/status enums for listing lifecycle, verification, translation, media moderation, property type, user role, lead mode, and lead status.
- Added initial migration: `prisma/migrations/202608240001_phase1_domain_schema/migration.sql`.
- Added representative Ahmedabad seed script: `prisma/seed.mjs`.
- Added docs: `docs/data/phase-1-prisma-schema.md`.
- Added schema contract tests: `client/src/lib/db-schema.test.ts`.
- Added scripts: `pnpm db:validate`, `pnpm db:generate`, `pnpm db:migrate`, `pnpm db:seed`.
- Updated CI to run `pnpm db:validate`.
- Validation: `pnpm db:validate`, `pnpm db:generate`, `pnpm check`, `pnpm lint`, `pnpm test` (30 passed), `pnpm build`, `pnpm test:perf`, `pnpm storybook:smoke`, `pnpm test:seo`, `pnpm test:a11y` (14 passed).

---

## Item 10 — Data access layer

**Status:** validated
**Workstream:** P1-DATA-001, P1-SEO-002
**Goal:** Stop importing fixtures directly from pages/components.

### Implementation tasks

- Add typed repository functions:
  - `getListings()`
  - `getListingById()`
  - `getLocalities()`
  - `getLocalityBySlug()`
  - `getGuides()`
- Start with fixture implementation.
- Add DB implementation behind an environment flag later.
- Update pages to use repositories.

### Acceptance

- App behavior remains unchanged. ✅
- Data source can switch later without rewriting pages. ✅
- Tests cover repository behavior. ✅

### Evidence

- Added repository facade modules under `client/src/lib/repositories/` for listings, localities, and guides.
- Updated App Router pages, SEO registry, client pages, Storybook stories, compare tray, and property card type imports to consume repository functions instead of importing fixture arrays directly.
- Added repository tests covering lookup helpers, static params, guide fixtures, and a static guard that blocks direct fixture imports from app/pages/architech components.
- Validation: `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build`.

---

# Later Phase 1 backlog

These should follow after the data foundation is in place:

1. Backend search API and PostgreSQL FTS/trigram. ✅ First slice validated: `/api/search`, search service tests, client fetch integration, and FTS/trigram migration SQL.
2. MapLibre synchronized map/list experience. ✅ First slice validated: lazy MapLibre map, listing pins, selected listing sync, cluster chips, fallback, and performance budget update.
3. Lead persistence and consent/audit backend. ✅ First slice validated: `/api/leads`, consent checkbox, masked phone, idempotency, audit metadata, docs, and tests.
4. Better Auth and broker organizations. ✅ First slice validated: dependency, session contract, broker org shell, role/permission helpers, docs, and tests.
5. Broker onboarding and listing moderation. ✅ First slice validated: onboarding shell, draft submission contract, moderation decisions, media-rights gate, audit trail, docs, and tests.
6. Media upload pipeline with moderation and derivatives. ✅ First slice validated: signed upload contract, MIME/size/license validation, derivative plans, completion/moderation APIs, EXIF policy, docs, and tests.
7. RERA adapter/provenance/correction workflow. ✅ First slice validated: adapter contract, provenance fields, stale/disputed states, correction workflow, APIs, docs, and tests.
8. Sentry/logging/RUM/observability. ✅ First slice validated: Sentry config, Pino redacted logger, Web Vitals RUM, health endpoint, docs, and tests.
9. Google Search Console setup and SEO alerting. ✅ First slice validated: setup docs, config audit, sitemap submission/URL inspection workflow, thresholds, helpers, and tests.
10. Security/privacy/legal gates.
11. Backup/restore/cost operational readiness.
12. Final Phase 1 release report.

---

# Current selected next item

**Recommended next item:** Security/privacy/legal gates.

Reason: SEO monitoring is now operationalized at the workflow/config level, so the next Phase 1 slice should add security headers, privacy/legal gate checklists, and release-blocking compliance checks.
