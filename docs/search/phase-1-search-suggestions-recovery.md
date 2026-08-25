# Phase 1 Search Suggestions & No-Results Recovery

**Date:** 25 Aug 2026  
**Workstream:** `P1-SEARCH-003`, `P1-SEARCH-004`

## Suggestions (`/api/search/suggest`)

A deterministic, server-safe suggestion module (`client/src/lib/search/suggest.ts`) returns relevant queries from locality names (English + Devanagari), listing titles, and curated popular queries — never free-text generation.

- `suggestSearch(query, limit)` — locality/listing/popular matches.
- `suggestSearchIncludingRaw(query, limit)` — also prepends a "search for it" entry when nothing matches the raw query exactly.
- Served by `GET /api/search/suggest?q=…&limit=…` with a short cache header.

## No-results recovery (`client/src/lib/search/recovery.ts`)

When a search yields zero homes, `buildSearchRecovery(query, filters)` returns:

- **related localities** (a named locality first, then the highest-inventory localities),
- **alternative popular queries**,
- **`suggestRemovingFilters`** (true when filters/query are unnecessarily restrictive).

This surfaces in the empty state on the results page instead of a dead end, and is linked from `ResultsPage` via the trending/recovery chips.

## Validation

```bash
pnpm exec vitest run client/src/lib/search/suggest.test.ts client/src/lib/search/recovery.test.ts
pnpm check
pnpm lint
pnpm build
node scripts/seo/raw-html-smoke.mjs
```
