# Phase 1 Hardening Slice

**Date:** 25 Aug 2026  
**Scope:** A focused hardening batch that closes requirement gaps with industrial practice (contracts + provider abstraction + real route/page integrations + tests), none of which require external accounts.

## Steps shipped

| # | Workstream | Module | Integration | Tests |
|---|---|---|---|---|
| 1 | P1-LEAD-001, P1-DATA-002 | `client/src/lib/leads/lead.ts` | soft-delete + consent-revoke workflow | `lead.test.ts` |
| 2 | P1-MEDIA-001, P1-DATA-002 | `client/src/lib/media/upload.ts` + `persistence/media-store.ts` | takedown + delete workflow | `upload.test.ts`, `retention.test.ts` |
| 3 | P1-SEO-003 | `client/src/lib/search/pagination.ts` + `seo/facets.ts` | search pagination meta + faceted indexability gate | `pagination.test.ts`, `facets.test.ts` |
| 4 | P1-TEST-001 | `client/src/lib/api-contract.test.ts` | built route-handler contract suite | `api-contract.test.ts` |

## Details

### 1. Lead deletion & consent-revocation (P1-LEAD-001, P1-DATA-002)
- `softDeleteLead(id)` / `revokeLeadConsent(id)` set status `DELETED` and append an audited `statusHistory` event.
- `listActiveLeads()` excludes soft-deleted records → the broker inbox only shows live leads.
- Server adapter adds `deleteLeadForServer` / `revokeLeadConsentForServer` (memory + prisma, prisma marks `deletedAt`, writes an `AuditEvent`).
- API: `DELETE /api/broker/leads/:id?mode=consent|delete`.

### 2. Media takedown & deletion (P1-MEDIA-001, P1-DATA-002)
- `requestMediaTakedown(uploadId, reason)` → `TAKEDOWN_REQUESTED`; `deleteMedia(uploadId)` → removes the record.
- Server adapter adds `requestMediaTakedownForServer` / `deleteMediaForServer` (writes `AuditEvent` in prisma mode).
- API: `POST /api/admin/media/:uploadId/takedown?action=takedown|delete`.
- Complements the retention/EXIF policy (`retention.ts`) shipped earlier.

### 3. Search pagination & faceted indexability (P1-SEO-003)
- `paginate()` returns deterministic `PaginationMeta` (page, pageSize, total, totalPages, hasNext/Previous) with a page-size cap (`MAX_PAGE_SIZE=48`, default `24`).
- Integrated into `searchListings` and `searchListingsForServer`; `SearchResponse` now carries `page`.
- `facets.ts` encodes the SEO-003 rule: arbitrary facet combinations (query + filter + sort + page) are always `noindex` in Phase 1.

### 4. API contract suite (P1-TEST-001)
- `api-contract.test.ts` drives the **built route handlers** directly (search, suggest, leads, health, slo, errors, saved-searches, rera, ai-assist) and asserts stable response shapes/status codes — catching payload drift that would break clients, without a live DB.

## Industrial practices
- Deterministic & server-safe modules; source-abstracted providers (memory/prisma); audited deletions; fail-closed behavior.
- Contract tests at the boundary; real route/paginated integrations; pagination and indexability policy encoded declaratively.

## Validation
```bash
pnpm check
pnpm lint
pnpm test          # 45 files / 212 tests
pnpm build
pnpm test:seo
pnpm test:perf
pnpm security:audit
pnpm ops:audit
pnpm release:audit
pnpm provisioning:audit
pnpm db:validate
```

## Blocked (external provisioning only, not fabricated)
Live Sentry/R2/GSC/legal, Better Auth sessions + passkeys/2FA, Railway/Postgres/Redis provisioning, and final production environment provisioning.
