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
| 2 | Central canonical URL builder | P1-SEO-001, SEO-001 | pending | Removes hardcoded URL logic before more SEO work. |
| 3 | Formal `SeoPage` registry | P1-SEO-001, SEO-002, SEO-003 | pending | Ensures only qualified pages enter sitemap/indexing. |
| 4 | No-JavaScript SEO tests | UX-001, SEO-006, P1-TEST-001 | pending | Protects the Google-indexable foundation. |
| 5 | Accessibility automation | P1-UI-001, P1-TEST-001 | pending | Turns manual accessibility confidence into a test gate. |
| 6 | Complete Hindi UI foundation | P1-I18N-001, UX-004 | pending | Improves India readiness before backend fields. |
| 7 | Storybook/component documentation | P1-UI-001 | pending | Documents UI states, dark mode, Hindi, and accessibility. |
| 8 | Performance/bundle/Core Web Vitals budgets | PERF-001, PERF-002, P1-TEST-001 | pending | Prevents regressions before adding heavier features. |
| 9 | Prisma/PostgreSQL/PostGIS schema | P1-DATA-001 | pending | Starts the production data foundation. |
| 10 | Data access layer/repositories | P1-DATA-001, P1-SEO-002 | pending | Lets app switch from fixtures to database-backed data. |

---

# Phase 1 workstream tracker

## Governance and platform

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-GOV-001 | Normative document, IDs, decision log, supersession manifest | partial | Governance files exist; this tracker added. | Confirm all active decisions have IDs and link this tracker from docs. |
| P1-PLAT-001 | Next.js 16, CI, environments, secrets, deployment | partial | Next.js 16 app exists; `.github/workflows/ci.yml` exists; PR #2 passed local gates. | Real preview/prod deploy, environment management, rollback process, health checks, secret handling. |
| P1-PLAT-002 | Railway API/worker services and managed data services | pending | None. | Railway services, private networking, DB/Redis provisioning, backups, pool limits, alerts. |

## Data and domain model

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-DATA-001 | Prisma/PostgreSQL/PostGIS domain schema | pending | Fixture data exists in `client/src/lib/properties.ts` and `client/src/lib/localities.ts`. | Prisma schema, migrations, constraints, seed data, migration deploy test. |
| P1-DATA-002 | Audit, provenance, lifecycle, deletion, retention model | pending | Demo freshness/trust copy only. | Audit events, source provenance, retention/deletion jobs, lifecycle tests, legal gate records. |

## UI, design system, localization

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-UI-001 | Design tokens, typography, shadcn/Radix components, Storybook | partial | Amdavad Modern tokens, dark tokens, components, responsive pages. | Storybook, component state coverage, visual regression, formal Devanagari layout tests. |
| P1-UI-002 | Premium motion system and fallbacks | prototype | Reveal/card motion and reduced-motion CSS exist. | Motion benchmarks, no-WebGL/no-video fallback evidence, device performance validation. |
| P1-I18N-001 | English/Hindi fields, aliases, transliteration, dictionaries, formatting | partial | Hindi toggle and dictionary foundation in `client/src/lib/i18n.ts`; `<html lang>` switching. | Full UI dictionary, entity locale fields, aliases/transliteration, mixed-language search tests, metadata tests, editorial review workflow. |

## SEO and content

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-SEO-001 | Canonical URL builder and `SeoPage` registry | partial | Per-route canonicals exist via Next metadata. | Central URL builder, formal `SeoPage` registry, canonical consistency tests. |
| P1-SEO-002 | Server-rendered public templates and metadata/JSON-LD | partial | Next.js SSR/SSG routes, metadata, Place/Residence/Breadcrumb JSON-LD. | Raw HTML/no-JS test suite, snapshot drift tests, production entity snapshots. |
| P1-SEO-003 | Links, facets, pagination, lifecycle, sitemaps, robots | partial | Crawlable links, sitemap, robots, true 404s exist. | Lifecycle 301/404/410 rules, faceted indexability gates, pagination policy, crawl simulation. |
| P1-SEO-004 | Google Search Console ingestion and SEO alerting | pending | None. | Search Console setup, sitemap submission, API ingestion or manual monitoring workflow, alerts. |
| P1-CONT-001 | Focused city/locality/RERA/buying/renting guides | prototype | `/guide` page exists. | Real guide routes, author/reviewer/source/freshness fields, Article JSON-LD, editorial approval. |

## Search, maps, and discovery

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-SEARCH-001 | PostgreSQL FTS, aliases, trigram, filters, deterministic parser | prototype | Client/fixture query parser and filter tests exist. | PostgreSQL FTS/trigram indexes, aliases, backend search API, golden-query accuracy and latency tests. |
| P1-SEARCH-002 | cmdk and optional LLM adapter contract | pending | None. | cmdk search surface, typed optional LLM adapter, validation, cost/latency telemetry. |
| P1-MAP-001 | MapLibre/deck.gl contracts, clusters, list fallback, benchmark harness | pending | OSM/static map-style embeds only. | MapLibre pins, clusters, selected listing sync, search-this-area, mobile fallback, Redmi-class benchmark. |

## Media, trust, auth, broker operations

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-MEDIA-001 | R2/Stream upload, derivatives, captions, transcripts, moderation | pending | Static images and local WebP derivatives only. | Signed upload, malware/MIME checks, EXIF removal, moderation, deletion/takedown evidence. |
| P1-RERA-001 | RERA adapter, provenance, freshness, correction workflow | pending | Demo RERA/trust UI only. | RERA source adapter, evidence fields, stale/disputed states, correction workflow, legal review. |
| P1-AUTH-001 | Better Auth, roles, passkeys, 2FA, recovery, audit | pending | None. | Auth/session model, roles, protected routes, passkeys/2FA/recovery, audit and rate-limit tests. |
| P1-LEAD-001 | Masked/direct consented lead workflow | prototype | Lead dialog/funnel UI exists. | Lead API, persistence, consent audit, masked/direct modes, notifications, idempotency, deletion. |
| P1-BROKER-001 | Broker onboarding, verification, listing workflow, moderation | pending | None. | Broker org setup, listing draft/review/active flow, moderation, media rights, lead inbox, audit. |

## Operations, authority, and testing

| Work ID | Deliverable | Current status | Evidence now | Remaining acceptance |
|---|---|---|---|---|
| P1-OBS-001 | Sentry, Pino, OpenTelemetry, RUM, dashboards, SLOs | pending | None. | Error tracking, structured logs, traces, Web Vitals/RUM, alerts, incident runbook. |
| P1-OFF-001 | Authority baseline, assets, relationship registry, outreach governance | partial | Google-first off-page authority strategy exists in docs. | Asset registry, outreach log, disclosure review, referral/reporting baseline. |
| P1-TEST-001 | Full unit/integration/E2E/accessibility/performance/security/SEO suite | partial | TypeScript, ESLint, Vitest, production build pass. | Playwright E2E, axe/accessibility, SEO raw HTML tests, performance budgets, security checks, release report. |

---

# Pick-one-item backlog

## Item 2 — Central canonical URL builder

**Status:** pending  
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

- Canonical URLs are consistent across metadata, sitemap, robots, and JSON-LD.
- Tests fail if a URL loses trailing slash policy.
- `pnpm check`, `pnpm lint`, `pnpm test`, `pnpm build` pass.

---

## Item 3 — Formal `SeoPage` registry

**Status:** pending  
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

- Sitemap only includes canonical, indexable pages.
- Faceted/search pages are excluded unless explicitly approved later.
- Tests pass.

---

## Item 4 — No-JavaScript SEO tests

**Status:** pending  
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

- Tests cover `/`, `/buy/ahmedabad/`, `/buy/ahmedabad/paldi/`, `/listing/garden-courtyard/`.
- Tests pass in CI.

---

## Item 5 — Accessibility automation

**Status:** pending  
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

- `pnpm test:a11y` exists and passes locally/CI.

---

## Item 6 — Complete Hindi UI foundation

**Status:** pending  
**Workstream:** P1-I18N-001, UX-004  
**Goal:** Expand Hindi toggle beyond the current hero/header foundation.

### Implementation tasks

- Expand dictionary coverage for search, filters, saved, listing, locality, trust, empty states.
- Add locale-aware labels for INR, BHK, freshness, verification.
- Add translation-status notes where content remains English.
- Add tests for dictionary coverage and language toggle behavior.

### Acceptance

- Major UI labels are translated.
- Editorial/listing content is clearly marked partial until reviewed.
- No `hreflang` is emitted until equivalent reviewed pages exist.

---

## Item 7 — Storybook/component documentation

**Status:** pending  
**Workstream:** P1-UI-001  
**Goal:** Make the design system inspectable and reusable.

### Implementation tasks

- Install Storybook for React/Next.
- Add stories for Header, Footer, PropertyCard, CompareTray, filters, lead dialog, empty states.
- Add light/dark and Hindi/English story variants.
- Add accessibility addon.

### Acceptance

- `pnpm storybook` runs.
- Core components have documented states.

---

## Item 8 — Performance and Core Web Vitals budgets

**Status:** pending  
**Workstream:** PERF-001, PERF-002, P1-TEST-001  
**Goal:** Establish budgets before adding heavy production features.

### Implementation tasks

- Add bundle analyzer or Next build size report.
- Add Lighthouse CI or Playwright performance smoke.
- Define initial JS, LCP, CLS, and route budget thresholds.
- Document baseline.

### Acceptance

- Performance command exists.
- CI can detect major regressions.

---

## Item 9 — Prisma/PostgreSQL/PostGIS schema

**Status:** pending  
**Workstream:** P1-DATA-001  
**Goal:** Create the canonical production data model.

### Implementation tasks

- Add Prisma.
- Add schema for City, Locality, Listing, Media, BrokerOrganization, User/BrokerUser, ReraRecord, Lead, AuditEvent, SavedSearch.
- Add lifecycle/verification/translation/media moderation enums.
- Add seed data equivalent to current Ahmedabad fixtures.

### Acceptance

- `prisma validate` passes.
- Migration exists.
- Seed command creates representative demo data.

---

## Item 10 — Data access layer

**Status:** pending  
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

- App behavior remains unchanged.
- Data source can switch later without rewriting pages.
- Tests cover repository behavior.

---

# Later Phase 1 backlog

These should follow after the data foundation is in place:

1. Backend search API and PostgreSQL FTS/trigram.
2. MapLibre synchronized map/list experience.
3. Lead persistence and consent/audit backend.
4. Better Auth and broker organizations.
5. Broker onboarding and listing moderation.
6. Media upload pipeline with moderation and derivatives.
7. RERA adapter/provenance/correction workflow.
8. Sentry/logging/RUM/observability.
9. Google Search Console setup and SEO alerting.
10. Security/privacy/legal gates.
11. Backup/restore/cost operational readiness.
12. Final Phase 1 release report.

---

# Current selected next item

**Recommended next item:** Item 2 — Central canonical URL builder.

Reason: it is small, high-leverage, and should be completed before adding the `SeoPage` registry, raw HTML SEO tests, guide expansion, or production data model.
