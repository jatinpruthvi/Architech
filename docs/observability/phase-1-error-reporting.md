# Phase 1 Client Error Reporting & Boundaries

**Date:** 25 Aug 2026  
**Workstream:** `P1-OBS-002`

## Error boundaries

- **`app/error.tsx`** — route-segment boundary that keeps the editorial shell, lets a user retry without a hard reload, and reports the error to observability. The stack is never shown to users.
- **`app/global-error.tsx`** — root boundary for uncaught errors outside a route segment. Renders its own `<html>`/`<body>` (no providers by design) and reports the error.

## Redacted error reporting

- **`client/src/lib/observability/errors.ts`** — `normalizeClientError(value, metadata)` turns any thrown value into a bounded, serializable report (message/stack truncated, non-printable characters stripped). `isReportableSeverity` validates severity.
- **`POST /api/observability/errors`** — validates the payload and logs it through the redacted pino logger (`phone`/`email`/`token`/`password` paths are redacted before they reach the sink).

## Design rules

- **No PII in the report.** The logger redact list already covers phone/email/token; the normalizer also strips non-printable characters and bounds lengths.
- **Non-blocking.** Boundaary reporting never breaks the user-facing UI.
- **Bucketed.** `buildTag` is included so error clusters can be grouped by version.

## Validation

```bash
pnpm exec vitest run client/src/lib/observability/errors.test.ts
pnpm check
pnpm lint
pnpm build
```

**Remaining acceptance:** sending to Sentry for server-side trace aggregation remains behind `NEXT_PUBLIC_SENTRY_DSN` provisioning (already proxied through the redacted log for Phase 1).
