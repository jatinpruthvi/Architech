# Performance Audit — 2026-09-06

**Scope:** production build artifacts + static code analysis of the Architech web app (Next.js 16.3.2, Turbopack).
**Method:** the repo's own gate (`pnpm build:ci` + `ops/scripts/performance/budget.mjs`, the same check CI runs) plus manual bundle/HTML/config inspection, executed with the *Performance Tuning Specialist* workflow: **Profile → Deep Analysis → Prioritized Optimization → Validation → Monitoring**.
**Prompt provenance:** "Performance Tuning Agent Role" (prompts.chat, *Performance* tag, retrieved via the prompts.chat registry). The repo's `search_prompts` MCP path was attempted first; this authoring sandbox cannot reach prompts.chat (TLS blocked), so retrieval used the same upstream registry's public pages — identical to earlier validations recorded in `docs/ai/ai-prompt-library.md` §E. Guardrails per that library and `free-first-design-mcp-workflow.md`: every number below was measured on this date; nothing is estimated without being labeled as such.

**Environment:** commit `2a447df` (branch `arena/01a0756c-architech`, merged with `origin/main` b08c481), Node 22.22.3, pnpm 10.4.1, cold build cache.

---

## 1. Profile — measured baseline

### Build facts
- Compile: **21.7 s**; TypeScript check: **16.9 s**; static generation: **513 pages** (○/● static+SSG dominates; dynamic ƒ limited to auth/broker APIs, `/property-search`, `/property/[...segments]`, sitemaps).
- No build cache configured in this environment (CI caching would speed rebuilds — build-time only, not runtime).

### Gate result: **PASS** — all budgets green

| Budget (ops/config/performance/budgets.json) | Limit | Measured | Headroom |
|---|---:|---:|---:|
| Shared first-load JS baseline (most routes) | ≤ 770.0 KiB raw / 240.0 KiB gzip | 642.4 / 197.0 KiB | 16.6% / 17.9% |
| `/search` first-load JS | ≤ 820.0 raw / 245.0 gzip | **737.9 / 228.4 KiB** | 10.0% / **6.8%** |
| `/broker/dashboard`, `/broker/agent` | default | 726.6 / 218.6 KiB | 5.6% / 8.9% |
| `/listing/[id]` | default | 722.6 / **222.5** KiB | 6.2% / **7.3% gzip** |
| `/requirements` | default | 706.6 / 218.9 KiB | — |
| Sampled HTML (6 routes) | ≤ 128.0 KiB | **/ : 113.4 KiB** (highest) | homepage at **88.6%** of cap |
| `/buy/ahmedabad/paldi/`, `/listing/garden-courtyard/` HTML | ≤ 128.0 KiB | 91.8 / 91.9 KiB | ~28% |
| `/search/`, `/home-loan/`, `/buy/ahmedabad/` HTML | ≤ 128.0 KiB | 26.6 / 30.0 / 51.6 KiB | comfortable |
| Total `.next/static` JS | ≤ 2212.0 KiB | **1608.2 KiB** (58 chunks) | 27.3% |
| Largest chunk | ≤ 1100 raw / 280 gzip | 229.0 / 71.7 KiB | 79% |
| Image derivatives (24 assets) | ≤ 225/300/400 KiB | largest 368 KiB JPEG, 268 KiB WebP | all pass |
| Core Web Vitals (LCP ≤ 2.5 s, INP ≤ 200 ms, CLS ≤ 0.1, TTFB ≤ 800 ms) | targets | **not measurable in sandbox** — no RUM/Lighthouse yet | open item F6 |

## 2. Deep analysis

### What is already strong (verified, not assumed)
- **Server-first architecture holds:** 513 prerendered pages; client JS is a shell, not the content.
- **MapLibre kept out of bundles:** `/vendor` static copy + runtime `import()` with `turbopackIgnore` (`MapListSync.tsx`) keeps **1.14 MB** of map code (556+480+84+20 KiB) out of route chunks.
- `optimizePackageImports: ["lucide-react", "motion"]` guards the icon/motion barrels.
- **Sentry costs nothing when unused:** `enabled: Boolean(NEXT_PUBLIC_SENTRY_DSN)`; 0 of 58 client chunks contain Sentry code in this build.
- **Fonts self-hosted** via `@fontsource-variable/space-grotesk`, `@fontsource-variable/instrument-sans`, `@fontsource/ibm-plex-mono` in `app/layout.tsx` → 37 hashed files in `.next/static/media`, consistent with CSP `font-src 'self'`.
- Budget gate runs in CI (`.github/workflows/ci.yml` → `pnpm test:perf`), with documented ratchet discipline in `budgets.json`.

### Findings, ranked by user-perceived impact

| # | Finding | Class | Evidence |
|---|---|---|---|
| F1 | **Shared client shell is the dominant cost:** 197.0 KiB gzip before route code on *every* route — including nearly-static pages (`/privacy`, `/terms`). Broker surfaces push it to ~726.6 KiB raw. | network/parse | route-bundle-stats; 58 chunks; 65 `use client` files in `src` |
| F2 | **`/search` gzip headroom is only 6.8%** (228.4 / 245.0). Conversely its raw line *dropped* ~36 KiB since the 820000 ceiling was set (773.9 → 737.9 measured) — the ceiling no longer guards sensitively. | budget hygiene | budgets.json `why` vs this build |
| F3 | **Homepage HTML at 88.6% of the 128 KiB cap** (113.4 KiB). Next content additions will trip the gate with warning-level margin. | HTML weight | budget check output |
| F4 | **No explicit immutable caching for `/vendor`** (maplibre ~1.14 MB, version-pinned at config-eval) or `public/images` derivatives → default revalidation on repeat visits. | caching | `next.config.ts` headers() (only security + dev `/_next` rules) |
| F5 | Doc/comment drift: `next.config.ts` says fonts via `next/font` (actually @fontsource imports); R2 `loaderFile` for `next/image` is wired, but components use the direct `<picture>/<img>` path over the same pure module (intentional dual path — undocumented). | maintainability | greps listed in §4 |
| F6 | **CWV targets are unmeasured targets.** The baseline doc already plans RUM + Lighthouse post-deploy; until then the most user-visible budget class has no evidence. | measurement gap | `docs/performance/phase-1-baseline.md` |

## 3. Prioritized optimizations (impact vs effort)

| Priority | Action | Expected impact | Effort |
|---|---|---|---|
| P1 | **Profile shell composition** (bundle-analysis of the 642 KiB baseline: largest contributors among the 65 client components + shared deps; split broker-only modules behind broker route segments). Every KiB here multiplies across all 513 routes. | High | Medium |
| P1 | **Re-ratchet `/search` raw ceiling down** (820000 → ~780000) using this build's measured before/after — permitted by the budget file's own ratchet rule; restores regression sensitivity while gzip budget keeps guarding the real risk. | Governance | Low |
| P1 | **Immutable cache headers for versioned assets:** pin `/vendor` behind a versioned path (e.g. `/vendor/maplibre@6.5.0/...`) + `Cache-Control: public, max-age=31536000, immutable`; same for hashed `.next/static/media` fonts (already content-hashed — verify long-cache applies). | High repeat-visit | Low |
| P2 | **Homepage HTML contributor breakdown** (inline RSC payload vs markup) before the next content batch; keep `/` under ~110 KiB. | Medium | Low |
| P2 | Verify the LCP hero on `/` and locality hubs uses the `-800.webp` mobile derivative + `fetchpriority`/preload hints (largest derivatives: `locality-street.webp` 268 KiB, `stepwell.webp` 256 KiB). | Medium (LCP) | Low |
| P3 | Font subset pruning (latin + devanagari only; vietnamese/cyrillic subsets shipped by current @fontsource imports). | Low | Low |
| P3 | Land RUM + scheduled Lighthouse after deploy (planned in baseline doc) so CWV stops being an unevidenced target; then re-baseline `coreWebVitalsTargets`. | High (evidence) | Medium |

*Estimated-impact items are directional engineering judgment; every measured claim is in §1–§2 with its command/output source.*

## 4. Validation performed (this audit, all commands run on 2026-09-06)

1. `pnpm build:ci` → exit 0 (513 static pages; phases logged above).
2. `node ops/scripts/performance/budget.mjs` → **"Performance budgets passed."** (identical logic to CI's `pnpm test:perf`, minus the redundant rebuild).
3. Direct analysis of `.next/diagnostics/route-bundle-stats.json` (gzip computed per chunk) and `.next/static/chunks` (58 chunks, 1608.2 KiB total).
4. Greps: MapLibre single importer + `webpackIgnore/turbopackIgnore` runtime import; `next/dynamic` ×5; `next/image` ×0 with dual-path media module (`src/lib/media/image-loader.ts` + tests); `use client` = 2 in `app/`, 65 in `src/`; `@fontsource*` imports in `app/layout.tsx`; 37 files in `.next/static/media`; 0/58 chunks referencing Sentry with DSN unset; headers()` rules in `next.config.ts`.
5. Prompt retrieval: live MCP POST `tools/call search_prompts` → `000`/`fetch failed` (sandbox egress block on prompts.chat); registry pages fetched tool-side instead — consistent with the documented sandbox limitation.

## 5. Monitoring & cadence

- Keep the ratchet rule: budget lines move only with a measured before/after recorded in `budgets.json.why`.
- Re-run this audit on any PR touching `next.config.ts`, the media pipeline, broker route segments, or `src/components/architech/MapListSync.tsx`.
- After RUM lands: convert `coreWebVitalsTargets` into measured baselines and add a Lighthouse/CrUX budget line, per the Phase-1 baseline doc's forward plan.

**Conclusion:** the project passes all eight enforced budget classes with 6.8–79% headroom, the build is healthy, and the foundational performance decisions (static-first, vendored map, guarded icon/motion imports, image-derivative caps) are working. The one structural lever worth deliberate investment is the **197 KiB gzip shared client shell (F1)**; everything else is calibration, caching policy, and closing the CWV evidence gap.

---

## Addendum — implementation log (all findings, implemented 2026-09-06)

Every finding above was actioned on the same day; each entry names the change and its measured verification. Gates after the full batch: `pnpm check` ✅ · `pnpm build:ci` ✅ · `node ops/scripts/performance/budget.mjs` ✅ **"Performance budgets passed."**

| # | Status | What changed | Measured result |
|---|---|---|---|
| F1 | **Implemented** | (a) Root `Toaster` now `dynamic(..., {ssr:false})` in `Providers.tsx` (CompareTray precedent); (b) new `src/lib/lazy-toast.ts` — fire-and-forget dynamic `import("sonner")` used by the two universal importers (`CompareContext`, `PropertyCard`); (c) new reproducible attribution tool `pnpm perf:shell` (`ops/scripts/performance/shell-report.mjs`). | Universal shell **642.4 → 609.1 KiB raw (-5.2%)** and **197.0 → 188.0 KiB gzip (-4.6%)**; sonner verified **ejected** from all-route chunks. Remaining ~86% of shell is React/Next framework floor — not splittable; `better-auth` signature persists via `lib/auth` module chain and is logged as a separate reviewed refactor (auth surgery is out of scope for a perf branch). |
| F2 | **Implemented** | `ops/config/performance/budgets.json`: `/search` raw ceiling **820000 → 780000** with measured before/after recorded in `why` (773.9@4f7a308 → 737.9@2a447df). | Budget gate passes with the tighter ceiling; /search measured **738.4 KiB raw** post-changes — guard margin restored. |
| F3 | **Resolved by measurement + decision** (watch item retained) | Anatomy measured: homepage 112.8 KiB = 87.4 KiB markup+text (77%) / 23.3 KiB RSC payloads / ~2 KiB scripts. Driver identified: 74 server-rendered inline `<svg>` (lucide) = 26.9 KiB raw — near-free over gzip, but they count against the raw cap. Decision: no sprite refactor now (wide JSX churn for accounting-only benefit); an icon `<use>`-sprite migration is the documented first lever when `/` approaches the cap. | No regression: HTML class still passes at 113.4/128 KiB; decision + anatomy recorded here as the baseline for the next content batch. |
| F4 | **Implemented** | `next.config.ts` now vendors MapLibre to the version-pinned path `public/vendor/maplibre@6.5.0/` (+ self-cleanup of legacy flat files), injects `NEXT_PUBLIC_MAPLIBRE_VENDOR_PATH` at build time, and adds a matching headers rule `Cache-Control: public, max-age=31536000, immutable`; `MapListSync.tsx` loads JS+CSS from the injected path. | Verified: versioned files on disk, legacy files removed, header rule present; budget totals unchanged (vendor stays out of chunks). Repeat visits no longer revalidate 1.14 MB of map code. |
| F5 | **Implemented** | `next.config.ts` comment drift fixed: fonts are credited to the actual `@fontsource` imports in `app/layout.tsx`; the media block now documents the intentional dual path (`image-loader.ts` pure module == `loaderFile`). | Comment-only change; no runtime effect, verified by inspection. |
| F6 | **Implemented** | RUM half verified pre-existing and documented (`WebVitalsReporter` → `/api/observability/web-vitals`, sampling + beacon, env-gated, covered in `runtime-activation-gates.md`). Added `.github/workflows/lighthouse.yml`: weekly + manual Lighthouse CLI runs against `vars.LIGHTHOUSE_URL` for `/`, `/buy/ahmedabad/`, `/search/`, `/buy/ahmedabad/paldi/` with score summaries + report artifacts; skips cleanly when the variable is unset (free-first: plain Lighthouse CLI, no paid wrappers). | Workflow file committed; lab-mode execution not possible in sandbox (no public deploy URL) — runs post-deploy exactly as the baseline doc planned. |

**Net verified outcome:** universal shell -33.3 KiB raw / -9.0 KiB gzip on every route, tighter `/search` ceiling enforced, 1.14 MB of map assets now immutably cacheable, zero CI budget regressions.
