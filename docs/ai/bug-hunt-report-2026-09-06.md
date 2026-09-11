# Architech Bug-Hunt Report — 2026-09-06

**Prompt used:** `docs/ai/bug-hunting-prompt-architech.md` (Option A — "Comprehensive Repository Analysis and Bug Fixing Framework", prompts.chat, adapted for this repo).
**Base:** merge of `origin/main` (78d3041, incl. PR #60 / P1.4–P1.7) into `arena/01a0755c-architech`.
**Method:** Phase 1 structural map → Phase 2 static sweeps + targeted code review (grep patterns, raw-SQL audit, XSS surface, auth/payment paths, review of every new file in the merged PR) → Phase 3 prioritization → Phase 4 TDD fixes → Phase 5 validation.

## Executive summary

| Severity | Found | Fixed |
|---|---|---|
| P0 Critical | 0 | — |
| P1 High | 1 | 1 |
| P2 Medium | 1 | 1 |
| P3 Low | 1 | 1 |
| Watchlist (not confirmed) | 3 | 0 |

- **1595 → 1717 tests** all green (incl. 9 new regression tests from this hunt), tsc clean, ESLint clean.
- All 3 confirmed bugs are now fixed (BUG-2026-001 commit `c231ae4`, BUG-2026-002 commit `98e4863`, BUG-2026-003 in this report's follow-up commit).
- The codebase is in good shape: no SQL injection found, JSON-LD XSS already guarded, cron auth fails closed, no empty catches, no TODO/FIXME debt. Both confirmed bugs were **cross-path inconsistencies** — the same operation behaving differently on the in-memory demo path vs the live Prisma path.

---

## Confirmed bugs

### BUG-2026-001 — P1 · Critical (financial data integrity) — FIXED

- **Category:** Functional bug — validation inconsistency
- **File(s):** `src/lib/persistence/channel-store.ts` (`saveChannelDealSplitForServer`, lines ~629-631)
- **Current behavior:** The Prisma persistence path validated commission splits with the local `toNumber` (accepts negatives and fractions), while the in-memory path (`saveChannelDealSplit` in `src/lib/broker/channel.ts`) uses `toNumberOrNull` (rejects negatives, rounds to whole rupees).
  - `demandShare + supplyShare !== total` passes with **negative** amounts (e.g. total −100, demand −150, supply 50) → negative commission entries get persisted into `CommissionEntry` / deal records.
  - **Fractional** input (e.g. 100.5) passes the sum check, then `BigInt(100.5)` throws `RangeError` → unhandled **500** instead of a 400.
- **Expected behavior:** Both persistence backends share one set of amount semantics: whole rupees, non-negative; invalid input is a 400.
- **Root cause:** the Prisma twin of the split function was written against a different (looser) helper instead of reusing the shared validation.
- **Impact:** broker-channel commission records (money) could be corrupted or the API 500s on legitimate decimal input; the demo mode masked it because the in-memory path validates correctly.
- **Reproduction:** `POST /api/broker/channel/deals/:id/split` with `{"totalCommissionInr": 100.5, "demandBrokerShareInr": 50.25, "supplyBrokerShareInr": 50.25}` → 500; with `{"totalCommissionInr": -100, ...}` → accepted (negative commission).
- **Fix (commit `c231ae4`):** export `toNumberOrNull` from `lib/broker/channel.ts` and use it in the Prisma split path — one helper, both backends.
- **Test:** `src/lib/persistence/channel-store.test.ts` (5 tests; 4 red before the fix, all green after).

### BUG-2026-002 — P2 · High (ops observability / cost control) — FIXED

- **Category:** Functional bug — incorrect reporting
- **File(s):** `src/lib/saved-search/alerts-runtime.ts` (`flushSavedSearchAlertDigestForServer`, `remaining` computation)
- **Current behavior:** The daily digest flush reads the PENDING backlog with `take: 500`, then reports `remaining = rows.length - rowsDelivered`. When the backlog exceeds 500, the unread remainder is invisible: a run over a 1200-row backlog can report **`remaining: 0`** while ~700 rows are still owed. The P1.6 cost-control feature's own backlog telemetry lies precisely under load — the exact condition (bursty publish run) that motivated the digest mode.
- **Expected behavior:** `remaining` reflects the true PENDING count after the run.
- **Root cause:** `rows.length` is the read window, not the backlog.
- **Impact:** operators/cron monitoring cannot see unprocessed alert debt; watchers silently wait longer than the system reports.
- **Reproduction:** unit-level: mock `findMany` → 500 rows, `count` → 1200; pre-fix result was `remaining: 490/500` (window arithmetic) instead of the true `1190/1200`.
- **Fix (this session):** `remaining = await outbox.count({ where: { status: "PENDING" } })` after the delivery loop.
- **Test:** `src/lib/saved-search/alerts-runtime.test.ts` (3 tests; 2 red before the fix, all green after).

### BUG-2026-003 — P3 · Low (robustness) — FIXED

- **Category:** Edge case
- **File(s):** 21 route files under `app/api/` (24 call sites: `app/api/broker/channel/*`, `app/api/broker/leads/[id]/*`, `app/api/broker/listings/[draftId]/media`, `app/api/admin/media/[uploadId]/takedown`, `app/api/admin/rera/[registration]/refresh`, `app/api/cities/[slug]/market-trends`, `app/api/localities/[slug]/price-trends`, `app/api/listings/[id]/stats`, `app/api/saved-searches/[id]`)
- **Bug:** params are already decoded by Next.js exactly once, but the handlers called `decodeURIComponent` a second time. A path whose decoded param contains a literal `%` (raw path e.g. `/api/cities/100%25/market-trends` → param `100%`) threw `URIError` → unhandled 500. Secondary effect: ids containing a `%` sequence were silently re-decoded to a different value before lookup.
- **Fix:** removed the redundant `decodeURIComponent` at all 24 call sites (params used as-is); inlined the now-dead `decoded` aliases in the two slug routes; added a regression-prevention comment at `app/api/listings/[id]/stats/route.ts`.
- **Verified safe to remove:** client call sites single-encode with `encodeURIComponent` (e.g. `BrokerChannelPanel.tsx`), ids are cuids / lowercase slugs / RERA numbers — no caller double-encodes, so single-decode semantics are preserved for every real request.
- **Test (TDD):** `src/lib/api-contract.test.ts` — "route params are not double-decoded" drives three real route handlers (`market-trends`, `price-trends`, `listings/:id/stats`) with param `100%`: red (URIError) before the fix, green after (404/404/200, never 500).

---

## Watchlist (plausible risks — NOT confirmed bugs, no fix applied)

1. **Per-match alert quota race (P3):** the daily quota in `onListingPublished` is check-then-act (`count` then send, no transaction). Two concurrent publish events can both pass the quota check → the cap can be exceeded by ~N−1 emails per watcher in a burst. Mitigations: count+mark inside `$transaction`, or a per-watcher daily-counter row. Current publish cadence makes this unlikely but not impossible.
2. **RERA refresh batch abort (P3):** `refreshStaleReraRecordsForServer` (P1.7) catches provider errors per row, but a throw from the `upsert`/`auditEvent.create` (e.g. an invalid `retrievedAt` from a malformed snapshot) aborts the whole cron batch; remaining STALE rows wait for the next run. Recommendation: per-row try/catch around the write half.
3. **Coverage copy / Mumbai (P3, policy):** `app/buy/page.tsx:12` ("Architech covers 12 metros … Mumbai, Delhi …") and `src/pages/Home.tsx:48` (same 12-city claim). Per the repo policy in `free-first-design-mcp-workflow.md`, Mumbai is historical context only, and unverified coverage claims violate the "never invent" domain constraint. Product/copy decision — flag to the content owner, do not "fix" by inventing coverage data.

## Audited and found clean

- **Raw SQL** (`channel-store.ts`, `tenant.ts`, `sql-narrow.ts`, new `sql-page.ts`): fully parameterized (`$1…$N`); the only string-interpolated literals in `sql-page.ts` are enum constants from fixed option tables (`BHK_PREDICATES`, `TYPE_BY_SLUG`, `STATUS_BY_ID`, availability alias map) — user values cannot reach the SQL text.
- **`dangerouslySetInnerHTML`** (10 public pages): every usage is JSON-LD embedding via `serializeJsonLd`, which escapes `<`, `>`, U+2028/2029 — stored-XSS via `</script>` already neutralized (with a test).
- **Digest cron** (`/api/internal/scheduled/saved-search-alert-digest`): `CRON_SECRET` bearer compared with `timingSafeEqual`, fails closed (503) when unconfigured, POST-only.
- **Leads API:** JSON-parse guard, `enforceMutationSafety`, validation in `createLeadForServer`.
- **Auth:** Better Auth mounted through the shared server-auth singleton with correct trailing-slash normalization.
- **AI search-assist:** deterministic local parse (no user input into SQL or external prompts).
- **Sweeps:** no empty catches, no TODO/FIXME/HACK markers in `app/` or `src`.

## Phase 7 — continuous improvement

1. **Recurring pattern: dual persistence paths drift.** Both confirmed bugs are the in-memory demo path and the Prisma path disagreeing on validation/reporting. Recommendation: a CI parity test that runs a shared scenario matrix (valid/negative/fractional inputs, backlog > window) against both backends — the mocks in `channel-store.test.ts` and `alerts-runtime.test.ts` are the seed.
2. **CI gate:** `pnpm check && pnpm lint && pnpm test` should be a required check (repo already has the `quality` script — wire it into `.github/workflows`).
3. **Monitoring:** Sentry alerts for (a) `RangeError: * cannot be converted to a BigInt` and (b) `saved_search.alert_suppressed` volume — both are canaries for quota/validation issues at scale.
4. **Coverage gaps:** no runtime tests existed for `alerts-runtime.ts` (new in P1.6) — now added; `rera-store.ts` refresh path still has no tests (provider mock needed).

## Validation record

| Check | Before fixes | After fixes |
|---|---|---|
| `pnpm test` | 1713 passed / 46 skipped / 0 failed (post-merge baseline) | **1716 passed / 46 skipped / 0 failed** |
| `pnpm check` (tsc) | clean | clean |
| `pnpm lint` (ESLint) | clean | clean |
| New tests | — | +5 (channel-store) +3 (alerts-runtime), all red→green per TDD |

UI-impacting verification: none of the fixed code paths change public rendering; no Playwright route checks required. (If the digest flush is run in production during a backlog > 500, compare the cron response's `remaining` against the outbox count to confirm the fix end-to-end.)
