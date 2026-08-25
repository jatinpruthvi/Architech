# Phase 1 Prisma Persistence Adapters

**Date:** 25 Aug 2026  
**Workstream:** `P1-DATA-004`

The broker listing, media, and RERA modules were in-memory contract stores used by the demo. This work adds a server-only write-through persistence layer so that when `ARCHITECH_DATA_SOURCE=prisma` the same operations are written to PostgreSQL; the in-memory contract remains the default fallback so the demo runs without a database.

## Files

```text
client/src/lib/persistence/source.ts
client/src/lib/persistence/rera-store.ts
client/src/lib/persistence/media-store.ts
client/src/lib/persistence/broker-store.ts
client/src/lib/persistence/persistence.test.ts
vitest.config.ts            (stub `server-only` for unit tests)
client/src/test/server-only-stub.ts
```

## Design

- **Single source switch.** `persistence/source.ts` resolves `fixture` vs `prisma` from `ARCHITECH_DATA_SOURCE`, reusing the repository source decision.
- **Write-through, not a rewrite.** Each `*ForServer` adapter calls the domain contract function first (validation + contract shape stay canonical), then — only in `prisma` mode — persists the durable facts.
- **Audit-trailed.** Every write also records an `AuditEvent`, consistent with the existing lead/RERA audit approach.
- **FK-safe media.** The media adapter resolves the owning `Listing` before writing a `PropertyMedia`; if the listing has not been persisted it keeps the record in-memory rather than writing an orphaned row.

## What persists

| Operation | Prisma write |
|---|---|
| `requestReraCorrectionForServer` | `ReraRecord` (disputed) + `AuditEvent` |
| `markReraStaleForServer` | `ReraRecord` (stale) + `AuditEvent` |
| `resolveReraCorrectionForServer` | `ReraRecord` (verified/disputed) + `AuditEvent` |
| `createMediaUploadForServer` | `PropertyMedia` (pending) + `AuditEvent` |
| `completeMediaUploadForServer` | `PropertyMedia.derivatives` |
| `moderateMediaForServer` | `PropertyMedia.moderationStatus` + `AuditEvent` |
| `createListingDraftForServer` | `Listing` (DRAFT) + `AuditEvent` |
| `submitListingForReviewForServer` | `Listing` (IN_REVIEW) + `AuditEvent` |
| `moderateListingForServer` | `Listing` (ACTIVE/CHANGES_REQUESTED/REJECTED) + `AuditEvent` |
| `getModerationQueueForServer` | reads `Listing` where `IN_REVIEW` |

## Wiring

- `/api/rera/corrections` → `requestReraCorrectionForServer`
- `/api/admin/rera/[registration]/refresh` → `markReraStaleForServer`
- `/api/media/uploads/sign` → persists `PropertyMedia` after provider signing
- `/api/media/uploads/[uploadId]/complete` → `completeMediaUploadForServer`
- `/api/admin/media/[uploadId]/moderate` → `moderateMediaForServer`
- `/api/broker/listings` → `createListingDraftForServer`
- `/api/broker/listings/[draftId]/submit` → `submitListingForReviewForServer`
- `/api/admin/moderation/listings/[draftId]` → `moderateListingForServer`

## Testing

The persistence path runs against the real database only in `prisma` mode (live DB is part of production provisioning). Unit tests exercise the contract-safe pieces that run without a DB:

- source resolution (`fixture` default; `prisma` selected by env),
- fixture/memory fallback round-trips for broker create→submit→moderate→queue,
- RERA correction + stale marking,
- media sign→complete→moderate.

To allow direct unit testing, `vitest config` aliases `server-only` to an empty stub (Vitest is a plain Node runtime, not a React Server Component one); the real guard stays in the production bundle.

## Validation

```bash
pnpm check
pnpm lint
pnpm test
pnpm build
pnpm test:seo
pnpm test:perf
pnpm security:audit
pnpm ops:audit
pnpm release:audit
pnpm db:validate
```

**Remaining acceptance:** live verification against a provisioned Postgres/PostGIS instance, plus restore-drill evidence, remain part of production environment provisioning.
