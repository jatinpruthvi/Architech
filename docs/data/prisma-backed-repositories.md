# Prisma-backed Repository Adapter Plan

**Date:** 24 Aug 2026

This slice introduces the server-only Prisma repository adapter while keeping fixture repositories as the default for local preview and CI.

## Data source mode

```text
ARCHITECH_DATA_SOURCE=fixture | prisma
```

Default:

```text
fixture
```

## Why fixture remains default

- Arena previews work without a live database.
- CI remains deterministic.
- Production can switch to Prisma once `DATABASE_URL` points to a provisioned PostgreSQL/PostGIS database.

## Server-only adapter

```text
client/src/lib/repositories/server/prisma.ts
```

Exports async server functions:

- `getListingsForServer()`
- `getListingByIdForServer()`
- `getListingsByLocalityForServer()`
- `getLocalitiesForServer()`
- `getLocalityBySlugForServer()`

The adapter imports `server-only` and must not be imported into client components.

## Mapping layer

```text
client/src/lib/repositories/mappers.ts
```

Maps Prisma rows to the existing UI/domain view models:

- Prisma `Listing` → `Property`
- Prisma `Locality` → `Locality`

## Production handoff

After a live database is provisioned:

1. set `ARCHITECH_DATA_SOURCE=prisma` in staging,
2. run `pnpm db:migrate`,
3. run `pnpm db:seed`,
4. switch selected server routes to async server repositories,
5. run SEO/raw HTML/performance/accessibility gates,
6. only then enable production mode.
