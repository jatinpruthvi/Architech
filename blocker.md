# Blockers to clear before going live

**Purpose:** everything Architech cannot ship without, gathered into one checklist by sweeping every markdown file in the repository (verified 5 Sep 2026). Each item states *why it is blocked*, *what to do*, and *how to verify it cleared*. Most items need an external account, credential, legal decision, person, or hardware; §8 lists the engineering items that need code only.

**Verified baseline:** all code/test/CI gates are green locally (tsc, eslint, 1517 unit tests, 19-route SEO smoke, 113 E2E checks, crawl simulation 494 pages / 0 problems). This file is the gap between "green" and "live".

Cross-references: workstream IDs (`P1-…`) per `PHASE-1-IMPLEMENTATION-PLAN.md`; decision IDs (`D5-…`) per `docs/phase-1-batch5.md`; production env contract per `docs/runtime-activation-gates.md`.

---

## 0. Do today — owner-only action

- [ ] **Revoke the exposed GitHub personal access token.** A token value was pasted in chat earlier. Verified 2026-08-30: no token material in the repo or git history; the sandbox pushes as `arena-ai-coding-agent[bot]`, so the exposed token is in use nowhere here. **Still revoke it:** GitHub → Settings → Developer settings → Personal access tokens → delete. Never paste token values in chat, tickets, or docs again.

## 1. Legal & privacy gates (LEG-001…LEG-009)

Canonical table with owners, evidence requirements, and release procedure: [`governance/legal/LEGAL-GATES.md`](./governance/legal/LEGAL-GATES.md). All nine are **pending approval** (`docs/release/phase-1-release-report.md`). A rejected/expired gate disables the feature or sends it to its safe fallback — the code paths already honor this.

- [ ] **LEG-001 RERA ingestion** — source terms, field mapping, provenance, freshness, correction, republication, disclaimer.
- [ ] **LEG-002 Personal data** — notice, consent/withdrawal, access/correction/deletion, retention, processor inventory, security, incident process. Specifically: approve the 180-day requirement-retention window, approve a retention period for every active flow in `docs/security/privacy-data-flow-map.md`, schedule purge monitoring, name the incident-response owner, enable managed encryption-key rotation.
- [ ] **LEG-003 Broker media rights** — rights record linked to every public asset.
- [ ] **LEG-004 Public-record republication** — permitted use, attribution, caching, update, correction, liability (RERA + market data).
- [ ] **LEG-005 Email/messaging** — consent, transactional classification, unsubscribe, deliverability (gates Resend/alert delivery).
- [ ] **LEG-006 Sponsored links/PR** — disclosure, `rel="sponsored"`, editorial separation, rendered-link audit.
- [ ] **LEG-007 Commercial leads** — broker terms, billing, dispute, data-sharing (gates any pay-per-lead product).
- [ ] **LEG-008 AI/generated content** — human review, no-invention rules, provenance, correction process (gates any LLM search).
- [ ] **LEG-009 Localization** — translation rights, editorial responsibility, claims review (gates Hindi pages publicly).
- [ ] **Public-indexing approval** — after the above lands per scope: `PUBLIC_INDEXING_ENABLED=true` is the final switch; until then the site serves noindex + empty sitemap + disallowing robots (verified by `pnpm test:seo`).
- [ ] **DPDP Act review** for exact-coordinate/DIGIPIN access control and encrypted contacts (`docs/data/india-location-architecture.md` §Production gates 5).

## 2. Official location / PIN data (the big one)

Everything is **implemented and fail-closed**: OGD snapshot fetcher, India Post + LGD importers, coverage release audit, `/locations/*` pages and APIs, staging-until-proved import states. What does not exist is the *data itself* in production. Full handoff with exact resource IDs, thresholds, and acceptance checklist: [`official India Post and LGD resource IDs and URLs todo.md`](./official%20India%20Post%20and%20LGD%20resource%20IDs%20and%20URLs%20todo.md); runbook: [`docs/data/india-location-operations.md`](./docs/data/india-location-operations.md).

- [ ] **Obtain an authorized `DATA_GOV_IN_API_KEY`** (registered data.gov.in account) into the runtime secret manager — never in chat, Git, manifests, or tickets. Alternative approved path: a human attaches the two original official CSV exports; production apply stays blocked until provenance is approved.
- [ ] **Unblock egress to `api.data.gov.in:443` / `www.data.gov.in:443`** — the previous sandbox attempt failed with TLS resets (ECONNRESET) before any API response. If unattended environments can't reach OGD, use the attach-original-exports path.
- [ ] **GODL-India / OGD legal approval** for the exact distributions (attribution, non-endorsement, exemptions), plus per-source license review: India Post circle PDFs (reuse terms; parser + human reconciliation), LGD portal formats, Survey of India boundary products (product-specific; viewable ≠ bulk-republishable), OSM ODbL attribution/share-alike.
- [ ] **Archive immutably** — approved, encrypted, versioned object storage for CSV+manifest pairs (local staging is not a production archive; records object version IDs).
- [ ] **Apply + activate:** migrations applied to PostGIS, dry-runs reviewed (rejections zero or individually approved), then `corepack pnpm location:coverage:audit` must exit 0 — expected minimums: India Post ≥150,000 rows / ≥18,000 unique PINs / ≥35 jurisdictions; LGD ≥4,000 rows / ≥3,000 bodies / ≥3,000 unique PINs / ≥30 jurisdictions; freshness ≤45d (India Post) / ≤90d (LGD). Only then `ARCHITECH_DATA_SOURCE=prisma` for location reads.
- [ ] **Standing freshness ops:** scheduled monthly imports, checksum drift alerts, stale-source thresholds, rollback to prior snapshot, import-run dashboards.
- [ ] **Locality reconciliation job** — multi-signal (name/alias, containment, PIN overlap, OSM proximity, listing evidence) with the documented confidence policy (0.5 fixture = never auto-published; <0.8 never exact) and manual editorial review of conflicts.
- [ ] **Never promote post-office/LGD labels to product City/Locality rows, never infer state from PIN prefix, never claim authoritative nationwide locality coverage until gates pass.** Today PIN data is illustrative demo data; README states this and must stay accurate until reconciliation completes.

## 3. Production infrastructure

- [ ] **Provision hosting + managed data.** Railway/Vercel app, PostgreSQL with the **PostGIS extension installed** (`postgis` must be creatable/installed before migrations if the migration role lacks superuser). Runbook: `docs/operations/environment-provisioning-runbook.md`; checklist: `docs/operations/provisioning-execution-checklist.md`; prepared manifests (`vercel.json`, `railway.json`, `docker-compose.production-like.yml`, `governance/environments/phase-1-environments.json`). (`P1-PLAT-001/002`)
- [ ] **Production deploy target serves APIs.** *(code fixed)* `railway.json` now runs `pnpm start:next` (the Next runtime; `/api/observability/health/` returns 200 against a live boot, verified locally) and the old static snapshot survives as the explicitly-labelled `pnpm start:static` demo target. Remaining: run the target once on the live host as part of §3.
- [ ] **DB verification + seed.** `pnpm db:validate`, `pnpm db:migrate -- --live` (sandbox-proved 14/14 migrations on 5 Sep; two ordering bugs fixed and committed), then seed; RLS policy proof re-run against the production cluster.
- [ ] **Backups + restore drill** with the procedure from `docs/operations/backup-restore-cost-readiness.md` — including replaying erasure tombstones before restored services accept traffic (deleted PII must not reappear).
- [ ] **Secrets via the inventory.** Every secret lands in the platform secret store per `governance/secrets/phase-1-secret-inventory.json` policy — never chat/Git. Storage audit exists: `pnpm security:audit`.
- [ ] **Shared rate limiting + cross-instance events.** In-process rate limiter is a deliberate single-instance baseline (`docs/runtime-activation-gates.md`); replace/supplement with edge/Redis before multi-instance. Same for the in-memory listing event bus (M-5) — durable queue or documented single-replica constraint.
- [ ] **Rollback tested, environment management live, health checks wired** (`/api/observability/status` exists; hook it to the platform monitor).

## 4. Authentication go-live

- [ ] Set `BETTER_AUTH_SECRET` (real) + `BETTER_AUTH_URL` (production origin); flip `ARCHITECH_AUTH_SOURCE=better-auth`.
- [ ] Provision passkeys/2FA/recovery flows and organization memberships in the DB; verify with the live-mode E2E flows (`pnpm test:e2e:only` covers registration/sign-in/session revocation in live mode).
- [ ] Confirm demo auth remains refused in production (`DEMO_AUTH_DISABLED`; never set `ARCHITECH_ALLOW_DEMO_AUTH_IN_PRODUCTION` outside previews/E2E — D5-05).
- [ ] **Buyer account dashboard** becomes possible here (attentiveness: favorites + saved searches + alerts visible per account).

## 5. Data cutover (strict order)

1. [ ] **Land the M-1 deferred slice first (D5-04): prisma-back the SeoPage registry, sitemap, and PIN-directory indexes.** Otherwise pages are prisma-built while the sitemap advertises the fixture corpus — orphan URLs and sitemap-404s. Gate: `node scripts/seo/crawl-simulation.mjs` must show 0 problems on the prisma-built, indexing-enabled candidate.
2. [ ] Then flip `ARCHITECH_DATA_SOURCE=prisma` with the production `DATABASE_URL`.
3. [ ] Re-run indexed crawl on the production-like build: sitemap ⊆ crawl, self-canonicals, depth ≤ 4, 0 problems.
4. [ ] *(Quality, non-blocking)* Enrich seed/listing dossiers with structured details so prisma-mode pages match fixture JSON-LD richness (D5-06 follow-up).

## 6. Live providers

- [ ] **Sentry org + DSN**, log drain, OpenTelemetry export, dashboards + alert thresholds, release/environment tagging in deploys. SLO basis flips bootstrapped→observed automatically once traffic flows. (`P1-OBS-001`)
- [ ] **R2/Stream media.** *(signer code fixed)* — SigV4 presigning is real now (`lib/media/sigv4.ts` with the worked golden-vector test, `R2MediaStorageProvider`, R2 env fail-closed validation). Remaining is provisioning-side: R2 account + bucket, malware scanning, derivative workers, captions/transcripts, then `ARCHITECH_MEDIA_STORAGE` → approved R2 mode. (`P1-MEDIA-001`)
- [ ] **Gujarat RERA adapter** *(honesty fixed)*: the "configured" path used to emit a fabricated `ok`/`NOT_FOUND` verdict from a placeholder parser — it now fails closed (501, explicit refusal) so no unverified verdict can ever reach a buyer. Remaining: implement the approved source fetch/parse, then set `ARCHITECH_RERA_SOURCE=gujarat` after LEG-001. Each additional state authority needs its own legal-approved adapter. (`P1-RERA-001`)
- [ ] **Search Console:** domain verification + API credentials; submit sitemaps; enable live GSC per-URL ingestion (board exists; `pnpm seo:gsc:audit` dry-runs in CI). (`P1-SEO-004`)
- [ ] **GA4** connection (analytics provider account).
- [ ] **Notifications (Resend/email-SMS-push):** saved-search **delivery pipeline now implemented** (`lib/saved-search/alerts.ts` + runtime subscribed to the listing event spine): gated on `SAVED_SEARCH_ALERTS=on` + `RESEND_API_KEY` + sender, conservative both-intent matching, `Idempotency-Key` dedupe, per-recipient fail-soft, LEG-005-shaped copy with manage link. Remaining: provider account + verified sender + LEG-005 template approval, and lead notifications still needed.
- [ ] **AI provider (optional):** *(honesty fixed)* `ARCHITECH_AI_PROVIDER=external` still falls back deterministically, but an external success now reports `estimatedCostInr: null` (unmetered) with an explicit warning — never a fabricated 0. Remaining: wire a real provider with real token-cost telemetry, or formally keep deterministic-only.

## 7. Broker WhatsApp channel (lead follow-up)

The broker decision docs select a private, feature-flagged evolution/Baileys-style adapter for near-immediate consented lead follow-up from brokerage-owned numbers, with the official Meta Cloud path as the compliant alternative (`docs/broker-suite/open-source-ecosystem-evaluation.md`, `docs/broker-suite/decision.md`).

- [ ] Choose and provision the provider account (official BSP/Meta Cloud, or the private adapter behind its documented activation gate).
- [ ] Encrypted contact point, durable outbox, HMAC gateway, feature flag, per-shard capacity testing.
- [ ] **Before-launch proof (from the decision doc):** API sends appear on the employee phone; customer replies appear there; native replies emit the expected provider event; reconnect/replay does not duplicate CRM activity.
- [ ] Generic-content push fallback only ("New lead assigned — open CRM" with no customer PII), itself needing a browser/privacy test.

## 8. Engineering gates before launch (code only, no external account)

> All §8 gates are cleared on the release branch as of this edit. The step below in the go-live sequence now means *verify* on the production-like build, not *implement*.

- [x] **M-1 deferred slice** — DONE (`dce311a`): prisma-backed SeoPage registry + sitemap composition landed; the crawl-simulation gate still must be re-run on the release candidate (see §5 step 1).
- [x] **Agent workspace placeholder surfaces (I-6)** — DONE (`430a9aa`): dashboard KPIs, filter strips, inquiry/leads tabs now render live counts/rows or honest "—" with explanatory sublabels; no dead controls remain.
- [x] **`Listing.details` column (I-9)** — DONE: migration `202609050001_listing_details_json` landed; `detailsJson Json?` is the single validated boundary, writers store validated details there, and readers validate field-by-field with a prose-safe legacy fallback for pre-column rows (`lib/listing-details-contract.ts`). The bath/parking **chip group** stays desk-only deliberately: its counts would silently exclude rows that predate structured details until feed import lands them at volume — flipping early would train buyers to distrust the filter bar. That flip is a data-coverage gate (§9), not code.
- [x] **Scope Compare/Collections per account** — DONE: `compareKeyFor`/`collectionsKeyFor(userId)` scope storage per account, guest trays fold into the account on sign-in (`mergeGuest*`), the pre-scoping global keys are adopted once onto the guest tray via `adoptLegacy*`, and the contexts read `session.user.id`. Scoping tests green with the plan marker.
- [x] **Media retention enforcement at runtime (I-11)** — DONE: `lib/media/retention-runtime.ts` runs the policy sweep in-process from `instrumentation.ts` (`MEDIA_RETENTION_SWEEP_INTERVAL_MINUTES`, `MEDIA_RETENTION_SWEEP=off` escape), enforcing PENDING 30d / REJECTED 14d / TAKEDOWN 7d with `media.retention.enforced` audit events; the publish gate consults `isPublishable` so approved-but-unprocessed uploads cannot publish (`persistence/broker-store.ts`).
- [x] **"Search this area" map control (I-8)** — DONE: the control emits the real viewport rectangle into a `bbox` URL param that re-runs the shared search pipeline (`listingWithinBounds` on locality markers, strict `parseBoundsParam`; same URL → same results on share/reload). A not-ready or failed map degrades to an explanation toast — never an inert control.
- [x] **Property CRUD UI** — DONE: the wizard (`/broker/listings/new?draft=<id>`) now loads an existing draft and saves back through PATCH (an edit-mode marker makes the action unambiguous), and the workspace My-listings table carries real Edit / Archive / Restore / two-step Delete actions wired to `app/api/broker/listings/[draftId]` with surfaced server errors. No hidden "Review-only" dead end remains.

## 9. Content & data backlogs (code cannot create these)

- [ ] **Project/society pages data** — sold prices, RERA project records, yield, distance data (the round-11 wedge; gates and contracts exist).
- [ ] **Original city price reports** — blocked on transaction data (the link-earning core).
- [ ] **Locality landmark data** — 60/72 localities currently carry none; content backlog, not code.
- [ ] **Per-city editorial guides** beyond Ahmedabad (reviewed content per market).
- [ ] **Rights-cleared video**, **Google Business Profile** creation/maintenance, **genuine review collection**, **builder/society/media association relationships** (off-page authority is earned, not coded).
- [ ] **Verified per-city inventory sources** replacing generated demo listings before claiming real supply (`P1-DATA-003` remaining acceptance).
- [ ] **Statutory rate tables** per state/UT with versioned conditions/effective dates + legal review (Gujarat-only today; unknown states correctly show "unavailable").

## 10. People & hardware

- [ ] **Editorial review owner** for guides (gates content indexability — `P1-CONT-001`).
- [ ] **Outreach disclosure reviewer** (named reviewer per accepted placement — `P1-OFF-001`).
- [ ] **Incident-response owner + one live runbook drill** (backup restore + rollback) before real traffic.
- [ ] **Redmi-class device motion benchmark** (`P1-UI-002`) — cannot be validated in CI.

## 11. Phase-2 scope (listed so nobody mistakes absence for oversight)

Schedule tours, digital offer submission/negotiation, e-signature, escrow/earnest-money, payment processing, rent collection, maintenance tracking, rent-vs-buy calculator, school ratings, walk score, 3D/virtual tours, AVM, fractional ownership, virtual staging, MLS/IDX (not applicable — RERA covers this market). These need financial/legal providers and are deliberate Phase-2, not launch blockers.

---

## Go-live sequence, in order

1. §0 token revocation (owner, today)
2. §1 legal gates approved per scope (indexing stays OFF until the applicable LEGs are signed)
3. §3 infrastructure — deploy target fixed (I-10), DB verified, backups drilled, secrets inventoried
4. §4 auth go-live on live env
5. §2 official location data acquired/imported/audited — `location:coverage:audit` exits 0
6. §5 data cutover — M-1 slice first, then the prisma flip, then indexed crawl = 0 problems
7. §8 engineering gates cleared on the release branch
8. §6 providers wired one by one, each verified by its audit (`security:audit`, `ops:audit`, `release:audit`, `provisioning:audit`, `seo:gsc:audit`)
9. §7 WhatsApp channel activated separately, with its launch proof
10. §10 processes staffed, device benchmark passed
11. **FINAL:** `PUBLIC_INDEXING_ENABLED=true`, then the full gate set — `check`, `lint`, `test`, `db:validate`, `build`, `test:seo`, `test:e2e:only`, crawl simulation — green on the exact production build
