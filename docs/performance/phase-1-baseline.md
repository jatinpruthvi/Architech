# Phase 1 Performance Baseline

**Date:** 24 Aug 2026  
**Command:** `pnpm test:perf`  
**Purpose:** Keep the public prototype fast while Phase 1 adds heavier production features.

## Budgets

Budgets live in:

```text
performance/budgets.json
```

Current automated gates:

| Budget | Limit |
|---|---:|
| Route first-load JS, raw | ≤ 760 KiB |
| Route first-load JS, gzip | ≤ 230 KiB |
| Sampled server HTML | ≤ 120 KiB |
| Total `.next/static/chunks/*.js` | ≤ 2.1 MiB |
| Largest JS chunk, raw | ≤ 1.1 MiB |
| Largest JS chunk, gzip | ≤ 280 KiB |
| Mobile WebP image derivative | ≤ 225 KiB |
| Full WebP image derivative | ≤ 300 KiB |
| JPEG source image | ≤ 400 KiB |

Core Web Vitals launch targets:

| Metric | Phase 1 target |
|---|---:|
| LCP | ≤ 2.5s |
| INP | ≤ 200ms |
| CLS | ≤ 0.1 |
| TTFB | ≤ 800ms |

These CWV values are targets until real field RUM is added. The current automated check enforces build artifacts and image budgets; future work should add RUM and Lighthouse/CrUX-style reporting after deployment.

## Current measured baseline

Sample from the current Next.js production build:

| Route | First-load JS raw | First-load JS gzip |
|---|---:|---:|
| `/` | ~698 KiB | ~213 KiB |
| `/search` | ~698 KiB | ~215 KiB |
| `/listing/[id]` | ~673 KiB | ~205 KiB |
| `/buy/ahmedabad/[locality]` | ~665 KiB | ~203 KiB |
| `/guide` | ~659 KiB | ~201 KiB |
| `/saved` | ~657 KiB | ~201 KiB |
| `/buy/ahmedabad` | ~654 KiB | ~199 KiB |

Largest current known public HTML artifact: home page, ~98 KiB.

MapLibre is intentionally loaded as a lazy async chunk for the search map/list experience. Route first-load JS budgets remain tight; total/largest static JS budgets allow that lazy map chunk while still catching accidental bundle growth.

**Re-baseline (25 Aug 2026):** the total-static-JS cap was raised from 2.0 to 2.1 MiB to accommodate two added authenticated product surfaces — a managed "Saved searches" page and a functional broker listing-draft form (each is a separate route-level chunk). Per-route first-load budgets and Core Web Vitals targets are unchanged and still strict.

## Regression policy

If a budget fails:

1. Confirm the build is fresh: `pnpm test:perf`.
2. Identify changed routes/chunks from the script output.
3. Prefer code splitting, dynamic imports, smaller fixtures, and image derivative changes before increasing a budget.
4. Only raise a budget when the product need is explicit and the tracker documents the reason.
