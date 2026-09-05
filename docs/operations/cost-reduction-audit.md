# Cost Reduction Audit — Architech

**Date:** 2026-09-05 (updated for second-pass, in-depth audit)
**Scope:** Whole repo — runtime, hosting, data, search, media, observability, CI, external calls, schedulers, and documented operational posture.
**Method:** Reviewed **docs** (`docs/architecture`, `docs/data`, `docs/search`, `docs/observability`, `docs/operations`, `docs/performance`, `docs/media`) and **code** (`app/*`, `client/src/lib/*`, `client/src/pages/*`, `client/src/components/*`, `next.config.ts`, `prisma/*`, `scripts/*`, `.github/workflows/*`, `governance/*`).
**Status:** Findings; P0/P1 first batch implemented (see status table below).

## 0. Execution status (first batch, 2026-09-05)

| Item | Status | Where |
|---|---|---|
| P0.1 SQL search | **Partially done.** The executed candidate-narrowing path (`ARCHITECH_SEARCH_SQL_NARROW=on`, FTS + trigram + ILIKE superset, fail-closed) already exists in `lib/search/sql.ts` + `sql-narrow.ts`; the search API now carries `s-maxage=30, stale-while-revalidate=60` (see P0.2). Full DB-side filtering/pagination (facet counts in SQL) is the remaining step — kept off-by-default until the pg_trgm migrations are confirmed in every prisma environment. | `app/api/search/route.ts`, `client/src/lib/search/sql-narrow.ts` |
| P0.2 Cache deterministic GETs | **Done.** `/api/search` → `public, s-maxage=30, stale-while-revalidate=60`; `/api/ai/compare`, `/api/ai/search-assist`, `/api/cities/[slug]/market-trends`, `/api/localities/[slug]/price-trends` → `public, s-maxage=300, stale-while-revalidate=86400` (404s stay `no-store`). | each route |
| P0.3 Image delivery | **Done (R2 path).** R2 presigned signing (SigV4), `next/image` custom loader → Cloudflare Image Transformations URLs when `ARCHITECH_MEDIA_STORAGE=r2` (`next.config.ts`, `client/src/lib/media/next-image-loader.ts`). Dropped derivative files stay in `public/images` until R2 serving is live in production (see media-storage-decision phase 3). | `next.config.ts`, `client/src/lib/media/*` |
| P0.4 De-dynamic render-only pages | **Done (safe set).** `/blogs`, `/list-property`, `/collections` → static; `/developers`, `/locations` → ISR `revalidate=3600`. `/compare`, `/locations/[state]` keep request-time rendering (searchParams-driven); authenticated pages untouched. | the pages |
| P0.5 Listing page double read | **Done.** `generateMetadata` + page share one `React.cache()`-deduped lookup; ISR `revalidate=600`; `generateStaticParams` now reads DB ids in prisma mode (best-effort, fixture fallback) so DB listings become pre-rendered pages. | `app/listing/[id]/page.tsx`, `client/src/lib/repositories/server/prisma.ts` |
| P0.6 Duplicate CI pipelines | **Done.** `quality.yml` deleted — it re-ran check + lint + test + db:validate + build that `ci.yml` already runs on the same events. | `.github/workflows/` |
| P1.1 Broker channel fan-out | **Partially done.** All channel GETs now carry `private, max-age=15, stale-while-revalidate=30` (cuts tab-switch refetches). Consolidating the 6 parallel panel calls into one dashboard payload is the remaining step. | `app/api/broker/channel/*` |
| P1.2 Per-instance schedulers | **Partially done.** New single-driver endpoint `POST /api/internal/scheduled/media-retention-sweep/` (`CRON_SECRET` bearer, fails closed) for a platform cron; set `MEDIA_RETENTION_SWEEP=off` when the cron is live. In-process behavior unchanged for single-replica dev. | `app/api/internal/scheduled/*` |
| P1.3 Observability per-event | **Done (client-side).** Web-vitals sampled via `NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE` (prod example: 0.1; 0 disables ingest); Sentry traces lowered in prod examples (`0.05→0.01`, public `0.01→0.001`). | `WebVitalsReporter.tsx`, `.env.production.example` |
| P1.5 Media object lifecycle | **Done (app-side).** Retention sweep + takedown delete the R2 object (SigV4 DELETE, idempotent), `PropertyMedia.objectKey` persisted at sign time (migration `202609050002`); failures are counted + audited, never thrown. Quota `MEDIA_MAX_IMAGES_PER_LISTING` (default 10) enforced at sign. Bucket-level R2 lifecycle rules remain an operator task. | `client/src/lib/media/*`, `prisma/migrations/202609050002_*` |

Remaining (not started): P0.1 full SQL pagination, P1.1 dashboard consolidation, P1.4 R2 location snapshots, P1.6 email digests, P1.7 scheduler for ERPNext/RERA syncs, all P2 hygiene items.

---

## 1. Decision context (already agreed)

| Layer | Decision |
|---|---|
| Image storage | **Cloudflare R2** (originals, $0 egress) |
| Image serving | Cloudflare edge + Image Transformations (WebP/AVIF + thumbnails) or next/image R2 loader |
| Video | **Disabled** user-side in initial phase; code retained behind a config gate |
| Long-term video provider | Bunny Stream or Cloudflare Stream — decided only when revenue starts |

This audit covers the rest of the app beyond media.

---

## 2. What already costs us money today (highest impact first)

### P0 — Do these before volume grows

#### P0.1 Search is still reading/filtering in JS and is not cached

**Where**

- `client/src/lib/search/server.ts`
- `client/src/lib/repositories/server/prisma.ts`
- `app/api/search/route.ts`
- `client/src/lib/search/sql.ts` (plan exists, not executed)
- `prisma/migrations/*_search_indexes/migration.sql` (indexes exist)

**What happens today**

- In Prisma mode, `searchListingsForServer()` calls `getListingsForServer()` which runs:

  ```ts
  prisma.listing.findMany({
    where: { lifecycle: "ACTIVE", ...(scope.citySlug ? { city: { slug: scope.citySlug } } : {}) },
    include: listingInclude,   // city + locality + media
    orderBy: { meaningfulUpdatedAt: "desc" },
    take: MAX_UNSCOPED_LISTING_ROWS,  // 5,000
  });
  ```

- That result is then filtered/ranked **in JavaScript** by query, facets, category, intent, pincode, sort, etc.
- `/api/search` returns `Cache-Control: no-store`. The client results page re-fetches on every filter/URL change.
- PostgreSQL FTS/trigram indexes already exist (`searchVector` GIN, `title_trgm`, `description_trgm`, `addressLocality_trgm`, `Locality_name_trgm`) but are not used.

**Why it costs money**

- Every search reads up to 5,000 Active listings + city/locality/media into memory.
- The result is filtered in the Node server → CPU + memory per request.
- No caching → repeated human/bot traffic pays full cost each time.
- As catalogue grows, this is the single largest per-request cost in the app.

**Plan**

1. Finish the SQL search path in `client/src/lib/search/sql.ts` using FTS + trigram + DB-side filters + pagination.
2. Push filters/sort/pagination into the Postgres query, not JS.
3. Add a short shared cache for public search:
   - `Cache-Control: s-maxage=30, stale-while-revalidate=60`
   - or `next revalidateTag` / ISR if page-rendered.
4. Keep a DB index on every column used for filtering/sorting (mostly present already).
5. Add `EXPLAIN`/query-plan instrumentation behind a debug flag only (not per request).

#### P0.2 Many deterministic GET APIs use `no-store` though they are cheap to cache

**Where**

- `app/api/search/route.ts` → `Cache-Control: no-store`
- `app/api/ai/compare/route.ts` → `Cache-Control: no-store`
- `app/api/ai/search-assist/route.ts` → `Cache-Control: no-store`
- `app/api/cities/[slug]/market-trends/route.ts` → `Cache-Control: no-store`
- `app/api/localities/[slug]/price-trends/route.ts` → `Cache-Control: no-store`

**What happens today**

- These are deterministic/pure read operations backed by fixture or cached repository data.
- All return `no-store`, so every request re-runs the computation and hits serverless invocations.
- Several already have a good precedent in the same repo:
  - `/api/search/suggest` → `max-age=300, stale-while-revalidate=86400`
  - `/api/locations/states/*` and `/api/locations/status/*` → `public, max-age=300, s-maxage=3600, stale-while-revalidate=86400`
  - `/api/sitemap.xml` and `/api/sitemap/*` → `public, max-age=0, s-maxage=3600, stale-while-revalidate=86400`

**Why it costs money**

- Public, identical responses are recomputed per request.
- Serverless invocation + CPU on every hit.
- Even a 15-minute cache reduces this dramatically.

**Plan**

1. Give deterministic public GETs a short CDN/shared cache:
   - Market trends, price trends, compare, search-assist, search results → `s-maxage` 30–300 seconds + `stale-while-revalidate`.
2. Keep `no-store` only for authenticated/user-specific or POST/mutation endpoints.
3. Keep the location/suggest/sitemap cache headers as the reference pattern.

#### P0.3 Image delivery is still "unoptimized" through the app server

**Where**

- `next.config.ts` → `images: { unoptimized: true }`
- `client/src/components/architech/Pic.tsx`
- `public/images/*` (JPG + WebP + `-800.webp` duplicates)

**What happens today**

- Public/listing images are served from `public/images/` through the Next.js/Vercel host.
- The repo stores `*.jpg`, `*.webp`, and `*-800.webp` — multiple copies of the same original.
- The config comment explicitly says to switch to the R2 loader once active.

**Why it costs money**

- Bandwidth/egress leaves through the app origin instead of R2/Cloudflare edge.
- Duplicated derivative files increase storage and build/repo size.
- No on-the-fly AVIF/WebP negotiation.

**Plan**

1. Move originals to **R2** (already decided).
2. Serve via **Cloudflare Image Transformations** (remote R2 origin) or a `next/image` R2 loader.
3. Serve only the transformed variant needed (thumbnail / 800px / full), not the 8 MB original.
4. Drop `unoptimized: true` once the R2 loader is active.

#### P0.4 `force-dynamic` on many render-only pages

**Where**

- `app/blogs/page.tsx` (just `redirect("/guide/")`)
- `app/developers/page.tsx`
- `app/list-property/page.tsx`
- `app/collections/page.tsx`
- `app/about-us/page.tsx`
- `app/compare/page.tsx`
- `app/locations/page.tsx`
- `app/locations/[state]/page.tsx`
- `app/locations/postal-codes/[code]/page.tsx`
- `app/saved/page.tsx`
- `app/saved-searches/page.tsx`
- `app/login/page.tsx`
- `app/dashboard/page.tsx`
- `app/admin/*` (keep dynamic — correct)

**What happens today**

- Many are pure content or render-only pages marked `export const dynamic = "force-dynamic"`.
- On serverless this means every request runs server code instead of being served from cache/CDN.

**Why it costs money**

- Each request invokes server code + fixture reads + rendering.
- Static/ISR would eliminate most of that for unchanged content.

**Plan**

1. Remove `force-dynamic` from genuinely content-fixed pages (`/guide`, `/about-us`, `/developers`, `/list-property`, `/collections`, `/compare`, `/locations` unless they serve user-specific data).
2. Use static generation or `revalidate`/ISR where content changes infrequently.
3. Keep `force-dynamic` only on authenticated and fresh-data pages (`dashboard`, `admin`, `broker/*`, `saved-searches`, `login`, etc.).

#### P0.5 Listing pages do duplicate DB reads + uneven static generation

**Where**

- `app/listing/[id]/page.tsx`
- `client/src/lib/repositories/server/prisma.ts` → `getListingByIdForServer`

**What happens today**

- `generateMetadata()` and the page component each call `getListingByIdForServer(id)` → **2 DB queries per request**.
- `generateStaticParams()` returns `getListingStaticParams()` which is fixture-driven; in `ARCHITECT_DATA_SOURCE=prisma` only fixture IDs are pre-built, so real DB listings fall to per-request SSR + double metadata lookup.

**Why it costs money**

- Doubles DB/CPU per listing page.
- New listings from DB are not prebuilt → per-request SSR.

**Plan**

1. Wrap the listing lookup in `React cache()` so both calls share one result.
2. Generate static params from the DB (when Prisma is active).
3. Use ISR (`revalidate` / `dynamicParams`) so new listings become cached pages instead of expensive SSR.

#### P0.6 CI runs two near-duplicate heavy pipelines

**Where**

- `.github/workflows/ci.yml`
- `.github/workflows/quality.yml`

**What happens today**

- `ci.yml` runs full suite (check, lint, tests, build, SEO smoke, e2e, a11y, perf, security, audits, Storybook).
- `quality.yml` runs `check + lint + test + build` again on the same PRs and pushes.

**Why it costs money**

- Duplicate workflows double billed GitHub Actions minutes, especially on a private repo.

**Plan**

1. Merge/trim `quality.yml` or make it `on: pull_request` only.
2. Skip or gate the heavy a11y/Storybook/perf jobs on `main` pushes when the PR pipeline already runs them.
3. Keep `actions/setup-node` pnpm caching (already present).

---

### P1 — Cost grows with customers, fix as revenue ramps

#### P1.1 Broker channel pages fan out 6 API calls on every load

**Where**

- `client/src/components/broker/BrokerChannelPanel.tsx`
  - `loadChannel()` fires `Promise.all` of **6** `no-store` fetches: dashboard, requests, matches, requirements, deals, notifications.
- `client/src/pages/BrokerChannel.tsx`
  - `load()` fires **2** `no-store` fetches (requests + matches) even when the page already shows other panels.
- `client/src/pages/RoleDashboard.tsx`
  - Fires up to **4** parallel panel fetches (`requirements`, `saved-searches`, `listings`, `leads`).

**Why it costs money**

- Serverless invocations per panel load.
- Under Prisma mode each fetch hits the DB separately.
- Some endpoints (`dashboard`) call 7 aggregate queries in a single request, while the page separately fetches the same underlying rows in other endpoints.

**Plan**

1. Consolidate the broker-channel load into **one** `/api/broker/channel/dashboard` response that returns requests/matches/deals/notifications/requirements.
2. Reduce `no-store` on authenticated dashboards to short `private, max-age=15, stale-while-revalidate=30`.
3. Cache within the client session (avoid re-fetch on every tab switch).

#### P1.2 In-process schedulers/timers duplicate across instances

**Where**

- `client/src/lib/media/retention-runtime.ts`
  - `registerMediaRetentionRuntime()` starts an in-process `setInterval` (default 60 min) from `instrumentation.ts`.
  - Comment explicitly says it is reliable on a long-lived Node server but "deliberately absent on serverless instances, where the exported sweep should instead be driven by a platform cron."
- `client/src/lib/listing/events.ts`
  - In-process event spine/listeners + a recent-event ring (`RECENT_LIMIT = 200`).
- `client/src/lib/auth/server-auth.ts`
  - Notes live Better Auth sessions are per-process and "NOT usable in any multi-worker deployment until the Prisma adapter lands."
- `client/src/lib/auth/request-safety.ts`
  - In-process rate limiter (per-instance buckets).

**Why it costs money**

- On multi-worker/serverless, every instance can run its own retention sweep / event listeners / rate limiter.
- Duplicate timers = duplicate DB scans + logs.
- In-memory ring/limiter containers are lost on scale-out, so boundaries drift between instances.

**Plan**

1. Drive the media retention sweep from **one external background job/cron** (platform cron or a single worker), not an in-process timer per instance.
2. Drive daily requirement purge (`scripts/privacy/purge-expired-requirements.mjs`) from the same scheduler.
3. Move rate limiting to a shared/edge bucket only when multi-instance or abuse is observed.
4. Keep in-process behavior for local/single-node dev, but disable it in multi-replica staging/prod.

#### P1.3 Observability endpoints fire per event

**Where**

- `app/api/observability/web-vitals/route.ts`
- `app/api/observability/errors/route.ts`
- `client/src/components/architech/WebVitalsReporter.tsx`
- `app/api/observability/health/route.ts`
- `app/api/observability/status/route.ts`
- `app/api/observability/slo/route.ts`

**What happens today**

- Every browser load can POST web-vitals + error events → serverless invocation + structured log per event.
- These endpoints return `Cache-Control: no-store`.

**Why it costs money**

- Linearly grows with users; each event = invoke + log line.
- Log line egress/storage is charged by log/platform providers.

**Plan**

1. Batch/sample web-vitals and client errors client-side (e.g. 5–10% sampling).
2. Disable RUM ingest in low-traffic/non-production environments.
3. Lower Sentry trace sampling:
   - `SENTRY_TRACES_SAMPLE_RATE`: `0.05` → `0.01` (production), `0.01` → `0.001` (public).
4. Keep health/status endpoints cheap and unchanged.

#### P1.4 Postgres holds content that doesn't need to be in Postgres

**Where**

- `docs/data/india-location-operations.md`
- `prisma/schema.prisma` (location/PostGIS foundation)
- `scripts/location/*`

**What happens today**

- National India Post / LGD snapshots with geometry are imported into PostgreSQL/PostGIS alongside the OLTP listings DB.

**Why it costs money**

- Large geographic rows increase DB storage, memory, and backup cost.
- Backups include everything; restore/snapshot windows grow.

**Plan**

1. Keep raw snapshots + manifests in **R2** (cheap, $0 egress).
2. Import only needed rows into Postgres.
3. Archive/release old import runs.
4. Keep PostGIS tables minimal and partitioned if they grow.

#### P1.5 Media retention / object lifecycle should be enforced centrally

**Where**

- `client/src/lib/media/retention.ts` (policy)
- `client/src/lib/media/retention-runtime.ts` (runtime sweep)
- `prisma/schema.prisma` (`PropertyMedia`)
- `docs/media/media-storage-decision.md`

**What happens today**

- Media is marked DELETED in the database, but there is **no object deletion/lifecycle in R2** yet.
- Rejected/orphaned/stale originals can remain in object storage indefinitely.

**Why it costs money**

- Object storage is cheap, but it compounds over time.
- Rejected/pending/takedown media should not stay forever.

**Plan**

1. Add R2 lifecycle rules to expire rejected/orphaned/pending objects.
2. On retention decision, delete the R2 object (not just the DB row).
3. Add per-account upload quotas (max images per listing, max size).
4. Keep `PropertyMedia` metadata in DB; keep bytes only in R2.

#### P1.6 Email/notification costs

**Where**

- `.env.production.example` / `.env.staging.example` → `RESEND_API_KEY`
- `docs/data/phase-1-saved-searches.md` (saved-search alert future work)
- `docs/operations/environment-provisioning-runbook.md` (Resend provisioning)

**What happens today**

- Resend is provisioned but email is largely unexercised in Phase 1.
- Saved search notifications ("when matching inventory arrives") are documented as pending.

**Why it matters**

- Email cost scales with sends; saved-search alerts could become a heavy recurring send if not throttled/digested.

**Plan**

1. Gate all email behind explicit opt-in.
2. Batch saved-search alerts into daily digests, not per-match sends.
3. Add per-user / per-org send quotas.
4. Use provider-free/template email only when ready to pay.

#### P1.7 External data/sync calls should be event-driven, not polled

**Where**

- `app/api/broker/channel/erpnext/sync/route.ts` + `client/src/lib/persistence/channel-store.ts`
  - `processPendingErpnextCloseWritesForServer()` currently can be invoked from the UI "Sync ERPNext closes" button.
- `scripts/privacy/purge-expired-requirements.mjs` — "Schedule this command at least daily in every Prisma-backed environment."
- `app/api/rera/*` + `app/api/admin/rera/[registration]/refresh/route.ts`
- `.env.*` → `INDEXNOW_KEY`, `GSC_CREDENTIALS`, `GUJARAT_RERA_BASE_URL`, `GUJARAT_RERA_API_KEY`

**Why it matters**

- External API calls cost network calls and may be billed/rate-limited.
- A misconfigured poll loop could retry/accumulate large batches.

**Plan**

1. Drive ERPNext sync + media sweep + RERA refresh from a **single scheduled worker**, not from UI or page requests.
2. Apply a tight per-run batch cap (already `limit = 10`; keep).
3. Add retry/backoff windows (partly present via `nextRetryAt`).
4. Guard against concurrent runs (e.g. `IN_FLIGHT` expiry).
5. Use GSC/IndexNow only for indexable pages.

---

### P2 — Lower frequency / hygiene / wait-until-needed

#### P2.1 Public OpenStreetMap raster tiles reduce reliability and bypass edge

**Where**

- `client/src/components/architech/MapListSync.tsx`
  - `tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"]`

**Why it matters**

- Free public-tile service, but subject to usage policy/throttling/blocking at public scale.
- Bypasses your Cloudflare edge/caching.
- OSM public endpoint is not an SLA-backed delivery path.

**Plan**

1. Use a Cloudflare tile proxy or a commercial tile provider (MapTiler, etc.) behind Cloudflare.
2. Cache tiles at the edge instead of relying on OSM origin.
3. Keep the existing no-WebGL/list fallback.

#### P2.2 Keep analytics counters out of the OLTP DB

**Where**

- `app/api/listings/[id]/stats/route.ts`
- `client/src/lib/analytics/listing-stats.ts`

**Why it matters**

- Currently in-memory (fine for Phase 1).
- If they become per-view Postgres writes, that becomes the most expensive write path in the system.

**Plan**

1. Keep counters out of the OLTP DB.
2. Move to a cheap/sampled counter store when scale requires (Redis / Cloudflare D1 / an analytics product).
3. Do not add Redis just to back the current in-memory limiter/counters.

#### P2.3 Pure calculator endpoints could run client-side to save invocations

**Where**

- `app/api/investment/metrics/route.ts` — POST, pure math.
- `app/api/ai/compare/route.ts` — GET, pure deterministic.
- `app/api/ai/search-assist/route.ts` — GET, pure deterministic.

**Why it matters**

- These are simple deterministic functions; running them through the server adds serverless invocations for negligible work.

**Plan**

- Keep server versions for non-client contexts, but prefer client-side calculation for calculator UI (ownership cost, investment metrics, compare).
- If kept as API, add a cache header where output is deterministic/public.

#### P2.4 Package/build size and JS budget

**Where**

- `next.config.ts` (`optimizePackageImports: ["lucide-react", "motion"]`)
- `docs/performance/phase-1-baseline.md` (JS budgets already enforced)

**Why it matters**

- Smaller JS = less bandwidth and faster LCP/TTFB. Most Phase 1 checks already enforce this.
- Continue honoring the existing budgets; every new page should be re-baselined deliberately, not drifted.

**Plan**

- Keep JS budgets in `performance/budgets.json`.
- Add a budget gate for any new route before launch.

#### P2.5 Static assets / repo size

**Where**

- `public/images/*` (JPG + WebP + `-800.webp`)

**Why it matters**

- Current public assets are ~4 MB (24 files). Not huge, but duplicated derivatives add to build/repo/CDN.

**Plan**

- Move to R2 originals + on-the-fly transforms (already planned).
- Remove redundant large source copies from the app repo once R2 serving is live.

#### P2.6 Backup/restore + operational budget re-baseline

**Where**

- `docs/operations/backup-restore-cost-readiness.md`
- `governance/operations/phase-1-operational-readiness.json`

**What it says**

- RPO 24h, RTO 4h, 30-day backup retention, restore drill 90 days.
- Postgres budget `₹5000/month`, media `₹4000/month`.

**Why it matters**

- Backups are a recurring cost.
- Media doesn't need database backups if media bytes live in R2.

**Plan**

- Keep media object bytes in R2, keep only `PropertyMedia` metadata rows in Postgres.
- Set R2 object-lifecycle rules for rejected/orphaned/long-stale media.
- Reduce Postgres backup storage if archive export is enough for low-traffic early phase.
- Lower the media budget line for **images-only** and add per-account upload quotas.
- Keep the 30-day cost-review cadence (already good).

#### P2.7 Log volume

**Where**

- `client/src/lib/observability/logger.ts`
- `LOG_LEVEL=info` in prod/staging examples

**Why it matters**

- Info-level logs at volume cost money and noise.

**Plan**

- Set `LOG_LEVEL=warn` (or `info` with strict sampling) in production if log volume becomes material.
- Keep structured JSON logs (needed for any sink).

#### P2.8 Rate limiting is in-process (correct for free tier, but multi-instance caveat)

**Where**

- `client/src/lib/auth/request-safety.ts`

**What happens today**

- In-process mutation rate limiter keyed by IP:route:method, 60/min, 256 KB body cap, origin guard.

**Plan**

- Phase 1: keep in-process (zero cost).
- Later: add Redis/edge limiter only if abuse occurs, and only on mutation endpoints.

---

## 3. Things done well (keep — do not regress)

- `/api/search/suggest`, `/api/locations/*`, and `/api/sitemap*` already use sensible public cache headers — use them as the pattern for other read endpoints.
- Bounded search (`MAX_UNSCOPED_LISTING_ROWS`) prevents unbounded table reads.
- Postgres FTS/trigram indexes and `queryPlan` scaffolding already exist for the SQL search migration.
- `performance/budgets.json` and `docs/performance/phase-1-baseline.md` enforce JS/image budgets.
- Mutation safety + origin checks are cheap and free-tier friendly.
- The repo already documents media/video architecture and the R2 decision.

---

## 4. Recommended priority order (summary table)

| Priority | Action | Expected impact |
|---|---|---|
| **P0.1** | Finish SQL-backed search + DB pagination + short cache | Largest runtime/DB cost reduction at scale |
| **P0.2** | Cache deterministic public GET APIs (search, trends, compare, assist) | Big reduction in serverless invocations |
| **P0.3** | Move images to R2 + Cloudflare transforms / next-image loader | Removes app-origin bandwidth + duplicate derivatives |
| **P0.4** | De-dynamic render-only pages | Reduces serverless invocations |
| **P0.5** | Cache listing metadata reads + static generation from DB | Reduces per-listing DB/CPU cost |
| **P0.6** | Merge/trim CI workflows | Reduces GitHub Actions minutes |
| **P1.1** | Consolidate broker-channel dashboard API calls | Reduces per-dashboard serverless/DB calls |
| **P1.2** | Move media sweep + purges to a single background job | Avoids duplicate per-instance timers |
| **P1.3** | Sample/batch observability, lower Sentry traces | Reduces event/log cost |
| **P1.4** | Keep raw location snapshots in R2, shrink Postgres/backup | Reduces DB storage + backup + restore cost |
| **P1.5** | R2 lifecycle + retention object deletion + upload quotas | Protects the (already low) media budget |
| **P1.6** | Gate and digest email notifications | Avoids recurring send cost |
| **P1.7** | Drive external syncs from scheduler, not UI/requests | Avoids poll + retry waste |
| **P2.x** | Map tiles, analytics counters, calculator endpoints, JS budget, log level, rate limiting | Long-term hygiene / cost control |

---

## 5. Files referenced in this audit

### Runtime / API
- `app/api/search/route.ts`
- `app/api/search/suggest/route.ts`
- `app/api/ai/compare/route.ts`
- `app/api/ai/search-assist/route.ts`
- `app/api/cities/[slug]/market-trends/route.ts`
- `app/api/localities/[slug]/price-trends/route.ts`
- `app/api/investment/metrics/route.ts`
- `app/api/listings/[id]/stats/route.ts`
- `app/api/listings/route.ts`
- `app/api/broker/channel/dashboard/route.ts`
- `app/api/broker/channel/requests/route.ts`
- `app/api/broker/channel/matches/route.ts`
- `app/api/broker/channel/requirements/route.ts`
- `app/api/broker/channel/deals/route.ts`
- `app/api/broker/channel/notifications/route.ts`
- `app/api/broker/channel/erpnext/sync/route.ts`
- `app/api/observability/web-vitals/route.ts`
- `app/api/observability/errors/route.ts`
- `app/api/observability/health/route.ts`
- `app/api/observability/status/route.ts`
- `app/api/observability/slo/route.ts`
- `app/api/menu/uploads/sign/route.ts` (media sign path)
- `app/api/admin/media/*`
- `app/api/rera/*`
- `app/api/locations/*`

### Pages
- `app/listing/[id]/page.tsx`
- `app/blogs/page.tsx`
- `app/developers/page.tsx`
- `app/list-property/page.tsx`
- `app/collections/page.tsx`
- `app/about-us/page.tsx`
- `app/compare/page.tsx`
- `app/locations/*`
- `app/saved/page.tsx`
- `app/saved-searches/page.tsx`
- `app/login/page.tsx`
- `app/dashboard/page.tsx`
- `app/admin/*`
- `app/sitemap.xml/route.ts`
- `app/sitemap/[segment]/route.ts`

### Client
- `client/src/pages/ResultsPage.tsx`
- `client/src/pages/BrokerChannel.tsx`
- `client/src/pages/RoleDashboard.tsx`
- `client/src/components/broker/BrokerChannelPanel.tsx`
- `client/src/components/architech/Pic.tsx`
- `client/src/components/architech/MapListSync.tsx`
- `client/src/components/architech/WebVitalsReporter.tsx`

### Lib / Server
- `client/src/lib/search/server.ts`
- `client/src/lib/search/sql.ts`
- `client/src/lib/repositories/server/prisma.ts`
- `client/src/lib/analytics/listing-stats.ts`
- `client/src/lib/ai/adapter.ts`
- `client/src/lib/ai/guardrails.ts`
- `client/src/lib/listing/events.ts`
- `client/src/lib/media/retention.ts`
- `client/src/lib/media/retention-runtime.ts`
- `client/src/lib/persistence/channel-store.ts`
- `client/src/lib/auth/request-safety.ts`
- `client/src/lib/auth/server-auth.ts`
- `client/src/lib/observability/logger.ts`

### Config / Infra / CI
- `next.config.ts`
- `prisma/schema.prisma`
- `prisma/migrations/*_search_indexes/migration.sql`
- `.env.production.example`
- `.env.staging.example`
- `.env.example`
- `.github/workflows/ci.yml`
- `.github/workflows/quality.yml`
- `governance/operations/phase-1-operational-readiness.json`
- `scripts/build-publish.mjs`
- `scripts/privacy/purge-expired-requirements.mjs`
- `public/images/*`

### Docs
- `docs/architecture/normative/final-three-phase-architecture.md`
- `docs/data/india-location-operations.md`
- `docs/data/phase-1-saved-searches.md`
- `docs/data/prisma-backed-repositories.md`
- `docs/search/prisma-backed-search.md`
- `docs/search/phase-1-search-api.md`
- `docs/observability/phase-1-observability.md`
- `docs/observability/phase-1-error-reporting.md`
- `docs/operations/backup-restore-cost-readiness.md`
- `docs/operations/environment-provisioning-runbook.md`
- `docs/operations/provisioning-execution-checklist.md`
- `docs/performance/phase-1-baseline.md`
- `docs/media/media-storage-decision.md`
- `docs/runtime-activation-gates.md`
