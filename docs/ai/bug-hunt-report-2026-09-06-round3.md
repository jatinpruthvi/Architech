# Bug-Hunt Report (Round 3) — 2026-09-06

- **Date:** 2026-09-06 (round 3; rounds 1–2: `bug-hunt-report-2026-09-06.md`, `bug-hunt-report-2026-09-06-round2.md`)
- **Source prompt:** ARCH-15 → `docs/ai/bug-hunting-prompt-architech.md` (Phases 1–7 executed in order)
- **Session/branch:** `arena/01a0756c-architech` (PR #62), tip at hunt start `16288c1`
- **Baseline before any fix:** Vitest **159 files / 1723 tests** PASS, `pnpm check` clean, `pnpm lint` exit 0 — zero pre-existing gate failures. (`pnpm db:validate` remains egress-blocked in this sandbox — infrastructure, documented in the round-2 and SQL-hunt reports; no schema/query change shipped this round, so the gate is not required here.)

---

## Executive summary

| BUG-ID | Severity | Category | File | Status |
|---|---|---|---|---|
| **BUG-R3-001** | P2 | Edge case / input validation (crash on write path) | `src/lib/broker/channel.ts` (+ prisma twin `src/lib/persistence/channel-store.ts`) | **FIXED + failing-test-first guard** |

**Total: 1 confirmed bug, 1 fix shipped, 5 areas cleared by evidence (§4), 3 watchlist items (§5).**
Top risk before the fix: any broker-channel create request with a malformed `expiresAt` produced an **unhandled 500** on a business-critical write path — in *both* storage modes (memory threw `RangeError: Invalid time value` from `.toISOString()`; Prisma mode threw on the DateTime write). Verified end-to-end by a test that reproduced the exact thrown error message before the fix existed.

## Top findings & fixes applied

### BUG-R3-001 (P2, FIXED) — unvalidated `expiresAt` crashes channel request creation

- **Reproduction (exact):** `createChannelRequest({ ...validDemand, expiresAt: "not-a-date" }, org)` → **throws `RangeError: Invalid time value`** (proven by the failing test's error output). Prisma path: `normalizeInput` builds `new Date(input.expiresAt)` → Invalid Date → `channelRequest.create` throws a DateTime validation error → 500. The route (`app/api/broker/channel/requests/route.ts`) parses JSON safely BUT delegates payload validation downstream — the crash happens after.
- **Root cause:** conversion-before-validation seam. `validateChannelRequest` (the single seam both storage modes run through) checked type/city/intent/propertyType/budgets/bhk/area but never `expiresAt`; conversion (`new Date`) happened downstream in each mode. The analogous split-amount crash had already been fixed at its seam (in-code comment at channel-store.ts:646) — this create path pre-dated that lesson.
- **Fix (minimal, at the shared seam):** `validateChannelRequest` now rejects unparseable `expiresAt` values with `expiresAt must be a valid date/time value.` → both modes return **400**; empty/absent values still fall back to the +30-day default; well-formed values unchanged (guarded by the second new test).
- **Guard:** 2 new tests in `src/lib/broker/channel.test.ts` — (1) garbage `expiresAt` must not throw and must return 400 with the field named; (2) well-formed ISO date still accepted. Test (1) failed first with the exact `RangeError` above (red→green evidence).
- **Audit trail:** commit on this branch references BUG-R3-001; failing test = `BUG-R3-001: channel request expiresAt validation` describe block.

## Cleared by evidence (no defect)

| Area swept | Evidence |
|---|---|
| `dangerouslySetInnerHTML` (24 route sites) | Every single one renders via the XSS-safe `serializeJsonLd(...)` (round-2 verified serializer); zero raw-bypass usages in the census |
| Route-handler JSON bodies | `login`/`register` wrap `request.json()` in try/catch → 400 `INVALID_BODY`; `channel/requests` POST identical; remaining handlers use `.catch(() => ({}))`; `ai/moderation-assist` null-guards |
| Money/BigInt conversion ordering | `BigInt(Math.round(Number(...)))` in `normalizeInput` is reachable **only after** `validateChannelRequest` (channel-store.ts:432 → :439) — its `toNumberOrNull` (`Number.isFinite`) rejects NaN/Infinity/non-numeric as 400 first |
| Floating-promise census | coverage.ts hits are `Promise.all([...])` array elements — the array itself is awaited; no un-awaited query calls found |
| Domain-value sweep | "Mumbai" appears only as historical context, registry fixture entries, and the round-2-verified 12-metros copy; ₹/lakh/crore literals are display formatters (`cost/ownership.ts`) and a query tokenizer (`ai/search-assist.ts`) — no invented listing/price/RERA data |

## Watchlist (speculation — NOT bugs)

- **W1:** Channel DEMAND budgets / SUPPLY prices are not checked **non-negative** — consistently in both modes (no divergence), so this is a product-validation gap to decide, not a crash bug. Proposed rule: `budgetMin/Max > 0`, `priceInr > 0` in `validateChannelRequest`.
- **W2:** `pnpm db:validate` blocked by sandbox egress (engine re-download, TLS-blocked after node_modules wipe). Infra; blocked ≠ broken; last green at `686e4fc`.
- **W3:** `pnpm lint` intermittent exit-1-with-no-output flake under memory pressure (carried from round 2; this round lint exited 0 twice).

## Phase 7 — patterns & preventive measures

1. **"Validate before you convert" seam rule:** every raw→typed conversion (`new Date`, `BigInt`, `parseInt`) on request input must sit *downstream of a validator* — inventory shows exactly two crash sites of this class ever (split amounts — previously fixed; expiresAt — this round) and both lived where conversion preceded validation. Cheapest prevention: a shared `parseDateInput`/`inrToBigInt`-style guarded helper (money.ts already models the pattern with `inrToBigInt` + `MoneyPrecisionError`).
2. **Type-safety gap to note:** `ChannelRequestInput` is a compile-time cast over `await request.json()` — runtime shape is whatever the client sent. The validator is the real contract; keep it exhaustive (W1 shows the residue).
3. **Test architecture credit:** the pure in-memory `channel.ts` module made this crash reproducible in a 2-ms unit test with the exact production error — continue the mirror-store pattern.
4. **Process:** third consecutive round where failing-test-first reproduced the exact predicted failure mode (`RangeError: Invalid time value` verbatim); the discipline costs minutes and makes reports independently re-verifiable.

## Final gates (post-fix)

| Gate | Result |
|---|---|
| `pnpm test` | **159 files / 1725 tests** PASS (+2 guard tests) |
| `pnpm check` | clean |
| `pnpm lint` | exit 0 |
| Persistence suite (prisma twin paths) | 26/26 PASS — validator change broke nothing |
