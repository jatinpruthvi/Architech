# Prisma-backed Lead Persistence Adapter

**Date:** 24 Aug 2026

This slice prepares `/api/leads` for production persistence while keeping the in-memory contract as the default for CI and previews.

## Lead storage mode

```text
ARCHITECH_LEAD_STORAGE=memory | prisma
```

If unset, the lead API follows `ARCHITECH_DATA_SOURCE`:

- fixture mode → in-memory lead contract
- prisma mode → Prisma-backed lead persistence

## Server adapter

```text
client/src/lib/leads/server.ts
```

The server adapter:

- validates input,
- looks up an active listing in Prisma mode,
- checks idempotency key,
- creates `Lead`,
- creates linked `AuditEvent`,
- returns the same stable API response shape.

## Production handoff

After staging database provisioning:

1. set `ARCHITECH_DATA_SOURCE=prisma`,
2. set `ARCHITECH_LEAD_STORAGE=prisma`,
3. verify `/api/leads` writes `Lead` and `AuditEvent`,
4. add notification queue/provider,
5. add deletion/retention job,
6. run privacy/legal approval for enabled lead capture.
