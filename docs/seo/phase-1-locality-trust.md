# Phase 1 Trust-Aware Locality & City Pages

**Date:** 25 Aug 2026  
**Workstream:** `P1-SEO-008`

Trust signals now reach the discovery hubs, not just the listing dossier: the city hub and each locality page surface an area-level trust summary and emit structured verification signals for search engines.

## Files

```text
client/src/lib/trust/locality.ts                  (locality/city aggregation)
client/src/components/architech/LocalityTrust.tsx  (area trust band)
app/buy/ahmedabad/page.tsx                         (city hub JSON-LD + band)
app/buy/ahmedabad/[locality]/page.tsx              (locality JSON-LD + band)
client/src/lib/i18n.ts                             (en/hi locality.trust)
scripts/seo/raw-html-smoke.mjs
```

## What it does

- **Area aggregation.** `localityTrustSummary(slug)` / `cityTrustSummary()` derive RERA coverage %, source-reviewed count, verified-partner count, and an average trust score across the homes in that area — from the per-listing trust scores and structured facts, never invented.
- **Visible band.** `LocalityTrust` renders coverage, verified counts, and the average score with a grade, plus an honest disclaimer and a link to the verification method.
- **JSON-LD.** The city `City` node and each `Place` node now carry `additionalProperty` trust signals (`trustScore`, `trustGrade`, `reraCoveragePct`, `sourceReviewedCount`).
- **Bilingual.** `locality.trust` labels added in both `en` and `hi`, preserving the i18n shape-parity invariant.

## Validation

```bash
pnpm check
pnpm lint
pnpm exec vitest run client/src/lib/trust/locality.test.ts
node scripts/seo/raw-html-smoke.mjs
```

The SEO smoke now asserts `trustScore` and the trust labels are present in the raw HTML of `/buy/ahmedabad/` and `/buy/ahmedabad/paldi/`.
