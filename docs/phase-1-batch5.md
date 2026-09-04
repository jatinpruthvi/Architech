# Phase 1 Batch 5 — Live-Boundary Hardening, Crawl Simulation, E2E Marketplace Flows

**Date:** 5 Sep 2026
**Scope:** Every remaining non-blocked pending item from the priority scan: live-DB validation evidence (`P1-DATA-001`), the M-1 public-read adapter slice, the cmdk command palette (`P1-SEARCH-002` browse layer), snapshot-drift pinning (`P1-SEO-002`), links-first crawl simulation (`P1-SEO-003`), broader E2E journeys (`P1-TEST-001`), visual/Devanagari browser suite (`P1-UI-001`), entity locale-field contract (`P1-I18N-001`), and this decision register (`P1-GOV-001`). External-account activations (Sentry/R2/GSC/legal/production secrets) remain intentionally untouched and blocked.

## Validation (this session, final state)

```bash
pnpm check                  # clean
pnpm lint                   # 0 problems
pnpm test                   # 137 files, 1511 tests — all pass
pnpm build:ci               # exit 0
pnpm test:seo               # 17 routes + 7 sitemaps — pass (fixture-pinned)
pnpm test:e2e:only          # 45 public + 16 marketplace + 50 auth — all pass
node scripts/seo/crawl-simulation.mjs   # 492 pages crawled, 444 sitemap URLs, 0 problems (fixture + indexing enabled)
pnpm test:ui                # browser-required; 22 tests registered, runs in CI (Playwright install step already present)
```

## Decision register (P1-GOV-001)

| ID | Decision | Why | Enforced by |
|---|---|---|---|
| D5-01 | No layout-default canonicals; noindex utility pages self-reference. | A layout canonical stampede once leaked the homepage canonical onto four unrelated pages. | `scripts/seo/crawl-simulation.mjs` canonical checks (491 pages) |
| D5-02 | Crawler treats absolute URLs as same-site when their origin is the served origin OR the canonical origin. | `urls.ts` builders mint SITE_URL-absolute hrefs; rejecting them hid 12 real orphans and would hide more. | crawler link extraction |
| D5-03 | Footer links `/price-index/` (site-wide), closing the 13-URL orphan family. | The hub linked every city page but nothing linked the hub; sitemap ⊆ crawl now holds. | crawl histogram 1@0 / 27@1 / 93@2 / 259@3 / 64@4 = 444 |
| D5-04 | M-1: all public listing reads go through `lib/repositories/server/prisma.ts` (`*ForServer`). Deferred slice: `SeoPage` registry/sitemap + PIN directory indexes still fixture-driven — flipping `PUBLIC_INDEXING_ENABLED` under `ARCHITECH_DATA_SOURCE=prisma` advertises fixture URLs the prisma-built graph doesn't link ("orphans"). **Must land (or indexing stays off) before real prerendering under prisma.** | One read path per data mode; CI stays static via fixture fallback identical shape. | `app/buy/page.tsx`, `app/developers/page.tsx`, `app/page.tsx` conversions; deferred slice flagged in todo |
| D5-05 | `ARCHITECH_ALLOW_DEMO_AUTH_IN_PRODUCTION=true` is the documented preview/E2E escape hatch for demo-session writes; default-off keeps 503 (`DEMO_AUTH_DISABLED`) in real production builds. | The audit's "explicit safe mode" language predated implementation; without it the public preview can render content but cannot demo saved-search/broker journeys. | `client/src/lib/auth/guards.ts`; contract test in `tests/e2e/auth-flows.mjs`; documented in `docs/runtime-activation-gates.md` |
| D5-06 | `pnpm test:seo` pins fixture mode for BOTH build and smoke server (`scripts/seo/run-seo-suite.mjs`). | Route assertions embed fixture identities; a local `.env` with `ARCHITECH_DATA_SOURCE=prisma` silently baked seed content (no `details.bathroom` → dropped `numberOfBathroomsTotal`) and failed the suite for the wrong reason. CI has no `.env`, so the pin is a no-op there and a fix locally. (pnpm strips empty env vars, node spawn doesn't — the wrapper sets `""` deliberately.) | wrapper + spawn-env pin in `raw-html-smoke.mjs` |
| D5-07 | `dbListingToProperty` maps `meaningfulUpdatedAt` onto the Property (ISO date string), not just the freshness label. | Prisma listing pages silently lost `<time dateTime>` / `dateModified` freshness stamps; found by running test:seo against the prisma-mode build. | mapper + 43 repository suite tests |
| D5-08 | Marketplace E2E journeys pin the money-paths HTTP contract: lead validation/consent/masking/audit/idempotent-replay; saved-search create→list→dedupe→delete→delete-again 404; cross-account invisibility; broker draft RBAC + field-level errors; suggest hostile-input containment; observability SLO flipping bootstrapped→observed with real traffic. | These were unit-tested but never exercised over HTTP against the production server; the suite caught zero production bugs and four of its own bad assumptions — exactly the calibration expected from a new journey suite. | `tests/e2e/marketplace-flows.mjs` (16 checks) in `run-all.mjs` and CI |
| D5-09 | The UI browser suite asserts LAYOUT FACTS (no horizontal overflow, html `lang` flips, Devanagari renders in the dedicated font stack, palette journeys) instead of pixel-diff screenshots. | Baseline screenshots flake across CI GPUs/font hinting; layout facts are machine-stable and catch the real failure class (Hindi text expansion breaking the hero). | `tests/ui/visual-i18n.spec.ts` (22 tests across desktop+mobile), `playwright.ui.config.ts`, CI step |
| D5-10 | Entity locale completeness is a test: every fixture city/locality AND seed city/locality carries a Hindi name containing Devanagari (contains-check, not exclusivity — `साल्ट लेक सेक्टर V` keeps its official Roman numeral), and fixture↔seed city parity holds. | `row.hindiName ?? row.name` fallback makes missing Hindi names invisible until someone reads a Hindi page aloud. | `client/src/lib/entity-locale.test.ts` (5 checks) |
| D5-11 | New UI components use semantic tokens only (`.ink-2/.ink-3`, `text-cream`, `placeholder:text-current placeholder:opacity-50`) — never `text-ink/NN` alpha or `!text-[10\|11]px`. | The design-token ratchet baselines NEW files at 0; per-theme semantic classes keep AA contrast in both palettes. | `design-token-discipline.test.ts` |
| D5-12 | The crawl simulation forces `PUBLIC_INDEXING_ENABLED=true` on the server it boots. | Simulations must measure the INDEXED surface; HTML pages keep build-time env since they're prerendered. | crawler spawn env (commented in place) |

## Follow-ups recorded (not blocking this batch)

- **M-1 deferred slice** (D5-04): SeoPage registry / sitemap / PIN-directory indexes prisma-backed before enabling indexing under a prisma launch.
- **Seed dossier detail**: prisma seed listings don't carry `details.bathrooms` etc., so their JSON-LD omits `numberOfBathroomsTotal` (by design for absent fields). Enrich seed `sourceSummary` if dossier parity in prisma mode is wanted; `test:seo` stays a fixture-corpus contract (D5-06).
- **test:ui** requires a browser download locally (CI installs Chromium); the suite was validated by registration/parse here and gates in CI.

## Artifacts added/changed this batch (high-signal)

- `scripts/seo/crawl-simulation.mjs` — segments, canonical-origin link resolution, indexed-surface boot; now a CI step.
- `scripts/seo/run-seo-suite.mjs` + `package.json test:seo` — fixture-pinned SEO suite.
- `tests/e2e/marketplace-flows.mjs` + `run-all.mjs` registration — 16 money-path checks.
- `tests/ui/visual-i18n.spec.ts` + `playwright.ui.config.ts` + CI step — 22 layout checks.
- `client/src/lib/entity-locale.test.ts` — locale-field contract.
- `client/src/lib/repositories/mappers.ts` — `meaningfulUpdatedAt` survives to the page (D5-07).
- `client/src/lib/auth/guards.ts` — documented demo-in-production escape hatch (D5-05).
- `client/src/components/architech/CommandPalette*.tsx` — palette on semantic tokens.
- `client/src/components/architech/Footer.tsx` — City price index link (D5-03).
- `docs/runtime-activation-gates.md` — new flag row.
