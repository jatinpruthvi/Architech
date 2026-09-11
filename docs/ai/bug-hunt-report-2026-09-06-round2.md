# Bug-Hunt Report — 6 Sep 2026 (Round 2)

**Protocol:** `docs/ai/bug-hunting-prompt-architech.md` (executed via ARCH-15 in `docs/ai/ai-prompt-library.md`)
**Branch:** `arena/01a0756c-architech` · **Base:** `5d88ac9` (includes `origin/main` b08c481 / PR #61)
**Environment:** agent sandbox, Node 22.22.3, pnpm 10.4.1, no live database (Prisma validated statically, per protocol constraint)
**Note on filename:** PR #61's round-1 hunt already owns `bug-hunt-report-2026-09-06.md`; this is the same-day follow-up round, kept separate to preserve both audit trails.

## Executive summary

- **Confirmed bugs found: 1 (P3). Fixed: 1.** Failing test written first, minimal fix, full gates green.
- **Suite baseline re-verified:** 1717 → 1719 tests passing (157 files), 0 failures; `tsc` clean; ESLint clean (see Watchlist W1 for one flaky run); `prisma validate` clean; `env:audit` clean.
- **Top risks cleared by evidence (no bug):** JSON-LD injection path, raw-SQL usage, unguarded JSON bodies, invented-coverage metadata ("12 metros"), fire-and-forget async in handlers, hardcoded listing facts in components, stale/example env drift in other NEXT_PUBLIC vars.
- **Recommended next actions:** adopt the new env-parity guard into the `env:audit` summary output (W2); monitor lint flakiness under memory pressure (W1).

## Findings (verifiable only — file + line + reproduction)

| BUG-ID | Severity | Category | Status |
|---|---|---|---|
| BUG-R2-001 | P3 | Config/docs contract | **Fixed** |

### BUG-R2-001 — `NEXT_PUBLIC_MAPLIBRE_VENDOR_PATH` used in code but undocumented

- **Files:** introduced by the F4 performance fix (`next.config.ts` `env` injection; consumed in `src/components/architech/MapListSync.tsx`). Missing from `.env.example` and `docs/runtime-activation-gates.md`.
- **Evidence / reproduction:** `grep -rhoE "NEXT_PUBLIC_[A-Z_]+" src app next.config.ts | sort -u` minus tokens in `.env.example` → exactly `NEXT_PUBLIC_MAPLIBRE_VENDOR_PATH`. New guard test failed pre-fix: `pnpm vitest run src/lib/env-docs-parity.test.ts` → 1 failed (undocumented-var direction).
- **Root cause:** the F4 change added a build-time-injected public env var without updating the operator-facing env inventory, breaking the repo's documented-env contract.
- **Impact:** operators read `.env.example`/gates as the source of truth for public vars; an undocumented auto-injected var also makes debugging vendor-URL issues harder. Classification P3 (ops/config/docs; no runtime failure).
- **Fix (failing test first, minimal):**
  1. Guard added (both directions): `src/lib/env-docs-parity.test.ts` — every `NEXT_PUBLIC_*` referenced in `app/`, `src/`, `next.config.ts` must be documented in `.env.example`, and every documented token must be referenced (no stale rows).
  2. `.env.example` — token documented as **auto-injected, do-not-set**.
  3. `docs/runtime-activation-gates.md` — row added noting auto-injection at build (config `env` wins over any shell value).
- **Verification:** guard test 2/2 green post-fix; full suite 157 files / 1719 tests pass; `pnpm check` clean; `pnpm lint` exit 0.
- **Audit trail:** fix + test + docs in one commit referencing this BUG-ID (see commit history on branch).

## Checks performed — cleared by evidence (no bug)

| Area | Method | Result |
|---|---|---|
| Stored-XSS via JSON-LD | read `serializeJsonLd` | SAFE — escapes `<`, `>`, U+2028/29; documented rationale in-file |
| Raw SQL | grep `$queryRaw`/`$executeRaw(Unsafe)` | Only parameterized `set_config(...)` calls with `$1` placeholders; no string interpolation |
| Unguarded JSON bodies | sample of 27 `request.json()` handlers (e.g. broker lead reply) | Defensive `.catch(() => ({}))` parsing; shape-probe M-3 pattern observed |
| Invented coverage/facts | traced "12 metros" metadata claim → `liveCities` (12 × `status: "live"`) → `getCityStaticParams` | Claim matches shipped product (12 live city hubs + 12 price-index pages) — **not** a bug |
| Hardcoded prices/RERA/city in components | grep `₹`, `Mumbai`, `RERA` in `src/components` | Only scale-labeled budget-presets UI constants; Mumbai occurrences are legitimate live-city coverage |
| Fire-and-forget async | grep `void (` in `app/api` | None |
| Test baseline | `pnpm test` | 156 files / 1717 tests pass (pre-fix baseline) |
| Type/lint/db gates | `pnpm check`, `pnpm lint`, `pnpm db:validate` | All clean |
| Server env leakage | grep `process.env` (non-`NEXT_PUBLIC_`) in client components/contexts/pages | None |

## Watchlist (not confirmed bugs)

| ID | Item | Evidence | Proposed handling |
|---|---|---|---|
| W1 | **Flaky `pnpm lint` under sandbox memory pressure** — one run exited 1 with zero findings output; two identical reruns exited 0 | 3 consecutive runs, same tree | Environmental, not product. Monitor; if it recurs in CI, capture eslint `--debug` output and memory stats |
| W2 | **`env:audit` scope gap** — audits provisioning readiness only; did not detect the BUG-R2-001 doc-parity break | `pnpm env:audit` output ("provisioning_plan_ready...") juxtaposed with the failing parity sweep | Partially closed by the new regression guard (runs in CI via `pnpm test`). Recommend `env:audit` print a pointer to the parity test |

## Phase 7 — patterns & prevention

1. **Pattern: config changes must carry their docs.** Any new `process.env` reference (public or private) belongs in `.env.example` + gates table in the same commit. The new parity guard (`env-docs-parity.test.ts`) now enforces this for `NEXT_PUBLIC_*` in CI.
2. **Process note:** same-day repeated hunts are effective cheap when gates are green — most time went to verification of false-suspicion areas; the "cleared by evidence" table is deliberately preserved so round 3 skips re-proving them.
3. **Monitoring:** none new — the single finding class (env drift) is now test-guarded.

**Verdict:** codebase is in strong health post PR #61; the only confirmed bug was a docs/config parity break introduced by the same-day F4 performance change, now fixed and guarded. No P0/P1/P2 findings; speculative risks isolated to the watchlist per protocol.
