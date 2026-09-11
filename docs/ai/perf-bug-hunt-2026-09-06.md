# Perf-Bug-Hunt Report — 2026-09-06

**Date:** 2026-09-06
**Runner:** Arena Agent Mode, executing **ARCH-16** (Performance Bug Hunt Protocol) from `docs/ai/ai-prompt-library.md`
**Target:** branch `arena/01a0756c-architech` (PR #62), tip at hunt start: `e6f4c4e`
**Scope:** performance-specific defects introduced or exposed since the 2026-09-06 performance audit (`docs/performance/performance-audit-2026-09-06.md`) and the F1–F6 improvements (`5d88ac9`).

---

## 1. Executive summary

| # | Severity | Class | Status |
|---|----------|-------|--------|
| **PERF-BUG-16-001** | P3 | Data — unbounded queries | **FIXED + guarded** (`GOVERNANCE_LIST_PAGE_CAP`, `server-query-caps.test.ts`) |

**Zero first-load-impact regressions found.** Every audited first-load metric is byte-identical to the 2026-09-06 audit baseline (shell 609.1 KiB raw / 188.0 KiB gzip, `/search` 738.4 KiB raw, both budgets green). The single confirmed defect is a data-layer unboundedness in the governance module: three `findMany` calls with no row cap, safe at current volumes but linear in table growth — exactly the class that becomes a hot incident at 10× data.

Four sweeps produced **no defect** after evidence review (details in §4): unreferenced-`<img>` CLS risks, sequential `await` loops, `JSON.parse(JSON.stringify())` deep clones, and bundle growth beyond budget ceilings.

---

## 2. Method (ARCH-16 phases)

1. **Baseline measurement before any change** (`pnpm build:ci`, `ops/scripts/performance/budget.mjs`, `ops/scripts/performance/shell-report.mjs`).
2. **Sweeps** across four classes: bundle hygiene, render path, data layer, API surface.
3. **Measure before/after for every suspected defect** — no speculative fixes.
4. **Fix confirmed defects** with a regression guard test where practical.
5. **Full gate re-run** (vitest, `pnpm check`, `pnpm lint`, budgets).
6. This report + index entry.

## 3. Baseline (re-measured this build)

| Metric | Audit 2026-09-06 | This build | Drift |
|---|---|---|---|
| Shell first-load, raw | 609.1 KiB | 609.1 KiB | **0.0** |
| Shell first-load, gzip | 188.0 KiB | 188.0 KiB | **0.0** |
| `/search` first-load, raw | 738.4 KiB | 738.4 KiB | **0.0** |
| Raw budget cap | 780 000 B | — | PASS (94.7 %) |
| `ops/scripts/performance/budget.mjs` | PASS | PASS | — |
| `pnpm build:ci` | green | green | — |

First-load posture after F1–F6 is stable with **zero drift** since the audit measurements.

---

## 4. Findings

### 4.1 PERF-BUG-16-001 — governance list queries unbounded (P3, data class) — FIXED

**Evidence.** `src/lib/ops/config/governance/server.ts` contained three Prisma-style `findMany` calls with **no `take` and no pagination contract**:

| Call site | Query | Before fix |
|---|---|---|
| `listRegistryAssetsForServer` | `authorityAsset.findMany({ orderBy: … })` | unbounded |
| `recordOutreachForServer` | `authorityAsset.findMany()` (asset-registry validation read) | unbounded, no args at all |
| `listOutreachForServer` | `authorityOutreach.findMany({ orderBy: { createdAt: "desc" } })` | unbounded |

**Why it matters.** These feed the authority/admin console. Outreach rows carry full lifecycle JSON payloads; an unbounded read scales memory and serialization cost linearly with table growth, and the newest-first ordering means page-1 consumers never needed the tail. The broker-user query in the same sweep was verified safe (org-scoped `where` + narrow `select`), which isolates the defect to the governance module.

**Fix.** Single module-level constant `GOVERNANCE_LIST_PAGE_CAP = 500` (documented in-code: preserves newest-first semantics; zero behaviour change below the cap; bounds worst-case memory/serialization). Applied `take: GOVERNANCE_LIST_PAGE_CAP` at all three call sites.

**Guard.** New `src/lib/ops/config/governance/server-query-caps.test.ts` asserts at source level that (a) the cap constant exists and is positive, and (b) **every** `findMany` in `ops/config/governance/server.ts` passes `take: GOVERNANCE_LIST_PAGE_CAP`. A source-level (filesystem) guard was chosen deliberately: `server.ts` begins with `import "server-only"`, which throws under plain vitest, so behavioural mocking of the Prisma client is impractical; the fs-regex pattern mirrors the proven `env-docs-parity.test.ts` guard from round 2 and makes the *class* of regression CI-visible.

**Guard self-validation (failing-first).** The guard initially failed twice during authoring — first on a wrong relative path depth (governance is one directory deeper than `lib/`), then on a regex that truncated at the first `}` of a nested `orderBy` object. Both were fixed before the green run, confirming the guard actually executes its assertions rather than vacuously passing.

### 4.2 Cleared by evidence (no defect)

| Candidate | Verdict | Evidence |
|---|---|---|
| `<img>` without width/height — `Pic.tsx` | **False positive** | Full-tag read: `width={src ? 1600 : intrinsic.width}` / `height={src ? 900 : intrinsic.height}` present |
| `<img>` in `app/layout.tsx:89`, `NotFound.tsx:16` | **False positive** | Both hits are comment text, not JSX — comment-stripping required before tag sweeps |
| Listing submission blob preview | **CLS-safe** | Preview is constrained by an `aspect-[4/3]` container; placeholder reserves layout |
| Sequential `await` loops in repositories / route handlers | **None found** | Sweep over `await` inside `for`/`forEach` returned 0 |
| `JSON.parse(JSON.stringify())` deep clones | **None found** | 0 occurrences |
| `brokerUser.findMany` | **Bounded** | Org-scoped `where` + narrow `select`; not exposed to unbounded tables |
| Hero image loading strategy | **By design** | `eager` + `fetchpriority` is the intentional LCP optimization from the F-series |
| `/search` trajectory vs budget | **Within budget** | 738.4 KiB vs 780 000 B cap (94.7 %) — unchanged since audit |

### 4.3 Watchlist (speculation — no action taken)

- **W1 — total emitted chunk JS grew 1608.2 → 1913.0 KiB (+304.8 KiB, +19 %) since the audit, while every *first-load* metric is byte-identical.** Theory: the F1 dynamic-split emits additional lazy chunks that the runtime never requests on first load (which is precisely what the first-load metrics confirm). The budget ceiling (2212 KiB total-JS guard) remains green, but the margin shrank 27.3 % → 13.5 %. **Decision: do NOT blindly revert F1** — first-load improved and stayed stable; splitting trade-off is logged here instead. Action for the next perf cycle: produce a chunk-inventory diff (per-chunk names/sizes) to attribute the +304.8 KiB precisely before any tune-up.
- **W2 (carried from round-2 report)** — `pnpm lint` intermittent exit-1 with zero output under memory pressure; infrastructure flake, not a product defect.

---

## 5. Gate results (final, post-fix)

| Gate | Result |
|---|---|
| Vitest | **158 files / 1721 tests passed** (+1 file, +2 tests from the new guard) |
| `pnpm check` (tsc) | clean |
| `pnpm lint` | exit 0 |
| `ops/scripts/performance/budget.mjs` | PASS |
| `ops/scripts/performance/shell-report.mjs` | matches audit baselines |

## 6. Patterns for the next hunt (ARCH-16 addendum)

1. **Strip comments before tag/regex sweeps** — 3 of 4 `<img>` candidates this round were comment text. Direct-read every flagged line before counting a defect (the one full-tag read this round showed the attributes were actually present).
2. **Server-only modules need source-level guards** — `import "server-only"` blocks behavioural tests under plain vitest; fs-regex contract guards (see `env-docs-parity.test.ts`, `server-query-caps.test.ts`) are the repo's working pattern.
3. **Validate the guard itself failing-first** — both authoring bugs in the new guard were caught by watching it fail before it passed.
4. **Total-JS vs first-load divergence is a watchlist item, not an automatic regression** — lazy-split chunks inflate total emitted size while improving first load; require per-chunk attribution before reverting a split.
5. **Small-data safety ≠ correctness** — all three unbounded queries were harmless at fixture scale; cap-at-source is the durable fix for admin/console reads.

---

*Protocol: ARCH-16, `docs/ai/ai-prompt-library.md`. Sweep discipline adapted from `docs/ai/bug-hunting-prompt-architech.md` (PR #61).*
