# Gujarat RERA Provider Handoff

**Date:** 24 Aug 2026

This slice adds a provider abstraction for moving from the demo RERA adapter to an approved Gujarat RERA source integration.

## Source mode

```text
ARCHITECH_RERA_SOURCE=demo | gujarat
```

Default:

```text
demo
```

## Required live-provider environment

```text
GUJARAT_RERA_BASE_URL=
GUJARAT_RERA_API_KEY=
```

## Provider abstraction

```text
client/src/lib/rera/provider.ts
client/src/lib/rera/server/provider.ts
```

Implemented providers:

- `DemoReraProvider`
- `GujaratReraProvider`

The Gujarat provider currently returns a configured placeholder contract. Real fetching/parsing must wait for legal/source approval under `LEG-001` and `LEG-004`.

## Production handoff

1. Approve Gujarat RERA source terms.
2. Store API/access secrets outside source control.
3. Set `ARCHITECH_RERA_SOURCE=gujarat` in staging.
4. Implement fetch/parser with source URL, retrieval timestamp, parser version, confidence, and raw evidence.
5. Persist to Prisma `ReraRecord` and `AuditEvent`.
6. Keep stale/disputed/correction states visible on public pages.
