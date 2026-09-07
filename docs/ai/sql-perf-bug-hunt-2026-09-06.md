# SQL Query Perf-Bug-Hunt Report — 2026-09-06

**Date:** 2026-09-06
**Runner:** Arena Agent Mode, executing **ARCH-17** (SQL Query Performance Bug Hunt) from `docs/ai/ai-prompt-library.md`
**Target:** branch `arena/01a0756c-architech` (PR #62), tip at hunt start: `457127e`
**Scope:** the query layer — every Prisma `findMany`/`findFirst`/`count` and `$queryRaw*` call site in non-test code, plus index alignment, N+1 structures, client lifecycle, and transactions.

---

## 1. Executive summary

| Finding | Severity | Class | Status |
|---|---|---|---|
| **SQL-PERF-17-001** | P2 | Boundedness | FIXED — moderation queue was platform-wide, uncapped, and had **no `orderBy` at all** (undefined order). Now FIFO + cap. |
| **SQL-PERF-17-002** | P3 | Boundedness | FIXED — broker drafts list capped. |
| **SQL-PERF-17-003** | P3 | Boundedness (compounding) | FIXED — lead inbox capped; bounds the audit-event history read that fans in behind it. |
| **SQL-PERF-17-004** | P3 | Boundedness (2 sites) | FIXED — channel requests + deals lists capped. |
| **SQL-PERF-17-005** | P3 | Boundedness (whole-table scan) | FIXED — media retention sweep now streams id-cursor batches. |
| **SQL-PERF-17-006** | P4 | Filter pushdown | FIXED — agent directory public-tier filter moved into the query (was: fetch ALL orgs, drop most in JS). |
| — | — | Guard | **`client/src/lib/sql-query-bounds.test.ts`** — global source guard, proven red via mutation probe. |

**6 findings fixed across 11 call sites**, zero migrations shipped (2 index proposals deferred to watchlist — Prisma engine unreachable from this sandbox, and ARCH-17 step 6 forbids unverifiable migrations).

Fixture reality check: every one of these passes the entire 1723-test suite *before* the fix — fixture data is small. A green suite is not evidence of query health.

## 2. Baseline (before any fix)

| Gate | Result |
|---|---|
| `pnpm db:validate` | ⚠ BLOCKED by sandbox egress (Prisma tried to re-download `schema-engine` from binaries.prisma.sh after node_modules wipe; TLS blocked). Last green run: earlier session at `686e4fc`. **Not a repo defect** — see watchlist W4. |
| db-related Vitest suites (search/sql, governance, env-parity) | **19 files / 203 tests PASS** |
| Full suite pre-state | 158 files / 1721 tests PASS |
| Raw-SQL modules (pre-read) | parameterized, LIMIT-capped — cleared |

## 3. Census (the definitive one)

Balanced-brace census of all non-test `.ts`: **33 `findMany` sites**; 15 already bounded by `take:`; **18 without**. Each of the 18 was read in full context: **7 became fixes**, **11 are intentionally unbounded and now carry `sql-perf: intentionally-unbounded` markers** with reasons (team-sized membership reads, ~36-row state tables, governed city/locality registries, caller-bounded `in:` reads, build-time id maps, one product-watchlisted alert scan).

Prior-art proof the repo already knows this discipline: `getListingsForServer` was previously converted to `take: ceiling` with a comment describing exactly the defect class this hunt fixed elsewhere.

## 4. Findings and fixes

### SQL-PERF-17-001 — moderation queue: unbounded + undefined order (P2) — FIXED
`client/src/lib/persistence/broker-store.ts` — `listing.findMany({ where: { lifecycle: "IN_REVIEW" }, include })` fetched **every pending listing platform-wide, with no `take` and no `orderBy`**. Worst finding in the set: unbounded *and* non-deterministic on the largest table.
**Fix:** `orderBy: { updatedAt: "asc" }` (a review queue drains oldest-first) + `take: BROKER_LIST_PAGE_CAP (500)`.

### SQL-PERF-17-002 — broker drafts list unbounded (P3) — FIXED
Same module — `findMany({ where: { brokerOrgId }, orderBy: { updatedAt: "desc" }, include })`: every draft an org ever created, all statuses. **Fix:** `take: BROKER_LIST_PAGE_CAP`.

### SQL-PERF-17-003 — lead inbox + compounding history read (P3) — FIXED
`client/src/lib/leads/server.ts` — `lead.findMany({ where: { deletedAt: null, organizationId }, include: LEAD_LISTING_INCLUDE })` unbounded, *then* `hydrateLeadHistory` issued `auditEvent.findMany({ in: [every lead id] })` over a forever-growing event table on **every inbox render**. **Fix:** `LEAD_INBOX_PAGE_CAP = 500` on the inbox read — the history read inherits the bound (it queries only the capped id set, on index `[entityType, entityId]`). The audit query itself is marked intentionally-unbounded-by-caller (a blind total `take` could starve one lead's trail).

### SQL-PERF-17-004 — channel requests + deals lists unbounded (P3) — FIXED
`client/src/lib/persistence/channel-store.ts` (2 sites) — org-scoped `channelRequest` / `channelDeal` lists, `orderBy updatedAt desc`, no cap; org history grows forever. **Fix:** `BROKER_CHANNEL_LIST_PAGE_CAP = 500` on both.

### SQL-PERF-17-005 — media retention sweep loaded the whole table (P3) — FIXED
`client/src/lib/media/retention-runtime.ts` — `propertyMedia.findMany({ select })` with **no `where`, no `take`**: the entire media table into memory every sweep, growing with every upload forever. **Fix:** streaming id-cursor batches of `MEDIA_RETENTION_SCAN_BATCH = 500` (`orderBy id asc` + `cursor`/`skip:1`). The id cursor is stable under the sweep's own status updates, so batching cannot skip or double-visit a row; peak memory is one batch. Behavior preserved deliberately: memory-store records still receive the prisma-side actions when prisma persistence is on (the id-keyed `updateMany` is an idempotent no-op when the row is absent) — same as the original loop.

### SQL-PERF-17-006 — agent directory: filter pushdown (P4) — FIXED
`client/src/lib/repositories/server/prisma.ts` — `brokerOrganization.findMany` fetched **every organization platform-wide** and dropped non-public tiers in JS on a public request path. **Fix:** `where: { verificationStatus: { in: [...PUBLIC_VERIFICATION_STATUSES] } }` (set now exported from `client/src/lib/agent/directory.ts`); the JS filter stays as a second line of defense. Left uncapped *on purpose* (a directory page renders every public org; pagination is a product decision → marker + watchlist).

## 5. Guard

**`client/src/lib/sql-query-bounds.test.ts`** walks every non-test `.ts` under `client/src`, `app`, `shared`, extracts each `.findMany(` argument list with **balanced-brace matching** (regex proven insufficient — see methodology), and fails unless the call passes `take:` or carries a `sql-perf: intentionally-unbounded` marker within 500 chars. A sanity test fails if the scanner ever sees < 30 call sites (a degenerate scan must not pass vacuously).
**Proven red:** a probe file with an unbounded `findMany` made the guard fail, naming the file and line; removed → green. The class cannot silently return.

## 6. Cleared by evidence

| Area | Evidence |
|---|---|
| Client lifecycle | Singleton via `globalThis.__architechPrisma` (`repositories/server/prisma.ts:57`); zero per-request `new PrismaClient` in non-test code |
| Raw SQL (channel match, `$queryRawUnsafe` ~:495) | Parameterized `$1..$10`, `LIMIT 200`, NULL-tolerant optional filters matching composite indexes `[type,status,cityId,intent,propertyType,…]`, deterministic ORDER BY |
| RLS GUC calls (`set_config`) | Parameterized (channel-store:204/210, tenant:84/108); identifier validated in tenant |
| `sql-narrow.ts` / `sql-page-runtime.ts` search SQL | Plans built parameterized; off-by-default; fails closed + measured; page-window rehydration bounded by already-windowed id lists (marker) |
| ChannelMatch creation loop (:526) | Bounded: candidate pool `LIMIT 200`, loop sliced to `BROKER_CHANNEL_TOP_MATCH_LIMIT = 10`, `findFirst` rides `@@unique([demandRequestId, supplyRequestId])` |
| Commission close loop (:663) | Iterates a fixed 2-element array; per-org `set_config` is required by RLS design — not N+1 |
| RERA refresh (rera-store:92) | Already bounded: `take: limit` default 10 (multi-line census artifact — see methodology) |
| ERPNext cron (:886) | `take: maxOrganizations` + `distinct` + narrow select |
| Index alignment | Schema is deliberately indexed; hot listing reads match `[cityId,lifecycle]`, `[localityId,lifecycle]`, price/bhk indexes; `auditEvent @@index([entityType, entityId])` serves the inbox history read; `BrokerUser [organizationId, active]` serves notifications |

## 7. Watchlist (speculation / deferred — explicit non-actions)

- **W1 (index) — RESOLVED 7 Sep 2026.** The moderation-queue filter `lifecycle = 'IN_REVIEW'` had no leftmost-lifecycle index on `Listing` (all six existing lifecycle indexes carry it as a *trailing* column, so none was usable); the cap bounds memory, not scan cost. Shipped as `@@index([lifecycle, updatedAt])` — `updatedAt` second so the FIFO `orderBy` is served by the same index. The original blocker ("sandbox cannot run `prisma validate`") no longer applies: `pnpm db:validate:offline` validates without egress. Guarded by `client/src/lib/db/index-leftmost-coverage.test.ts`. See `docs/search/query-optimization-audit-2026-09-07.md` §9.
- **W2 (index) — RESOLVED 7 Sep 2026.** `ReraRecord.verificationStatus` only appeared as a 2nd column in both indexes. Shipped as `@@index([verificationStatus, updatedAt])`. The "impact negligible at `take: 10`" assessment still stands — it shipped because it is the identical defect to W1 and cost one statement, not because measurement justified it independently.
- **W3 (product decisions):** directory pagination; publish-gate peer windowing (cap would weaken a correctness gate — marker in place); locality-registry include fan-out if coverage goes nationwide; saved-search alert platform scan (the in-code comment itself predicts this becomes the perf bug).
- **W4 (infra):** `pnpm db:validate` is engine-download-dependent and blocked by sandbox egress after node_modules wipes. CI with warm caches is unaffected; last green locally at `686e4fc`.

## 8. Methodology notes for the next hunt

1. **Single-line grep censuses lie both ways**: multi-line `take:` (RERA) reads as missing; one-level regex nesting missed two-level `include: { city: { select } }` trees (broker-store). Balanced-brace extraction is the only correct census — the guard implements it.
2. **N+1 loop regexes over-report**: both loop candidates were bounded-by-design on inspection. Always read loop bounds before classifying.
3. **Mutation-prove every source guard** (probe file → named failure → removal → green).
4. **Marker convention** turns "reviewed, intentionally unbounded" into enforceable code state instead of report-only prose.
5. **Fixture data hides every finding in this report** — all eleven sites were green-test'd before the fix.
6. Re-provision #4 struck mid-session (local git reset to old base while files persisted); recovered via fetch + reset per ARCH-14 sandbox rules (orphan `39f7567` → recom mitted `457127e`).

## 9. Final gates

| Gate | Result |
|---|---|
| Vitest (full) | **159 files / 1723 tests PASS** (+2 from the guard) |
| `pnpm check` (tsc strict) | clean |
| `pnpm lint` | exit 0 |
| db-adjacent suites (media, repositories, leads, persistence, agent) | 25 files / 197 tests PASS |
| Fix-adjacent behavior | No delivered page behavior change below caps; all caps ≥ 500 rows |

*Protocol: ARCH-17, `docs/ai/ai-prompt-library.md`. Hunt executed 2026-09-06.*
