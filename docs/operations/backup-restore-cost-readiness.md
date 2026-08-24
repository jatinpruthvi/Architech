# Phase 1 Backup, Restore, and Cost Readiness

**Date:** 24 Aug 2026  
**Workstream:** `REL-001`, `COST-001`

This document defines the operational readiness contract before production services are provisioned.

## Targets

| Target | Phase 1 value |
|---|---:|
| RPO | 24 hours |
| RTO | 4 hours |
| Backup retention | 30 days |
| Restore drill cadence | 90 days |
| Cost review cadence | 30 days |

The machine-readable source of truth is:

```text
governance/operations/phase-1-operational-readiness.json
```

## Service coverage

The readiness registry covers:

- Next.js web delivery
- PostgreSQL/PostGIS
- Redis/cache/queues
- Cloudflare R2/Stream media
- transactional email
- Sentry/logging/RUM

Each service must have:

- owner
- criticality
- backup strategy
- restore strategy
- monthly budget
- alert threshold

## Restore drill procedure

1. Create isolated staging environment.
2. Restore latest database backup.
3. Run `pnpm db:migrate`.
4. Run smoke tests against restored data.
5. Verify media originals and derivatives are readable.
6. Verify lead and audit records survived restore.
7. Record actual RPO/RTO.
8. File remediation tasks for gaps.

## Cost readiness

Monthly cost reviews must cover:

- web hosting
- database
- Redis/queues
- media storage and delivery
- email
- observability
- background jobs
- AI/search experiments

A budget alert should be created for each service at the configured `alertAtPercent` threshold.

## Current state

This is a readiness contract. Live backup restore evidence requires production/staging services. The CI audit ensures we do not forget ownership, budgets, retention, RPO/RTO, or restore-drill steps.
