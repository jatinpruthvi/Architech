# Phase 1 Search API and PostgreSQL FTS/Trigram Foundation

**Date:** 24 Aug 2026  
**Workstream:** `P1-SEARCH-001`

This slice introduces a backend search contract while keeping the implementation fixture-backed until a live PostgreSQL service is provisioned.

## API

```text
GET /api/search?q={query}&filters={comma-separated-filter-ids}&sort={fresh|price-asc|price-desc}&limit={1-100}
```

Example:

```bash
curl '/api/search?q=Thaltej&filters=3bhk,rera&sort=price-asc'
```

Response shape:

```ts
type SearchResponse = {
  query: string;
  filters: string[];
  sort: "fresh" | "price-asc" | "price-desc";
  count: number;
  source: "fixture-repository" | "postgres-fts-trigram";
  indexPlan: "deterministic-parser-now-postgres-fts-trigram-next";
  results: Property[];
};
```

## Current implementation

- `client/src/lib/search/search.ts` applies the existing deterministic parser, filters, and sort over repository-backed listings.
- `app/api/search/route.ts` exposes the contract through a Next.js route handler.
- `client/src/pages/ResultsPage.tsx` now fetches from `/api/search` and uses the backend response for result cards/counts.

## PostgreSQL search migration

Manual migration:

```text
prisma/migrations/202608240002_search_indexes/migration.sql
```

It adds:

- `pg_trgm` extension
- generated `Listing.searchVector` `tsvector`
- GIN FTS index on `searchVector`
- trigram indexes on listing title, description, address locality, and locality name

The repository remains fixture-backed until database provisioning is active. When `DATABASE_URL` is ready, the next implementation can switch the search service source from `fixture-repository` to `postgres-fts-trigram` without changing the API surface.

## Validation

```bash
pnpm test -- client/src/lib/search/search.test.ts
pnpm db:validate
pnpm check
pnpm lint
pnpm test
pnpm build
```
