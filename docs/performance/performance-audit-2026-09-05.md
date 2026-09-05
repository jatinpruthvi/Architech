# Performance Audit — Architech (2026-09-05)

**Scope:** whole app — client bundles, render path, server TTFB, images, fonts, API payloads, budgets.
**Trigger:** "check is there any performance related changes that we have to do."
**Gate of record:** `pnpm test:perf` (build + `performance/budgets.json`).

## What was found and fixed

### 1. `/search` first-load JS was over budget (gate failing)

- **Before:** 245,153 B gzip vs the 245,000 B cap (153 B over). A/B build against the
  parent commit showed the previous commit (R2 render path) added +358 B gzip on top of
  only 205 B of remaining headroom — the budget had been ratcheted within 205 B.
- **Fix (code splitting, per the regression policy):** the filter sheet on `/search`
  was the only *static* consumer of `vaul` (the gesture-drawer library). `CompareTray`
  and `SearchQuickView` were already dynamic imports, so the whole drawer stack
  (~11.2 KiB gzip / ~37.8 KiB raw) sat in the route's first load for a UI that only
  renders after a tap. Extracted to `client/src/components/architech/FilterSheet.tsx`
  loaded via `next/dynamic` (footer built inside the sheet — `DrawerClose` must live in
  the Drawer's context, and importing just that primitive would drag `vaul` back).
- **After:** 233,914 B gzip → **11,086 B headroom** restored. Budgets unchanged.
  `test:perf` passes.

### 2. Render-blocking third-party font chain

- **Before:** every route linked `fonts.googleapis.com/css2` (render-blocking, external
  origin, extra round-trips: preconnect → CSS → woff2 from `fonts.gstatic.com`).
- **Fix:** self-hosted via Fontsource npm packages (woff2, `unicode-range` subsets,
  `font-display: swap`): `@fontsource-variable/space-grotesk`,
  `@fontsource-variable/instrument-sans`, `@fontsource/ibm-plex-mono` (400/500),
  `@fontsource/noto-sans-devanagari` (400/500). Imported in `app/layout.tsx`; family
  names in `theme.css` updated to Fontsource's `* Variable` names; CSP dropped the
  Google origins (`style-src`, `font-src` now `'self'`).
- **Verified:** 0 Google references in served HTML; all 4 families' woff2 serve 200
  from `/_next/static/media/`; `:root` vars and Tailwind `.font-display/.font-sans/.font-mono`
  utilities all resolve to the registered families; Devanagari fallback stays in the
  chain for Hindi names.
- **Net effect:** font CSS rides in the already-loaded same-origin stylesheet (no extra
  blocking request), font files fetch in parallel from the same origin (no second
  TLS/preconnect), and the site has no third-party font dependency. Note: the sandbox
  cannot reach `fonts.googleapis.com` at build time, which is why Fontsource (npm) was
  chosen over `next/font/google` — same outcome, no build-time network dependency
  beyond npm.

## Verified (local, fixture mode)

| Check | Result |
|---|---|
| `pnpm test:perf` (budgets) | pass — all routes/HTML/static-assets/images under caps |
| `tsc` / lint / unit tests | 0 / 0 / 1648 passed |
| production build | green |
| TTFB (local prod server) | ≤ 57 ms on `/`, `/search`, `/listing/[id]`, `/buy/[city]` (static/ISR) |
| SEO smoke / crawl simulation | 19 routes / 7 sitemaps; 494-page crawl clean |
| e2e (HTTP-level) | 50/50 |
| font delivery (prod server) | all families 200, self-hosted, zero Google requests |
| CI audits (contrast/security/ops/release/production/provisioning) | all pass |

Not runnable in this sandbox (run in CI): `db:validate` (Prisma engine download),
Playwright a11y/UI suites (no browser binary), Lighthouse/CrUX field data (needs a
public deployment).

## Confirmed OK (no action)

- Route rendering: static/ISR where content is deterministic (`revalidate=600` listings,
  `3600` locations/developers, static blogs/collections/list-property).
- API cache headers (search 30s/60s, AI+market 300s/86400s, channel 15s private) — P0.2.
- Channel dashboard consolidated to one response (P1.1) — payload reduction.
- Map + quick-view + compare tray already dynamic imports on `/search`.
- Image derivatives within budgets (mobile WebP ≤ 225 KiB, full ≤ 300 KiB, JPEG ≤ 400 KiB).
- `optimizePackageImports` for `lucide-react` + `motion` already configured.
- Web-vitals RUM sampling live (P1.3) — field CWV data will flow once deployed.

## Remaining performance work (ordered, not started)

1. **P0.1 (largest, server-side):** in `prisma` mode the search still loads all ACTIVE
   listings and filters/pages in JS (`lib/search/server.ts`). Full SQL filtering +
   pagination (`ARCHITECH_SEARCH_SQL_NARROW=on` covers candidate narrowing) is the
   remaining step — blocked on pg_trgm migration confirmation in every prisma env.
   This is the dominant TTFB/query cost at volume, before any edge cache.
2. **Field RUM review:** once the deployed app collects web-vitals (sampled
   `NEXT_PUBLIC_WEB_VITALS_SAMPLE_RATE`), review real LCP/INP/CLS vs the targets
   (2500/200/0.1) and re-baseline from field data, not lab estimates.
3. **Budget headroom discipline:** `/` sits at 215,106 B gzip vs 240,000 (25 KB
   headroom) and `/search` now has 11 KB. Any feature that grows first-load JS should
   prefer dynamic imports (pattern: `FilterSheet.tsx`) over a budget raise.
4. **Post-deploy:** Lighthouse/CrUX reporting (baseline doc §"future work"), and a
   check that the edge (Cloudflare) caches the ISR/static HTML + font assets with
   long `max-age` (build hashes make them immutable).
