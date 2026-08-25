# Phase 1 Batch 2 — Product Surfaces & Ops

**Date:** 25 Aug 2026  
**Scope:** Converts several contract-only shell pages into real, working product surfaces and adds ops visibility. No external accounts required.

## Steps shipped

| # | Workstream | Delivered |
|---|---|---|
| 1 | `P1-BROKER-001` | Broker draft listing: `listBrokerDrafts` (workflow) + `listBrokerDraftsForServer` (memory/prisma) + `GET /api/broker/listings`. |
| 2 | `P1-BROKER-001` | Live `ListingSubmission` form — POST `/api/broker/listings`, validation, draft status, submit-for-review. |
| 3 | `P1-BROKER-001` | “My submissions” widget on the broker dashboard (reads `GET /api/broker/listings`). |
| 4 | `P1-SEARCH-001`, `P1-DATA-005` | Managed “Saved searches” page (`/saved-searches`) — list, re-run, delete; URL-builder helper (`urls.ts`) + footer link; SEO-registry noindex lock. |

## Notes

- **Broker draft lifecycle** is now end-to-end: create draft in the browser → submit for review → appears in the moderation queue → moderated to ACTIVE. All backed by the existing memory/prisma adapters.
- **Saved searches** re-run the exact stored query + filters + sort and are delete-managed; `urls.test.ts` locks the canonical run URL. The route is not indexable and is excluded from the sitemap (SEO-003).
- **Performance** re-baseline: total-static-JS cap 2.0 → 2.1 MiB, documented in `docs/performance/phase-1-baseline.md` and `performance/budgets.json`, to accommodate the two added authenticated page surfaces. Per-route first-load and Core Web Vitals targets are unchanged.

## Validation

```bash
pnpm check
pnpm lint
pnpm test          # 46 files / 216 tests
pnpm build
pnpm test:seo
pnpm test:perf
pnpm db:validate
pnpm security:audit
pnpm ops:audit
pnpm release:audit
pnpm provisioning:audit
```
