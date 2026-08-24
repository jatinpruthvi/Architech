# Phase 1 Prisma/PostgreSQL/PostGIS Data Foundation

**Date:** 24 Aug 2026  
**Workstream:** `P1-DATA-001`

This is the first production data-model slice for Architech. The app still reads from TypeScript fixtures until the next work item adds a repository/data-access layer, but the canonical PostgreSQL schema is now represented in Prisma.

## Files

```text
prisma/schema.prisma
prisma.config.ts
prisma/migrations/202608240001_phase1_domain_schema/migration.sql
prisma/seed.mjs
```

## Domain coverage

The schema includes Phase 1 entities for:

- `City`
- `Locality`
- `Listing`
- `PropertyMedia`
- `BrokerOrganization`
- `User`
- `BrokerUser`
- `ReraRecord`
- `Lead`
- `AuditEvent`
- `SavedSearch`

It also includes lifecycle/status enums for:

- listing lifecycle
- verification status
- translation status
- media moderation status
- property type
- user role
- lead mode/status

## Commands

```bash
pnpm db:validate    # validates prisma/schema.prisma
pnpm db:generate    # generates Prisma Client
pnpm db:migrate     # deploys committed migrations to DATABASE_URL
pnpm db:seed        # seeds Ahmedabad demo data into DATABASE_URL
```

## Seed data

`prisma/seed.mjs` creates representative Ahmedabad data matching the current prototype fixtures:

- Ahmedabad city
- 6 locality records
- Nivasa Partners broker organization
- demo RERA evidence record
- 4 demo listings
- primary media records
- one audit event recording the seed

## PostGIS note

The Phase 1 architecture calls for PostgreSQL/PostGIS. This schema stores latitude/longitude as decimal columns now so it can validate and migrate cleanly without requiring a local PostGIS extension in every development environment. The later map/search workstream should add PostGIS geometry/geography columns and spatial indexes once database provisioning is active.

## Validation status

Validated locally with:

```bash
pnpm db:validate
pnpm db:generate
```

Migration SQL is generated from the Prisma schema with `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script`. A live `migrate deploy`/seed run requires a real PostgreSQL database via `DATABASE_URL`.
