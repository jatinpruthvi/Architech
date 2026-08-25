# Phase 1 Trust & Verification Score

**Date:** 25 Aug 2026  
**Workstream:** `P1-TRUST-001`

A listing's trustworthiness is now a single auditable signal rather than a hand-tuned badge. The model derives a 0–100 score only from structured facts that already flow through the repository layer; it never manufactures claims.

## Files

```text
client/src/lib/trust/score.ts
client/src/lib/trust/score.test.ts
```

## Signals & weights

| Signal | Weight | Source of truth |
|---|---|---|
| `rera_verified` | 28 | RERA registration confirmed against an approved source |
| `source_reviewed` | 16 | Listing details reviewed against the source record |
| `broker_verified` | 16 | Listing partner is a verified organization |
| `media_rights_confirmed` | 14 | Media rights confirmed + release evidence on file |
| `freshness_current` | 14 | Meaningfully updated within the freshness window |
| `no_dispute` | 12 | No active RERA dispute or open correction |

The weights sum to 100 so an unimprovable listing would max the score. A listing where every signal is met scores 100 = `HIGH`.

## Penalties

Active disputes and stale flags are penalties, not merely missing signals — a live dispute must cap the grade even if all other signals are met.

| Condition | Penalty |
|---|---|
| `reraDisputed` | −55 |
| `reraStale` | −25 |

## Grades

| Score | Grade | Summary |
|---|---|---|
| ≥ 78 | `HIGH` | Independently verified |
| ≥ 52 | `MEDIUM` | Reviewed, more to confirm |
| < 52 | `LOW` | Needs review |

## Design rules

- **Server-safe:** the module has no `"use client"` directive and no side effects, so server routes, server components, and the SEO registry can share it.
- **Structured facts only:** input is typed (`TrustScoreInput`), never free text, so the score stays explainable and auditable.
- **Explainability is first-class:** `trustScore.reasons` and per-signal `detail` strings describe *why* a listing is trustworthy, surfaced in the UI and JSON-LD.
- **Honest freshness:** demo fixtures use a real `defaultFreshnessMaxDays` of 45 so the signal is not vacuously true.
- **Fixture adapter:** `badgesToTrustInput(badge, status)` maps the demo badge/status strings to structured signals so the fixture-backed fixture surface computes real scores; the Prisma path passes structured fields directly.

## Validation

```bash
pnpm exec vitest run client/src/lib/trust/score.test.ts
```

Covers: full-verification `HIGH`, missing-signal `MEDIUM`, dispute penalty → `LOW`, stale penalty exact score, demo badge mapping, and label stability (6 signals).
