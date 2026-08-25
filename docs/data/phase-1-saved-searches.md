# Phase 1 Saved-Search Persistence & Alerts

**Date:** 25 Aug 2026  
**Workstream:** `P1-DATA-005`

A buyer can now save a search and be alerted when matching inventory arrives. The record is minimal and consent-aware — it never stores PII.

## Files

```text
client/src/lib/saved-search/source.ts        (storage source switch)
client/src/lib/saved-search/saved-search.ts  (domain + memory store)
client/src/lib/saved-search/server.ts        (prisma write-through adapter)
client/src/lib/saved-search/saved-search.test.ts
app/api/saved-searches/route.ts              (GET list, POST create)
app/api/saved-searches/[id]/route.ts         (DELETE)
client/src/pages/ResultsPage.tsx             (wired "Save this search")
```

## Design rules

- **Source-abstracted.** `ARCHITECH_SAVED_SEARCH_STORAGE=memory|prisma` (defaults to `memory`, or `prisma` when `ARCHITECH_DATA_SOURCE=prisma`). Mirrors the leads/broker/media/RERA adapter pattern.
- **Consent-aware, no PII.** Stores query, filters, sort, and a `notify` flag only.
- **Idempotent.** The memory path dedupes deterministically; the client toasts "already saved" on a duplicate.
- **Wired to the product.** The results page's "Save this search" button POSTs to `/api/saved-searches` with the current query/filters/sort and `notify: true`.

## API

- `GET /api/saved-searches` → `{ ok, savedSearches, count }`
- `POST /api/saved-searches` → `{ ok, savedSearch, duplicate }`
- `DELETE /api/saved-searches/:id` → `{ ok }`

## Validation

```bash
pnpm exec vitest run client/src/lib/saved-search/saved-search.test.ts
pnpm check
pnpm lint
pnpm build
```

**Remaining acceptance:** live notification dispatch (email/SMS) and per-user scoping remain behind production auth (Better Auth) and messaging-provider provisioning.
