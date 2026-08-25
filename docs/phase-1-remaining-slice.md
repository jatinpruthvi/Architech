# Phase 1 Remaining Slice — Coverage & Acceptance

**Date:** 25 Aug 2026  
**Scope:** The implementable Phase 1 items that do not require external account/credential provisioning. Each is a deterministic, server-safe module with unit tests and, where appropriate, a real route or page integration. Items requiring live external accounts (Sentry/R2/GSC/legal/production DB) are tracked as `blocked` and are intentionally *not* fabricated.

## Steps shipped (workstream → module → integration)

| # | Workstream | Module | Integration | Tests |
|---|---|---|---|---|
| 1 | P1-I18N-001, P1-SEARCH-001 | `client/src/lib/search/aliases.ts` | wired into `matchesQuery` (filters) | `aliases.test.ts` |
| 2 | P1-SEARCH-002 | `client/src/lib/ai/adapter.ts` | contract + deterministic fallback | `adapter.test.ts` |
| 3 | P1-AUTH-001 | `client/src/lib/auth/live-session.ts` | server-only cookie resolution | `live-session.test.ts` |
| 4 | P1-SEO-003, P1-SEO-004 | `client/src/lib/seo/lifecycle.ts` | listing `page.tsx` (404/410/301) + `seo/pages.ts` indexability | `lifecycle.test.ts` |
| 5 | P1-CONT-001 | `client/src/lib/content/review.ts` | guide publishability gate + CI test | `review.test.ts` |
| 6 | P1-OBS-001 | `client/src/lib/observability/slo.ts` + `trace.ts` | `/api/observability/slo` route | `slo.test.ts` |
| 7 | P1-MEDIA-001, P1-DATA-002 | `client/src/lib/media/retention.ts` | media pipeline contract | `retention.test.ts` |
| 8 | P1-SEO-004 | `client/src/lib/seo/gsc.ts` | provider-abstracted GSC ingestion | `gsc.test.ts` |
| 9 | P1-OFF-001 | `client/src/lib/governance/authority.ts` | outreach/disclosure governance | `authority.test.ts` |
| 10 | P1-PLAT-001 | `client/src/lib/operations/hygiene.ts` | secret/remote-env/rollback checks | `hygiene.test.ts` |

## Industrial practices applied

- **Deterministic & server-safe.** Every module is pure, side-effect-free, and importable from server routes/components with no client directive.
- **Provider abstraction.** Search Console, AI, and Better Auth all sit behind source switches so external SDKs never leak into the client bundle and the demo/fallback path is always available.
- **Fail-closed.** Live GSC provider throws when unconfigured; AI adapter falls back to deterministic; live-session adapter reports `not-configured` rather than fabricating a session.
- **Contract tests.** Each module has a dedicated Vitest suite asserting behavior at the boundary.
- **Real integrations.** The listing page now enforces lifecycle HTTP behavior; the SEO registry gates listing indexability; a real `/api/observability/slo` route is served; guide publishability is enforced.
- **Auditability + disclosure.** Authority module forbids paid links and requires disclosure + named reviewer for accepted outreach.

## Security posture

- `hygiene.ts` detects common secret shapes and rejects any git remote embedding credentials; maintains an env allow-list.
- Live-session adapter never exposes raw provider tokens; the redacted logger covers phone/email/token.
- Search Console live provider fails closed until credentials are provisioned.

## Validation

```bash
pnpm check
pnpm lint
pnpm test          # 42 files / 193 tests
pnpm build
pnpm test:seo
pnpm test:perf
pnpm security:audit
pnpm ops:audit
pnpm release:audit
pnpm provisioning:audit
pnpm db:validate
```

## Blocked (external provisioning only)

- **P1-PLAT-002** — Railway/Postgres/Redis provisioning (needs accounts).
- **P1-SEO-004** — live Search Console API ingestion (needs domain verification + Google credentials).
- **P1-MEDIA-001 / P1-RERA-001** — R2/Stream and Gujarat RERA live adapters (need accounts + legal).
- **P1-OBS-001** — Sentry/log drain dashboards + OpenTelemetry export (needs Sentry org + DSN).
- **P1-AUTH-001** — live Better Auth sessions + passkeys/2FA/recovery (needs DB + secret + legal).
- **Final production environment provisioning** — Vercel/Railway/R2/DNS + non-chat secret delivery.
