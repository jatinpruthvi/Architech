# Blockers to clear before going live

**Purpose:** everything Architech cannot ship without, gathered into one checklist. Each item states *why it is blocked*, *what to do*, and *how to verify it cleared*. Nothing here is code-blocked — every item needs an external account, a credential, a legal decision, a person, or hardware.

**Verified state:** 5 Sep 2026 — all code/test/CI gates are green (tsc, eslint, 1517 unit tests, 19-route SEO smoke, 113 E2E checks, crawl simulation 494 pages / 0 problems). This file is the gap between "green" and "live".

Cross-references: workstream IDs (`P1-…`) are from `PHASE-1-IMPLEMENTATION-PLAN.md`; decision IDs (`D5-…`) from `docs/phase-1-batch5.md`; production env contract from `docs/runtime-activation-gates.md`.

---

## 0. Do today — one action only the repo owner can take

- [ ] **Revoke the exposed GitHub personal access token.** A token value was pasted in chat earlier. Verification (2026-08-30) found NO token material in the repo or git history, and the sandbox pushes as the platform bot `arena-ai-coding-agent[bot]` — the exposed token is not in use anywhere here. **Still revoke it:** GitHub → Settings → Developer settings → Personal access tokens → delete it. Do not paste token values in chat or docs again.

## 1. Legal & policy sign-off (gates everything below)

- [ ] **Public-indexing approval.** `PUBLIC_INDEXING_ENABLED=true` is the final switch; until approved, the site serves `noindex`, an empty sitemap, and a disallowing robots policy (verified by `pnpm test:seo`). Required sign-off: legal + ops review of public content claims, consent wording, and RERA attribution. (Ref: `docs/runtime-activation-gates.md`)
- [ ] **Lead & consent legal review.** Lead capture stores masked phone + consent text + audit events (in-memory in fixture mode, Prisma-capable). Legal must approve the consent copy, retention windows, and the deletion workflow before real leads are collected. (`P1-LEAD-001`, `P1-DATA-002`)
- [ ] **RERA usage approval.** The demo RERA adapter must not face the public as-is; the approved Gujarat RERA source integration requires legal review. (`P1-RERA-001`)

## 2. Production infrastructure

- [ ] **Provision hosting + database.** Railway/Vercel app service, PostgreSQL with PostGIS, private networking. Runbook: `docs/operations/environment-provisioning-runbook.md`; checklist: `docs/operations/provisioning-execution-checklist.md`. (`P1-PLAT-001`, `P1-PLAT-002`)
- [ ] **Verify migrations against the fresh DB.** `pnpm db:validate`, then `pnpm db:migrate -- --live`. Expected clean run: 14/14 migrations (sandbox proved 5 Sep 2026; two ordering bugs were fixed and are committed).
- [ ] **Seed the production DB.** `pnpm db:seed` equivalent against the production URL. Sandbox proof: 12 cities / 72 localities / 5 listings / 1 org + RLS proof 29/29.
- [ ] **Backups + restore drill.** `docs/operations/backup-restore-cost-readiness.md` — schedule the backup job and perform one real restore before launch.
- [ ] **Replace the in-process rate limiter.** `docs/runtime-activation-gates.md` notes the current limiter is per-process and is deliberately a free-tier baseline; before multi-instance launch, move to a shared edge/Redis-backed limiter.
- [ ] **Secrets through the proper channel.** All secrets via the runbook's delivery path (never chat). Reference: `docs/operations/secrets-management.md`.

## 3. Authentication go-live

- [ ] **Set live auth env.** `BETTER_AUTH_SECRET` (real), `BETTER_AUTH_URL` (production origin). Flip `ARCHITECH_AUTH_SOURCE=better-auth`.
- [ ] **Provision passkeys/2FA/recovery + org memberships** in the database, then smoke the live flows. (`P1-AUTH-001`; live-mode e2e flows already exist and pass: `pnpm test:e2e:only`)
- [ ] **Confirm demo auth stays off.** In production builds, demo sessions are refused (`DEMO_AUTH_DISABLED`, asserted by e2e). Never set `ARCHITECH_ALLOW_DEMO_AUTH_IN_PRODUCTION` on the real deployment — that flag exists only for previews/E2E (D5-05).

## 4. Data cutover (order matters)

- [ ] **First — land the M-1 deferred slice (D5-04): make the `SeoPage` registry, sitemap, and PIN-directory indexes prisma-backed.** Today they read the fixture registry. If you enable indexing while pages are prisma-built but the sitemap is fixture-built, the sitemap advertises URLs the live graph does not link (orphans / sitemap-404s). The crawl gate will catch this locally: `node scripts/seo/crawl-simulation.mjs` must pass with 0 problems under the prisma build before continuing.
- [ ] **Then flip `ARCHITECH_DATA_SOURCE=prisma`** with `DATABASE_URL` pointed at the provisioned DB.
- [ ] **Re-run the indexed crawl against the production-like build** (`PUBLIC_INDEXING_ENABLED=true`): expect sitemap ⊆ crawl, self-canonicals, depth ≤ 4, 0 problems.
- [ ] **Reconcile PIN data against an authoritative India Post source, recording the retrieval date** (LEG-001-style provenance). Until then `?pincode=` and PIN pages stay demo-sourced. (`P1-DATA-004` remaining acceptance)
- [ ] *(Optional, quality)* **Enrich seed listing dossiers** (`sourceSummary`/`details`) so prisma-mode listing pages carry the same `numberOfBathroomsTotal`-grade JSON-LD detail as fixtures. The mappers already pass the field through; only the seed data is thinner. (D5-06 follow-up)

## 5. Live provider wiring

- [ ] **Sentry org + DSN, log drains, OpenTelemetry export, dashboards + alert thresholds.** Flip the Sentry env per `docs/runtime-activation-gates.md`; expected effect: SLO basis flips from `bootstrapped` to `observed` as traffic arrives (already wired through `/api/observability/web-vitals` + `/api/observability/slo`). (`P1-OBS-001`)
- [ ] **Cloudflare R2 / Stream for media.** `ARCHITECH_MEDIA_STORAGE` → approved R2 mode; enable malware scanning, worker-generated derivatives, captions/transcripts. (`P1-MEDIA-001`)
- [ ] **Gujarat RERA live adapter.** Set `ARCHITECH_RERA_SOURCE=gujarat` only after the legal item in §1 clears. (`P1-RERA-001`)
- [ ] **Google Search Console.** Verify domain ownership, provision API credentials, submit `sitemap.xml`, enable live ingestion. (`P1-SEO-004`; dry-run audit already in CI via `pnpm seo:gsc:audit`)
- [ ] **Notification provider** (email/SMS/push): saved-search alerts currently persist intent only; delivery needs a provider account.

## 6. People & process

- [ ] **Editorial review workflow staffing.** Guides have publishability gates and freshness policies; someone must own review before content flips indexable. (`P1-CONT-001`)
- [ ] **Disclosure review process for outreach.** The authority registry forbids paid links and requires named reviewers; appoint them and run one dry-run disclosure review. (`P1-OFF-001`)
- [ ] **Incident runbook exercise.** Walk one synthetic incident (backup restore + rollback) with the runbooks before real traffic relies on them.

## 7. Hardware

- [ ] **Redmi-class device motion benchmark.** Motion system fallbacks exist (no-WebGL/reduced-motion), but the acceptance bar is a real low-end device pass — cannot be faked in CI. (`P1-UI-002`)

---

## Go-live sequence, in order

1. §0 token revocation (owner, today)
2. §1 legal approvals — indexing gate stays OFF until signed
3. §2 infrastructure + DB verification + backups
4. §3 auth go-live on live env
5. §4 data cutover — M-1 deferred slice first, then the prisma flip, then the indexed crawl must be 0 problems
6. §5 providers one by one, each verified by its audit script (`security:audit`, `ops:audit`, `release:audit`, `provisioning:audit`, `seo:gsc:audit`)
7. §6 processes staffed, §7 device benchmark
8. FINAL: `PUBLIC_INDEXING_ENABLED=true` → full gate run (`check`, `lint`, `test`, `build`, `test:seo`, `test:e2e:only`, crawl simulation) must be green on the production build

When every box above is checked, the release report `docs/release/` and this plan's tracker rows can move to their launch states.
