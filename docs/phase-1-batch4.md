# Phase 1 Batch 4 — Authority Registry, Media-Attach Hardening

**Date:** 25 Aug 2026  
**Scope:** Turns the `P1-OFF-001` authority/outreach governance from a pure validation module into a real, audited registry with API endpoints; hardens the broker media-attach flow with audit events. No external accounts required.

## Steps shipped

| # | Workstream | Delivered |
|---|---|---|
| 1 | `P1-OFF-001` | Authority asset & outreach **registry** (`registry.ts` + memory/prisma source switch `source.ts` + server adapter `server.ts`) and `GET/POST /api/authority/assets` + `GET/POST /api/authority/outreach`. |
| 2 | `P1-BROKER-001`, `P1-MEDIA-001` | Media attach/detach on a broker draft now records an **audit event** in prisma mode (`attachMediaToDraftForServer` / `detachMediaFromDraftForServer`). |

## Highlights

- **Registry (P1-OFF-001):** `registerAuthorityAsset` and `recordOutreach` are **idempotent** and enforced by the existing `validateAuthorityAsset` / `validateOutreach` rules (no paid links, disclosure required, named reviewer on accepted outreach). `RegistryAsset` / `OutreachRecord` add `createdAt`/`updatedAt`. Source switch `ARCHITECH_AUTHORITY_STORAGE=memory|prisma` (defaults to memory, or prisma when `ARCHITECH_DATA_SOURCE=prisma`).
- **API contract:** the suite now asserts `GET/POST /api/authority/assets` and that `POST /api/authority/outreach` rejects accepted outreach missing a reviewer (400).
- **Consistent with existing adapters:** server-only, telemetry-neutral, audit-event writes in prisma mode, and contract tests at the boundary.
- **Env:** `ARCHITECH_AUTHORITY_STORAGE=memory` added to `.env.example`.

## Validation

```bash
pnpm check
pnpm lint
pnpm test          # 47 files / 228 tests
pnpm build         # passes in isolation (dev server off)
pnpm test:seo      # 5 routes
pnpm test:perf
pnpm db:validate
pnpm security:audit
pnpm ops:audit
pnpm release:audit
pnpm provisioning:audit
```

## Note

Running `pnpm build` while a dev server is active caused an OOM kill (`exit 137`) in this sandbox; the build succeeds when run alone. This is an environment resource constraint, not a code issue.
