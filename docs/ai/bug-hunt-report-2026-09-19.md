# Architech Bug-Hunt Report — 2026-09-19 (Round 5)

- **Protocol executed:** `docs/ai/bug-hunting-prompt-architech.md` — Phases 1→7 in order, constraints applied verbatim.
- **Branch:** `arena/01a0b817-architech` · **Base:** `5d01979` (merge of PR #131 from `origin/main`).
- **Environment:** Arena sandbox · Node v22.22.3 · pnpm 10.4.1 · Vitest 4.1.11 · Prisma 7.9.1 · **no live database** (per protocol constraint 7; Prisma validated statically through the documented schema-engine shim).
- **Scope of this round:** the surface introduced or last touched by `a898a6e` — the TechnoProperty broker workspace (call queue, saved searches, buyer inventory + matching, motion) — read in full, plus the repository's own regression guards (`bigint-range-guard.test.ts`, `sql-query-bounds.test.ts`) and the ARCH-17 bounds it enforces.
- **Reports are cumulative history:** rounds 1–4 live beside this file. Nothing in this report retro-fixes an earlier round.

---

## 1. Executive summary

| Severity | Found | Fixed |
|---|---|---|
| P0 Critical | 0 | — |
| P1 High | 0 | — |
| P2 Medium | 1 | 1 |
| P3 Low | 0 | — |
| Performance class (PERF) | 1 | 1 |
| Watchlist (not confirmed) | 6 | 0 |

**One confirmed correctness bug and one performance finding, both fixed behind tests written first, with every gate green.**

The correctness bug is a **unit-conversion slip in a stated contract**: the buyer-lead budget ceiling was written as `1_000_000_000` (₹100 crore) while the repository comment, the form's own error copy and the feature's PR description all promise **₹10 crore** (1 crore = 10⁷, i.e. `100_000_000`). The API's payload validator carried the same ten-times-off literal, so the two agreed with each other and disagreed with every statement of intent. The interesting part is *why it survived*: the existing tests probed the far side of the boundary (`2_000_000_000` rejected, `25_000` accepted) and never pinned the stated ceiling, so a 10× error sat in the gap between "clearly too big" and "normal".

The performance finding is a **read-serialisation class**, not a single mistake: three sites awaited queries that do not depend on each other, and one of them re-issued a query the page had just made. Two of the three are server components where the waste is a full extra database round trip on the hottest public page. Everything fixed is a *technical* change — same rows, same order, same caps — and the two candidates that would have changed semantics are recorded as rejected, with the reason, in §5.

| Gate | Baseline (base `5d01979`) | After (`709a036`) |
|---|---|---|
| `pnpm test` | 238 files / **2519** pass, 49 skipped | 241 files / **2532** pass, 49 skipped |
| `pnpm check` (tsc) | clean | clean |
| `pnpm lint` (ESLint) | 0 errors | 0 errors |
| `pnpm verify` (13-gate wrapper) | 13/13 | 13/13 |
| `pnpm test:perf` (build + bundle/HTML budgets) | — | **passed** (total static JS 2290.1 KiB, cap 2293.8 KiB — see W7) |
| CI (`verify` job on PR #132) | — | **pass** — all 34 steps green, including *Production build*, *Performance budget*, *Crawl simulation*, *End-to-end flows*, *Accessibility smoke tests* (run `35426723446`) |

The CI result is the stronger evidence of the two: it is the repo's own harness, on `d1d18fe`, with the database seeded and a real Postgres — i.e. the same pipeline a reviewer would re-run. (GitHub's log-download host is blocked from this sandbox, so the *numbers* below are from the local run of the same gate; the *pass/fail* is CI's.)

---

## 2. Phase 1 — repository assessment (this round's surface)

**Data layer under test:** `src/lib/technoproperty/repository.ts` (1,140 lines) is the whole broker workspace's data access — dashboard KPIs, owner/broker lists, saved searches, buyer leads, match candidates and the calling queue. It is exercised by `src/lib/technoproperty/repository.test.ts` against an in-memory Prisma stand-in that interprets the `where` clauses other tests depend on, which is what made both findings reachable by reading and provable by unit test.

**Regression-guard context that shaped the hunt:** the repo already carries two source-level guards over the data layer — `bigint-range-guard.test.ts` (any real `BigInt(` conversion needs a declared ceiling or a `bigint-range:` marker) and `sql-query-bounds.test.ts` (any `findMany` needs `take:` or an `sql-perf:` marker). Both are *shape* guards: they prove a bound exists, not that the bound is the **right number**. BUG-R5-001 sits exactly in that blind spot, which is the generalisable lesson in §6.

**Auth boundary:** the buyer-lead routes gate on `broker.dashboard.read` and reject a session without an organization (403 `ORGANIZATION_REQUIRED`), then scope every read and write by `orgId` + `brokerUserId` from the session — never from the payload. Re-verified while locating the bug; no privilege defect found and none is claimed here.

---

## 3. Phase 2–3 — confirmed bug

| BUG-ID | Sev | Category | File (pre-fix site) | Component | Status |
|---|---|---|---|---|---|
| **BUG-R5-001** | **P2** | Functional / contract — unit conversion in a stated bound | `src/lib/technoproperty/repository.ts:689-691` + `src/app/api/broker/technoproperty/buyer-leads/route.ts:45` | Buyer inventory (broker workspace) | **Fixed** `318a714` |

---

### BUG-R5-001 — P2 · buyer budget ceiling enforced at ₹100 crore while the product promises ₹10 crore

- **Category:** Functional / data-integrity — a stated range is enforced at ten times its stated size. Not a security defect: the value is bounded and column-safe either way (the `BIGINT` column holds ₹9.2 quintillion).
- **File:** `src/lib/technoproperty/repository.ts`, pre-fix lines 689-691 (`MAX_INR`), and `src/app/api/broker/technoproperty/buyer-leads/route.ts`, pre-fix line 45 (`parseLeadBody`).
- **Current behaviour (pre-fix):**
  ```ts
  /* Largest buyer budget we store: ₹10 crore covers any realistic deal and
     keeps the BigInt well inside PostgreSQL's numeric range. */
  const MAX_INR = 1_000_000_000;

  // …and in the route's payload parser, the same literal:
  if (!Number.isFinite(n) || n <= 0 || n > 1_000_000_000) return { error: "INVALID_BUDGET" };
  ```
  ₹1 crore is 10⁷, so ₹10 crore is `100_000_000`. The enforced bound was ten times the documented one.
- **Expected behaviour:** the bound the product states — **₹10 crore** — on both write paths, with the boundary itself accepted (`100_000_000` stored, `100_000_001` rejected as `INVALID_BUDGET`).
- **Statements of intent the code contradicted (three, independently):**
  | Source | Text |
  |---|---|
  | `repository.ts:689` comment | "Largest buyer budget we store: **₹10 crore** covers any realistic deal" |
  | `BuyerLeadForm.tsx:38` (user-facing) | "Budget must be a positive amount (max **₹10 crore**)." |
  | PR #131 description (the commit that shipped it) | "budget bounded to **(0, 10cr]** before BigInt" |
- **Root cause:** the ceiling was written directly in the money unit it was meant to express (`10 crore` → `10 * 1_000_000_000`?) without going through the conversion `1 crore = 10_000_000`. Both enforcement points were derived from that one mis-converted literal, so the route and the repository agreed with each other — two copies of the same error cannot detect each other. This is the same *class* as round 4's convert-before-validate findings (BUG-R4-005/006): a number that is arithmetically valid and semantically wrong.
- **Reachability (verified):** `POST /api/broker/technoproperty/buyer-leads` and `PUT /api/broker/technoproperty/buyer-leads/[id]` are the only writers; both accept `budgetValue` from the request body and pass the bound. A budget of ₹11–100 crore was therefore storable through the API — and through the UI only by hand-crafting the request, since the form's own copy says ₹10 crore. The stored value then feeds `buyer-matching.ts`'s budget scoring, so the oversized budget makes every listing look affordable (all `price <= budget` → full 35 points).
- **Impact:** a broker can persist a buyer requirement the product says cannot exist; the match list then ranks listings the buyer never asked for as "within budget". Data-quality defect with a wrong-output consequence, no data loss.
- **Why the suite missed it:** `repository.test.ts` pinned only the far outliers — `budgetValue: 2_000_000_000` (rejected) and `25_000` (accepted). Any bound between them passed. The route's payload parser had **no test file at all** (`src/app` carried only four `route.test.ts` files, none for buyer-leads).
- **Reproduction (exact, on the base commit):**
  ```bash
  git checkout 5d01979                        # base of this branch
  # add the two tests from 318a714 (they are the red state):
  npx vitest run src/lib/technoproperty/repository.test.ts \
                 src/app/api/broker/technoproperty/buyer-leads/route.test.ts
  # FAIL src/lib/technoproperty/repository.test.ts
  #   BUG-R5-001: rejects a budget past the documented ₹10 crore ceiling
  #   → AssertionError: expected resolved value "bl-1" (the row was created)
  # FAIL src/app/api/broker/technoproperty/buyer-leads/route.test.ts
  #   BUG-R5-001: rejects a budget past the documented ₹10 crore ceiling
  #   → expected { budgetValue: 100000001, … } to deeply equal { error: "INVALID_BUDGET" }
  # Test Files 2 failed | Tests 2 failed | 25 passed
  ```
- **Fix (minimal):** one constant corrected to `100_000_000` (comment now spells out the arithmetic and names the BUG-ID), the route literal corrected to the same bound with a comment linking the two so they cannot drift silently again. No behaviour beyond the stated ceiling changes; `100_000_000` was and remains accepted.
- **Audit trail:** commit `318a714`. Failing tests: `repository.test.ts` → *"BUG-R5-001: rejects a budget past the documented ₹10 crore ceiling"* and *"BUG-R5-001: accepts the exact ₹10 crore ceiling"*; new `src/app/api/broker/technoproperty/buyer-leads/route.test.ts` → the same boundary through `parseLeadBody`. **2 red → 2 green**, with the boundary pinned on both sides.

---

## 4. Phase 2–3 — performance finding

| PERF-ID | Class | Sites (pre-fix) | Component | Status |
|---|---|---|---|---|
| **PERF-R5-001** | Independent reads serialised; one read duplicated | `src/app/page.tsx` · `src/app/buy/[city]/[locality]/page.tsx` · `src/lib/technoproperty/repository.ts` (`getCallingQueue`) | Home page · locality SEO pages · call queue | **Fixed** `709a036` |

### PERF-R5-001 — P2-class · three sites awaiting queries that do not depend on each other

- **Method (Phase 2 sweep):** a source scan for two `= await` assignments at the same indentation with no `Promise.all`/`$transaction` between them, over `src/lib` + `src/app`. It returned 131 candidates; after removing `await params()` (Next.js route plumbing), dependency-ordered reads (ownership check → plan lookup, listing id → media count, create → re-read) and transactional write paths, three sites remained where the reads are genuinely independent. Each `findMany`/`count` below is a separate database round trip.
- **Site 1 — home page (`src/app/page.tsx`), the largest win.** Three sequential reads:
  ```ts
  const allListings = await getListingsForServer({});
  const showcaseListings = await getListingsForServer({ citySlugs: showcaseCities, limit: 300 });
  // …and, inside the JSX:
  featured={await getFeaturedListingsForServer(6)}
  ```
  `getFeaturedListingsForServer(6)` calls `getListingsForServer({ citySlug: undefined })` — **byte-for-byte the same query as the first read** (same `where`, same `MAX_UNSCOPED_LISTING_ROWS = 5000` ceiling, same `orderBy`), issued only to pick six rows the page already held. Being in the JSX prop list, it also ran after both other reads had settled.
- **Site 2 — locality pages (`src/app/buy/[city]/[locality]/page.tsx`).** The locality read and the city read were awaited one after the other. They are independent queries: the locality read is a narrower `WHERE` over the same table, **not a subset of the city result** — the city read is row-capped at 5,000, so deriving one from the other would silently drop listings on a large city. Only the round trip was shared.
- **Site 3 — call queue (`getCallingQueue`, `src/lib/technoproperty/repository.ts`).** The 2-day freshness window read was awaited before the broker's follow-up log read, although neither depends on the other. The aged-listing pull *does* depend on the follow-up ids and stays sequenced.
- **Impact:** on the hottest public page, three serial `include`-heavy inventory reads become two concurrent ones — one duplicate query removed outright plus one round trip overlapped. Every locality page and every call-queue load saves one round trip. No output changes: same rows, same order, same caps, same payloads.
- **Red → green evidence (measured, not asserted):** the call-queue fix carries a probe test. The mock records `start:`/`end:` for every queue read and can delay each one; the pre-fix run left this log —
  ```
  start:property:window, end:property:window, start:contact:followups, end:contact:followups,
  start:property:aged,    end:property:aged
  ```
  — i.e. the follow-up read waited for the window read (index 2 vs 1 → assertion failed). Post-fix the log interleaves (`start:window, start:followups, end:window, end:followups, …`) and the test passes. A second test pins the *opposite* direction — the aged pull must still start only after the follow-up ids resolve — so a future edit cannot over-parallelise a dependent read.
- **Honest limit of the evidence:** there is no live Postgres in this sandbox, so the gain is proven as *round trips eliminated/overlapped* (deterministic, tested) rather than as measured wall-clock milliseconds. What the harness *does* prove on this commit, run to completion:
  - `pnpm test:perf` (production build + the repo's bundle/HTML budget gate) — **passed**; the four HTML pages touched by this change are inside their caps (`/` 117.3 KiB of 125 KiB, `/buy/ahmedabad/paldi/` 100.9 KiB) and total static JS is 2290.1 KiB against a 2293.8 KiB cap.
  - CI on `d1d18fe` — *Production build*, *Performance budget*, *No-JavaScript SEO smoke tests*, *Crawl simulation*, *End-to-end flows*, *Accessibility smoke tests* and *Visual & Devanagari layout smoke* all green.
  - The server-side change adds **zero client bytes** as measured, not as assumed: `orderFeaturedFirst` (the only new module) appears in **no** `.next/static/chunks/**` file, while a control string from a genuinely client-side module (`waMeLink`) resolves in three. The helper is therefore unreachable from every client entry point — consistent with it being imported only by server components and the server adapters.
  - The two server pages have no render harness here, so their concurrency is pinned by a source-level guard (`server-page-read-parallel.test.ts`) rather than by a rendered assertion.
- **Fix (technical only):** `Promise.all` at all three sites; the home page derives its featured strip from the pool in hand via a new pure helper. The featured-first ordering rule — previously **three copies** (fixture adapter, Prisma adapter, home page) — now lives once in `orderFeaturedFirst` (`src/lib/repositories/featured-order.ts`), with parity tests asserting all three callers still produce the identical order.
- **Audit trail:** commit `709a036`. Tests: `repository.test.ts` → *"PERF-R5-001: the queue's independent reads overlap"* and *"…still sequences the aged-listing pull after the follow-up ids arrive"*; new `featured-order.test.ts` (5 tests: the rule, purity, fixture/Prisma parity, and "derives exactly what the removed duplicate read returned"); new `server-page-read-parallel.test.ts` (4 source-guard tests). **2 red → 2 green** on the queue probe; the parity and guard tests were green by construction and exist to stop the win from silently regressing.

---

## 5. Watchlist (speculation and deliberate non-fixes — NO fix applied)

| ID | Item | Evidence | Proposed handling |
|---|---|---|---|
| **W1** | **Per-search `count()` N+1 in `listSavedSearches`.** A broker with 20 saved searches costs 1 list read + 20 `count` queries on every My Activities load (the counts are `Promise.all`-ed, so they overlap, but they are still 21 statements). | `repository.ts:577-599`, cap `SAVED_SEARCH_PAGE_CAP = 20` | Real, bounded, and needs a `groupBy`/single-query rewrite whose predicate shapes differ per search (category/search/premium/rented). **Skipped this round as more complex than the win** — the cap holds the cost at 21 statements. |
| **W2** | **"Derive locality listings from the city read."** Tempting — one query instead of two — and wrong: the city read is capped at `MAX_UNSCOPED_LISTING_ROWS = 5000`, so on any city larger than the cap the locality rows would silently vanish. | `prisma.ts:132,178-215` | **Rejected.** Documented in-code at the call site so the next reader does not "optimise" it. |
| **W3** | **Lead-reveal guards serialised.** `assertLeadBelongsToOrg` → `resolvePlanStatusForOrg` are independent reads on `POST /api/broker/leads/[id]/reveal` (two call sites). | `src/lib/leads/calling-server.ts:61,110` | Latency win is real but small and the path is security-shaped: parallelising runs the plan lookup for leads the caller does not own, and any error-ordering change here needs its own round of reasoning. **Skipped as more complex than the win.** |
| **W4** | **`channel-store.ts` write paths** await their reads sequentially throughout (`createRequest`, `closeRequest`, deal transitions). | `src/lib/persistence/channel-store.ts:325-403, 562-641` | These are transaction-ordered writes where the second statement legitimately depends on the first. **Not a defect; explicitly out of scope.** |
| **W5** | **Dashboard KPI redundancy.** `getDashboardKpis` issues 8 queries; `todayOwner`/`ydayOwner` are sums of the two `groupBy` results it already fetches, so two counts are derivable. | `repository.ts:63-160` | Would need the test mocks to encode derived values, re-pinning KPI tests on a different data path for a 2-statement saving on a cached dashboard. **Skipped — churn exceeds the win.** |
| **W6** | **`onListingPublished` reads are independent** (`getListingByIdForServer` then `savedSearch.findMany`). | `src/lib/saved-search/alerts-runtime.ts:78-95` | Background notification path with no user-facing latency; the surrounding scan is already a documented watchlist item (SQL-PERF-17). Leave until that scan is revisited. |
| **W7** | **Total static-JS budget is effectively exhausted: 2290.1 KiB measured against a 2293.8 KiB cap — 3.7 KiB (0.16%) of headroom.** The next client-side feature of any size fails `pnpm test:perf` before it can ship. Measured locally on `d1d18fe` with the repo's own gate; the 41.5 KiB growth above the 18 Sep re-baseline reading (2248.6 KiB) predates this branch, whose commits are server-only, test-only and docs (`orderFeaturedFirst` appears in no client chunk — §4). | `ops/config/performance/budgets.json` description; `.next/static/chunks` (79 chunks, 2290.1 KiB total; largest 229.2 KiB) | **Deliberately not touched.** `budgets.json` states the ratchet rule explicitly: the cap "moves only with a measured before/after in the why", so re-baselining is an owner decision with a recorded justification, not a drive-by edit — and certainly not one to make *in the same commit as an unrelated fix*. Recommended handling for the owner: either (a) re-baseline with a measured before/after on the next feature that needs room, or (b) commission a bundle-attribution pass. A first pass here (top-20 chunk signature scan for a duplicated library) found no obvious duplication — react appears in two framework/entry chunks, `lucide-react` in one; the large unnamed chunks are route code, i.e. this is feature weight, not an easy trim. That deeper attribution is exactly the class of work this round was told to skip when complex, so it is recorded rather than attempted. |

---

## 6. Phase 7 — patterns, prevention, monitoring

**1. The dominant pattern this round: a correct *shape* guard over a wrong *number*.** The repo's two data-layer guards (`bigint-range-guard.test.ts`, `sql-query-bounds.test.ts`) both test for the presence of a ceiling, not its value — and the value is exactly what was wrong in BUG-R5-001, in a way three independent prose statements of intent disagreed with. Two preventive moves, cheapest first:

- **Pin the boundary, not the outlier.** Every stated range deserves at least one test at the boundary (`100_000_000` accepted, `100_000_001` rejected) rather than only far outliers (`2_000_000_000` rejected). The existing tests looked thorough and asserted nothing about ₹10 crore.
- **Express money in one unit in code.** A ceiling written as a bare literal in rupees is where a 10× slip lives invisibly. The repo already has `money.ts` and named constants (`MAX_SAFE_INR`, `MAX_STORED_INT`); a shared `CRORE = 10_000_000` (or a `crore(n)` helper) for the *product-stated* bounds would make the arithmetic legible at the definition site — and a source guard could then flag hand-written 10-digit literals beside a comment that says "crore".

**2. The second pattern: independent reads serialised in server components.** Route handlers here are tidy (mostly `Promise.all`), but server pages and one data-layer function were not. Both page-level fixes are of a class no test can easily reach, which is why `server-page-read-parallel.test.ts` exists — it is a deliberately narrow source guard (it asserts the specific pages issue *their* reads inside one `Promise.all`, with a self-check that the scanner finds real blocks, in the style of `sql-query-bounds.test.ts`). **Recommended next step:** generalise that scanner into the sweep used here (two `= await` assignments at the same indentation, no `Promise.all` between) as an optional CI advisory — the 131-candidate output was small enough to review by hand, but it will not stay that way.

**3. Do not undo a cap to save a query.** W2's rejected optimisation is the one that *looks* best: one query instead of two. The cap that makes the search path bounded is precisely what makes the derivation lossy. The in-code comment now says so at the call site; this is the same reasoning that produced `MAX_UNSCOPED_LISTING_ROWS` in the first place.

**Monitoring:** the call queue's read overlap is now pinned by a test rather than a metric, so no new Sentry signal is warranted. If a real deployment later wants the page-level numbers, the existing RUM reporter (`WebVitalsReporter`) already covers the home page, and the locality pages are covered by the sitemap/crawl checks — the natural place to watch for a regression is the prerender/crawl timing, not a new counter.

**The one number worth watching is the budget itself (W7).** At 0.16% headroom, `pnpm test:perf` will stop being a *regression* gate and start being a *feature* gate: it will fail on the next legitimate client-side addition. That is a useful failure, but only if the owner has decided in advance whether the answer is "trim" or "re-baseline with a measured why" — deciding it in the moment, under a red CI, is how a budget becomes a formality.

---

## 7. Audit trail

| ID | Failing test(s) written first | Red evidence | Fix commit | Green |
|---|---|---|---|---|
| BUG-R5-001 | `repository.test.ts` — *"BUG-R5-001: rejects a budget past the documented ₹10 crore ceiling"*, *"…accepts the exact ₹10 crore ceiling"*; **new** `buyer-leads/route.test.ts` — the same boundary via `parseLeadBody` | **2 failed**: `expected resolved value "bl-1"` (row created) and `expected { budgetValue: 100000001, … } to deeply equal { error: "INVALID_BUDGET" }` | `318a714` | 2 green |
| PERF-R5-001 | `repository.test.ts` — *"PERF-R5-001: the queue's independent reads overlap"* (probe: `start:`/`end:` log + delay), plus the no-regression pin *"…still sequences the aged-listing pull after the follow-up ids arrive"*; **new** `featured-order.test.ts` (5); **new** `server-page-read-parallel.test.ts` (4) | **1 failed**: `the follow-up read waited for the window read (serially): start:property:window,end:property:window,start:contact:followups,…` | `709a036` | 1 + 11 green (10 green by construction as parity/guard pins) |

Both commits are on `arena/01a0b817-architech` and in **PR #132**, whose `verify` CI job passed (run `35425225705`). Every commit message names its ID, and both guard tests are named after theirs, so `grep -rn "BUG-R5-001\|PERF-R5-001" src` enumerates the regression surface.
