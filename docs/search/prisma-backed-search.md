# Prisma-backed Search Adapter Plan

**Date:** 24 Aug 2026

This slice prepares `/api/search` for PostgreSQL FTS/trigram-backed search while keeping fixture fallback as the default for CI and previews.

## Search source mode

```text
ARCHITECH_SEARCH_SOURCE=fixture | prisma
```

If unset, it follows `ARCHITECH_DATA_SOURCE`:

- `ARCHITECH_DATA_SOURCE=fixture` → fixture search
- `ARCHITECH_DATA_SOURCE=prisma` → Prisma/PostgreSQL search mode

## Current behavior

`app/api/search/route.ts` now uses the server search adapter:

```text
client/src/lib/search/server.ts
```

In fixture mode, it returns the same deterministic parser/filter/sort results as before.

In Prisma mode, the response source changes to:

```text
postgres-fts-trigram
```

and includes query-plan metadata generated from:

```text
client/src/lib/search/sql.ts
```

## PostgreSQL search plan

The plan uses:

- `Listing.searchVector @@ websearch_to_tsquery('english', $query)`
- trigram matching on listing title, description, address locality, and locality name
- BHK, price, and RERA filters
- freshness or price sorting
- bounded limit up to 100

## Production handoff

After staging database provisioning:

1. set `ARCHITECH_DATA_SOURCE=prisma`,
2. set `ARCHITECH_SEARCH_SOURCE=prisma`,
3. run migrations including `202608240002_search_indexes`,
4. add DB-backed golden query tests against staging fixtures,
5. inspect query plans for FTS/trigram index usage,
6. record latency baseline.
