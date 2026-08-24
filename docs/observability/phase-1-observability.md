# Phase 1 Observability Foundation

**Date:** 24 Aug 2026  
**Workstream:** `P1-OBS-001`

This slice adds the first operational visibility contracts for Architech.

## Added

- Sentry initialization files for server plus an explicit client opt-in file
- `instrumentation.ts` and budget-safe `instrumentation-client.ts`
- Pino structured logger with secret/PII redaction
- Web Vitals client reporter
- RUM ingest endpoint: `POST /api/observability/web-vitals`
- Health endpoint: `GET /api/observability/health`
- Web Vital target helpers and tests

## Environment variables

```text
SENTRY_DSN=
NEXT_PUBLIC_SENTRY_DSN=
SENTRY_TRACES_SAMPLE_RATE=0
NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0
LOG_LEVEL=info
APP_ENV=development
NEXT_PUBLIC_APP_ENV=development
```

Sentry stays disabled until DSNs are configured. Client-side Sentry is intentionally not imported by default because it increases every public route's first-load JavaScript; once a client sampling policy is approved, import `sentry.client.config.ts` from `instrumentation-client.ts` and adjust performance budgets deliberately.

## Current limits

This is not yet a full observability stack. Remaining production work:

1. provision Sentry project and DSNs
2. add release/environment tagging in deployment
3. connect logs to a central drain
4. add OpenTelemetry traces around DB/API calls
5. create dashboards and alert thresholds
6. document incident response and SLOs

## Validation

```bash
pnpm test -- client/src/lib/observability/observability.test.ts
pnpm check
pnpm lint
pnpm test
pnpm build
```
