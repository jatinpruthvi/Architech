# Phase 1 RERA Adapter, Provenance, and Correction Workflow

**Date:** 24 Aug 2026  
**Workstream:** `P1-RERA-001`

This slice defines the RERA verification contract before live Gujarat RERA integration is enabled.

## API contracts

```text
GET  /api/rera/gujarat?registration={registrationNumber}
POST /api/rera/corrections
POST /api/admin/rera/{registration}/refresh
```

## Current behavior

The implementation is a demo adapter with:

- Gujarat RERA registration-number format validation
- seeded demo RERA record
- source URL
- retrieved timestamp
- parser version
- confidence score
- matched evidence fields
- visible disclaimer
- stale/disputed/verified states
- correction request workflow
- correction resolution workflow
- audit trail events

## Production handoff

Replace the demo adapter with an official-source integration that:

1. fetches or ingests Gujarat RERA records under approved terms
2. stores source URL, retrieval timestamp, parser version, confidence, and raw evidence
3. marks stale records based on freshness policy
4. supports public correction requests
5. lets moderators resolve/reject corrections
6. writes to Prisma `ReraRecord` and `AuditEvent`
7. blocks public RERA badges for disputed/stale records unless visible status is shown

## Validation

```bash
pnpm test -- client/src/lib/rera/rera.test.ts
pnpm check
pnpm lint
pnpm test
pnpm build
```
