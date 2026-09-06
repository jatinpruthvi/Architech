# Architech Bug-Hunt Report — 2026-09-06 (Round 4)

- **Protocol executed:** `docs/ai/bug-hunting-prompt-architech.md` — Phases 1→7 in order, constraints applied verbatim.
- **Branch:** `arena/01a0776f-architech` · **Base:** `420b77c` (merge of PR #62 from `origin/main`).
- **Environment:** Arena sandbox · Node v22.22.3 · pnpm 10.4.1 · **no live database** (per protocol constraint 7, Prisma validated statically).
- **Filename note (deviation, deliberate):** the protocol fixes the report path as `docs/ai/bug-hunt-report-2026-09-06.md`. That file is already owned by round 1, and rounds 2–3 established the same-day convention `-round2` / `-round3`. This round follows that convention rather than overwriting an existing audit trail.

---

## 1. Executive summary

| Severity | Found | Fixed |
|---|---|---|
| P0 Critical | 0 | — |
| P1 High | 2 | 2 |
| P2 Medium | 2 | 2 |
| P3 Low | 0 | — |
| Watchlist (not confirmed) | 4 | 0 |

**All 4 confirmed bugs are fixed, each behind a failing test written first.**

The headline finding is a **recurring defect class**: *unbounded in-process state keyed by client-controlled input*. Three of the four bugs (BUG-R4-001/002/003) are the same mistake in three different modules, each with a per-series or per-entry ring buffer that bounded the *contents* of an entry but not the *number* of entries. All three are reachable from unauthenticated public endpoints. The fourth (BUG-R4-004) is a batch-abort defect in a scheduled job that round 1 had recorded as watchlist speculation; it is now confirmed and is worse than round 1 supposed — it permanently wedges, rather than delays.

| Gate | Baseline (base `420b77c`) | After fixes (HEAD `0225e0e`) |
|---|---|---|
| `pnpm test` | 159 files / **1725** pass, 46 skipped | 160 files / **1740** pass, 46 skipped |
| `pnpm check` (tsc) | clean | clean |
| `pnpm lint` (ESLint) | exit 0 | exit 0 |
| `pnpm db:validate` | valid (see §2) | valid |

No P0. No data corruption, no authorisation bypass, no injection found. The codebase is in strong shape; every finding here is a resource-lifecycle or resilience defect, not a correctness-of-business-logic defect.

---

## 2. Phase 1 — repository assessment

**Stack (from `package.json` + `pnpm-workspace.yaml`):** `architech-web` v1.0.0, single-package pnpm workspace (`packages: ["."]`), Next.js ^16.3.2 (App Router) + React 19 + TypeScript 5.6.3, Prisma ^7.9.1 + PostgreSQL, Tailwind 4, Vitest 4, Playwright (a11y/UI/broker), Storybook, Sentry.

**Structure mapped:** `app/` 128 `.ts`/`.tsx` (of which **73** are `app/api/**/route.ts` handlers) · `client/src/` 424 · `scripts/` 41 (own `node --test` suites) · `prisma/` (schema + migrations + seeds) · `shared/` · `tests/` (a11y, e2e, ui).

**Path aliases:** `@/* → client/src/*`, `@shared/* → shared/*` (tsconfig + vitest, kept in sync). Vitest stubs `server-only` so server-mode modules are unit-testable in plain Node.

**Critical paths:** search → listing → detail → booking; broker channel (demand/supply matching → deal → commission split); leads; saved-search alerts; media upload/moderation/retention; RERA verification.

**Auth boundary:** every privileged route funnels through `authorizeRequest(request, { permission })` (`client/src/lib/auth/guards.ts`), which runs `enforceMutationSafety` → session contract → production demo-auth refusal → `requirePermission` → optional organisation-scope check. Census of all **73** route handlers (`find app/api -name route.ts | wc -l`): **43** call `authorizeRequest`, **4** internal scheduled routes use constant-time `CRON_SECRET`, **26** are unguarded (public read/search/observability/auth) — 43+4+26=73, no overlap. **No privileged route was found missing its guard.**

**`pnpm db:validate` — unblocked this round.** Rounds 2 and 3 recorded this gate as blocked by sandbox egress (the Prisma CLI tries to download `schema-engine` from `binaries.prisma.sh`; TLS is blocked). That is true but *not* a dead end: the repo ships `scripts/sandbox/schema-engine-shim.cjs`, whose own header documents that it stands in for the native engine. Installing it at the platform engine path makes the gate run:

```
cp scripts/sandbox/schema-engine-shim.cjs \
   node_modules/.pnpm/@prisma+engines@7.9.1/node_modules/@prisma/engines/schema-engine-debian-openssl-3.0.x
chmod 755 <that path>          # --version → 7.9.0-1.e922089b7d7502aff4249d5da3420f6fa55fc6ad
pnpm db:validate               # → "The schema at prisma/schema.prisma is valid 🚀"
```

`prisma validate` performs static schema validation and never opens a database connection, so this satisfies the "no live DB" constraint without weakening it. **Recommendation:** `scripts/sandbox/setup-local-db.mjs` already installs this shim, but only as part of full local-DB setup; a lighter `db:validate`-only path would stop future hunts from reporting the gate as unrunnable.

---

## 3. Phase 2–3 — confirmed bugs

| BUG-ID | Sev | Category | File (pre-fix site) | Component | Status |
|---|---|---|---|---|---|
| **BUG-R4-001** | **P1** | Security / availability — unbounded memory | `client/src/lib/observability/metrics-store.ts:52-55` | Public RUM ingest | **Fixed** `10b88e8` |
| **BUG-R4-002** | **P1** | Security / availability — unbounded memory | `client/src/lib/auth/request-safety.ts:7,146` | Every mutation route | **Fixed** `9a9f240` + `866698b` |
| **BUG-R4-003** | **P2** | Security / availability — unbounded memory | `client/src/lib/auth/login-throttle.ts:28-29,36` | Credential sign-in | **Fixed** `e75f841` |
| **BUG-R4-004** | **P2** | Functional / resilience — batch abort + head-of-line block | `client/src/lib/persistence/rera-store.ts:116-146` | RERA refresh cron | **Fixed** `0225e0e` |

---

### BUG-R4-001 — P1 · public RUM endpoint mints unbounded in-process series

- **Category:** Critical-class security (resource exhaustion), no authentication required.
- **File:** `client/src/lib/observability/metrics-store.ts`, pre-fix lines 52-55.
- **Current behaviour (pre-fix):**
  ```ts
  export function recordWebVitalSample(name: string, value: number) {
    const seriesId = `web_vital.${name}` as SeriesId;
    if (seriesId.startsWith("web_vital.")) push(seriesId, value);
  }
  ```
  The guard is a **tautology** — `seriesId` was just built as `"web_vital." + name`, so `startsWith("web_vital.")` is true for *every* possible input, including `name = ""` and `name = "\n"`. The `as SeriesId` cast had already defeated the compiler's check; the runtime guard written to compensate did nothing.
- **Expected behaviour:** only the six names in the `SeriesId` union (`web_vital.CLS|FCP|FID|INP|LCP|TTFB`) may create a series.
- **Reachability (verified):** `app/api/observability/web-vitals/route.ts` is **not** behind `authorizeRequest` (confirmed by census). It requires only `body.name` truthy and `typeof body.value === "number"`, then calls `recordWebVitalSample(body.name, body.value)` at line 20. `name` is an arbitrary attacker-chosen string of unbounded cardinality.
- **Root cause:** `push()` does `store.series.get(id) ?? []` then `store.series.set(id, buffer)`. The ring buffer (`MAX_SAMPLES_PER_SERIES = 720`) bounds samples *per series*, so nothing bounds the *number* of series. The defect is invisible to the existing suite: `metrics-store.test.ts` had a test literally named *"ignores unknown metric names gracefully"* that only exercised `NaN` and `-5` **with the name `"LCP"`** — it never passed an unknown name.
- **Impact:** unauthenticated remote memory exhaustion. Worst case is ~720 retained numbers per distinct name (≈5.7 KB), so cardinality of names × 720 samples is the growth curve. Availability of the public site; on a single-replica deploy (`metricsStoreMeta().scope === "process"`) this takes the whole instance.
- **Reproduction (exact):**
  ```bash
  git checkout 420b77c -- client/src/lib/observability/metrics-store.ts
  npx vitest run client/src/lib/observability/metrics-store.test.ts \
                 client/src/lib/observability/observability.test.ts
  # 4 failed | 15 passed
  ```
  The route-level guard shows the defect concretely: after 250 POSTs through the real handler with names `EVIL_0…EVIL_249`, pre-fix `snapshotSeries("web_vital.EVIL_0").sampleSize === 1` (expected `0`); the test failed with `expected 1 to be +0`.
- **Fix (minimal):** replace the tautology with membership in a closed list, so the `SeriesId` union is enforced at runtime and not only at compile time. Also expose `seriesCount` on `metricsStoreMeta()` — it is the other half of the memory bound and the metric that would have caught this.
- **Audit trail:** commit `10b88e8`. Failing tests: `metrics-store.test.ts` → *"BUG-R4-001: does not create a series for an unknown metric name"*, *"…keeps the series count bounded under arbitrary-name abuse"*, *"…still records every real web-vital name"*; `observability.test.ts` → *"BUG-R4-001: the public RUM route cannot mint unbounded series via arbitrary names"*. **4 red → 4 green.**

---

### BUG-R4-002 — P1 · mutation rate-limiter bucket map never pruned

- **Category:** Critical-class security (resource exhaustion) + permanent leak.
- **File:** `client/src/lib/auth/request-safety.ts`, pre-fix lines 7 and 146.
- **Current behaviour (pre-fix):** `const buckets = new Map<string, { startedAt: number; count: number }>()` keyed `${ip}:${route}:${method}`, `buckets.set(...)` on every new key, and **no eviction whatsoever** — the only cleanup in the module was the test-only `clearMutationSafetyBucketsForTests()` at line 155. An expired window was merely overwritten *if the same key reappeared*; keys that never reappeared lived forever.
- **Expected behaviour:** the map is bounded; expired windows are reclaimed.
- **Root cause:** same shape as BUG-R4-001 — a per-entry budget (`MAX_MUTATIONS_PER_WINDOW = 60`) with no bound on entry count.
- **Reachability (verified):** `ip` comes from `clientKey(request)`, which reads `x-real-ip` → `cf-connecting-ip` → `x-forwarded-for` — all **request headers**, therefore attacker-set whenever the app is reachable without a proxy that overwrites them. Every mutation route calls `enforceMutationSafety` (leads, requirements, auth login/register, broker, admin, media), so this is the broadest surface of the three.
- **Measured pre-fix (hard evidence, throwaway probe, since the map had no size accessor):**
  ```
  PROBE distinct-identity requests=200000 heapBeforeMB=13.7 heapAfterMB=80.1 growthMB=66.4
  ```
  200 000 requests rotating `x-real-ip` retained **66.4 MB** of heap that the collector could never reclaim (~332 B/request, linear, permanent). Extrapolated: ~330 MB per million requests.
- **Secondary effect:** rotating the header also hands each fresh identity a clean 60-request allowance, i.e. the limiter is bypassable at the same time as it is being used as the attack vector. (The module's own comment already acknowledges header spoofing defeats bucketing; it does not address unbounded growth.)
- **Impact:** availability; unbounded process-lifetime memory growth on the site's most-called write path.
- **Reproduction (exact):**
  ```bash
  git checkout 420b77c -- client/src/lib/auth/request-safety.ts
  npx vitest run client/src/lib/auth/request-safety.test.ts
  # 2 failed | 11 passed
  ```
- **Fix:** prune expired windows when the map reaches the ceiling, then evict longest-resident windows if still over; `MAX_RATE_LIMIT_BUCKETS = 10_000`. Pruning is lazy and only runs at the ceiling, so steady-state cost stays O(1). Export `mutationSafetyBucketCount()`.
- **Follow-up `866698b` (same BUG-ID):** the first fix evicted by *sorting* all keys on `startedAt`. That sort ran on **every insert once the ceiling was reached** — O(n log n) per request under exactly the sustained spray the bound exists to survive, making the memory guard its own DoS amplifier. Replaced with a walk of the `Map`'s insertion order (O(excess)); the bounded-rotation guard test dropped from ~1990 ms to ~490 ms. Trade-off documented in-code.
- **Audit trail:** commits `9a9f240`, `866698b`. Failing tests in `request-safety.test.ts`: *"BUG-R4-002: the bucket map stays bounded when client identity rotates"*, *"…expired windows are reclaimed instead of retained forever"*. **2 red → green.** A third guard, *"…pruning never weakens the per-client cap"*, passed pre-fix by design (no-regression pin).

---

### BUG-R4-003 — P2 · login throttle bucket maps never pruned

- **Category:** Security / availability — resource exhaustion.
- **File:** `client/src/lib/auth/login-throttle.ts`, pre-fix lines 28-29 (`ipBuckets`, `emailBuckets`) and 36 (`store.set`).
- **Current behaviour (pre-fix):** neither map was ever pruned. `clearLoginAttempts()` fires only on a **successful** sign-in — the one outcome an attacker never produces. `clearLoginThrottleForTests()` is test-only.
- **Reachability (verified):** `app/api/auth/login/route.ts` → `signInWithCredentials` → `credential-flow.ts:133` `registerLoginAttempt({ ip: clientKey(request), email })`. The only thing standing in front of it is `validateSignIn` (`credentials.ts:68`), which checks email *shape* and password presence — so syntactically valid but distinct addresses (`spray0@…`, `spray1@…`, …) are unlimited. The throttle is invoked **before** password verification, by design, so every attempt registers.
- **Aggravating factor:** `LOGIN_WINDOW_MS = 15 * 60_000`. Each entry outlives the mutation limiter's 60-second windows by **15×**.
- **Impact:** unauthenticated memory exhaustion on the endpoint that attracts the most automated traffic on any site. Classified P2 rather than P1 on per-entry cost (same ~330 B as R4-002, vs R4-001's ~5.7 KB worst case) — it is borderline P1 and should be read as such.
- **Reproduction (exact):**
  ```bash
  git checkout 420b77c -- client/src/lib/auth/login-throttle.ts
  npx vitest run client/src/lib/auth/login-throttle.test.ts
  # 3 failed | 7 passed
  ```
- **Fix:** same bounded pattern, `MAX_LOGIN_THROTTLE_BUCKETS = 20_000` per map, insertion-order eviction (no sort — see the `866698b` lesson, applied from the start here). Export `loginThrottleBucketCount()`.
- **Audit trail:** commit `e75f841`. Failing tests in `login-throttle.test.ts`: *"BUG-R4-003: the email bucket map stays bounded under a sprayed address space"*, *"…the ip bucket map stays bounded under rotating addresses"*, *"…expired windows are reclaimed instead of retained forever"*. **3 red → green.** *"…pruning never weakens the per-account or per-address budget"* passed pre-fix (no-regression pin).

---

### BUG-R4-004 — P2 · one failed write permanently wedges the RERA refresh cron

- **Category:** Functional / resilience. Round 1 recorded this as **watchlist item 2** ("a throw from the `upsert`/`auditEvent.create` … aborts the whole cron batch"). It is a confirmed bug, and the consequence is worse than round 1 stated.
- **File:** `client/src/lib/persistence/rera-store.ts`, pre-fix lines 116-146 (`refreshStaleReraRecordsForServer`).
- **Current behaviour (pre-fix):** the `try/catch` wrapped **only** the provider call (`verifyReraRecordForServer`, caught at line 106). The `db.reraRecord.upsert` (116) and `db.auditEvent.create` (143) that follow sat unguarded inside the `for` loop, and `refreshed += 1` at 146.
- **Two distinct consequences:**
  1. **Batch abort.** A throw propagated out of the function. The caller `app/api/internal/scheduled/rera-refresh/route.ts:45` does **not** catch either, so the cron returns an unhandled **500** and every row after the failure is skipped.
  2. **Permanent head-of-line block — the part round 1 missed.** The sweep is
     `findMany({ where: { verificationStatus: "STALE" }, orderBy: { updatedAt: "asc" }, take: limit })`.
     A row whose write throws is **never updated**, so its `updatedAt` never advances, so it stays at the **head of every subsequent run** and throws again. The STALE backlog is not delayed by one cycle — it is wedged indefinitely, and RERA verification status silently stops refreshing platform-wide.
- **Concrete trigger:** `retrievedAt: new Date(result.record.retrievedAt)` on a malformed provider timestamp yields `Invalid Date`, which Prisma rejects on a `DateTime` column — exactly the message reproduced below. Any write-side constraint violation does the same.
- **Impact:** RERA/compliance data staleness (second-highest business weight in the protocol's ordering) with no user-visible signal beyond a failing cron.
- **Reproduction (exact):**
  ```bash
  git checkout 420b77c -- client/src/lib/persistence/rera-store.ts
  npx vitest run client/src/lib/persistence/rera-store.test.ts
  # 2 failed | 2 passed — the upsert case fails with the propagated error:
  #   Error: Invalid value provided. Expected Date, got Invalid Date.
  ```
- **Fix:** wrap the write half per row in `try/catch` and report the failure into `errors` exactly as a provider failure is reported — the row stays STALE for the next run and the rest of the batch proceeds. `ok` remains `errors.length === 0`, so the cron still surfaces the problem.
- **Audit trail:** commit `0225e0e`. Failing tests in the **new** `client/src/lib/persistence/rera-store.test.ts`: *"BUG-R4-004: an upsert failure on one row must not abort the rest of the batch"*, *"…an audit-event failure is contained the same way"*. **2 red → green.** Two others passed pre-fix and pin existing correct behaviour: the happy path, and the provider-failure path (which the pre-existing `try/catch` already handled). This file is also the first test coverage `rera-store.ts` has ever had — a gap round 1's Phase 7 called out.

---

## 4. Cleared by evidence (no defect)

| Area | Method | Result |
|---|---|---|
| Missing authorisation | Census of all 73 route handlers for `authorizeRequest` / `CRON_SECRET` | Every privileged route guarded; the 26 unguarded ones are public read/search/observability/auth by design |
| Permission-string drift (`"channel.write"` vs 14× `"broker.channel.write"`) | Traced through `roles.ts` | `channel.write` is a **distinct, legitimately granted** permission (BROKER_MEMBER:134, BROKER_ADMIN via :114, demo:83) — naming inconsistency only, not a privilege bug. Watchlist W3 |
| Raw SQL | grep `$queryRaw*`/`$executeRaw*` across non-test code | Only parameterized `set_config($1, …)` and pre-planned statements with `$N` placeholders; no interpolation of user values |
| `dangerouslySetInnerHTML` (24 sites) | Read each | All render via `serializeJsonLd` (escapes `<`, `>`, U+2028/29) |
| `parseInt` without radix / bare `.sort()` on numbers / loose `==` | grep sweeps | Zero radix omissions. All bare `.sort()` calls are over strings (SigV4 header names, 6-digit PIN codes, id/fingerprint lists) where lexicographic order is correct. All `==`/`!=` hits are intentional `!= null` nullish checks |
| Empty `catch {}`, `eval`, `new Function`, TODO/FIXME debt | grep sweeps | None in `app/` or `client/src/` |
| `process.env` leakage into client bundles | grep non-`NEXT_PUBLIC_` in components/pages/contexts | None; the 3 `NEXT_PUBLIC_*` reads are correct build-time inlines |
| `NEXT_PUBLIC_*` documentation parity | Round 2's `env-docs-parity.test.ts` guard (both directions) | Green. `NEXT_PUBLIC_ARCHITECH_MEDIA_KINDS` **is** documented (`.env.example:34`, as a comment — the guard's regex matches it) |
| Script test suites (outside vitest) | Ran all 7 individually | `location` 28/28, `privacy` 3/3, plus 2+5+6+2+7+6 — **all pass** |
| Repo audit gates | `pnpm env:audit` | `provisioning_plan_ready_external_account_access_required` — pass |
| Channel matching determinism | Read `channel/matching.ts` in full | `now` injected; `scoreArea` guards `target === 0`; weights sum to 100; tie-break total. No defect |
| Other scheduled jobs (batch-abort class) | Read `retention-runtime.ts`, `alerts-runtime.ts` | Both already correct — and instructive: the media sweep paginates by **id cursor** (`orderBy: { id: "asc" }` + `cursor`), so a failing row cannot block the queue. That is the pattern BUG-R4-004 lacked |

---

## 5. Watchlist (speculation — NOT confirmed bugs, no fix applied)

| ID | Item | Evidence | Proposed handling |
|---|---|---|---|
| **W1** | **Rate limiter fails open with no client identity.** `clientKey()` returns `null` when no `x-real-ip`/`cf-connecting-ip`/`x-forwarded-for` is present, and `enforceMutationSafety` then returns `null` (pre-fix line 137) — no throttling at all. Deliberate and documented in-code (avoids lumping NATed clients into one bucket), and Origin/Host + body-size checks still run. | `request-safety.ts:31-39,136-137` | Product/infra decision, not a bug: either require a trusted proxy in production (and fail closed behind it) or add a global per-route fallback budget. Do **not** "fix" unilaterally — failing closed would break legitimate server-to-server callers |
| **W2** | **`comparableListings` divides by `subject.priceNum`.** If a subject listing ever had `priceNum === 0`, `deltaPct` becomes `Infinity`. The peer filter checks `listing.priceNum > 0` but not the subject's. Not reachable today: the only caller (`app/listing/[id]/page.tsx:181`) passes fixture-sourced prices, all non-zero. | `client/src/lib/listing/comparables.ts:20` | One-line defensive guard when the module next changes. **Do not invent a fallback price** — that would violate the no-invented-listing-facts constraint |
| **W3** | **Permission-string inconsistency:** one route asks for `"channel.write"` where its siblings (`accept`, `reject`) ask for `"broker.channel.write"`. Functionally equivalent today (both granted to the same roles) but a future role split would silently diverge. | `app/api/broker/channel/matches/[id]/respond/route.ts:12` vs `roles.ts` | Cosmetic rename once product confirms the two grants are meant to be the same |
| **W4** | **Coverage copy (Mumbai / "12 metros").** Carried forward from round 1's watchlist; round 2 re-verified the claim matches the 12 live city hubs in `liveCities`. Left untouched: a copy/product decision, and changing it would mean asserting coverage facts. | `app/buy/page.tsx:12`, `client/src/pages/Home.tsx:48` | Flag to content owner |

---

## 6. Phase 7 — patterns, prevention, monitoring

**1. The dominant pattern: bounded contents, unbounded containers.** Three of four bugs are the identical mistake — a ring buffer, a per-key budget, or a per-row cap that limits what an entry holds while nothing limits how many entries exist. Every one of them is keyed by data that crosses the trust boundary (`body.name`, IP headers, `body.email`).

*Preventive measures, cheapest first:*
- **A shared `BoundedWindowMap` helper.** Three near-identical prune implementations now exist across `metrics-store.ts`, `request-safety.ts`, `login-throttle.ts`. Extract one (constructor takes `maxEntries` + `windowMs`; `take()`/`push()` prune at the ceiling; `.size` exposed). That is the single highest-value refactor this report recommends, and it structurally prevents the fourth instance.
- **A CI source guard** in the style the repo already uses well (`sql-query-bounds.test.ts`, `server-query-caps.test.ts`, `env-docs-parity.test.ts`): flag any module-level `new Map(`/`new Set(` in non-test server code whose module does not also contain a bounded eviction path or an explicit `// bounded: <reason>` marker. The repo has proved this technique works — apply it to this class.
- **Lint rule** for the specific anti-pattern that caused BUG-R4-001: a `String.prototype.startsWith`/`includes` guard applied to a string built by concatenation in the same expression is always true.

**2. "Guard the whole unit of work, not just its riskiest step."** BUG-R4-004 guarded the network call and not the writes that followed it. Rule: in any loop over persisted rows, the *entire* per-row body is the try-block. And for any queue drained by `orderBy <mutable timestamp>`, a row that fails must still advance its position, or it will block the queue forever — `retention-runtime.ts`'s id-cursor pagination is the in-repo model to copy.

**3. Monitoring (Sentry alerts worth adding):**
- `metricsStoreMeta().seriesCount` — must stay ≤ 6. Any growth is an active BUG-R4-001 regression.
- `mutationSafetyBucketCount()` and `loginThrottleBucketCount()` pinned at their ceilings — sustained saturation means either a real traffic spike or a spray.
- Node `heapUsed` trend per replica, with restart-on-threshold: all three memory bugs present identically as a slow climb, and none of them produces an error to alert on until the OOM.
- Alert on non-2xx from `/api/internal/scheduled/*`. Before BUG-R4-004's fix, a wedged RERA cron was invisible except as a recurring 500 nobody watched.

**4. Coverage gaps closed and remaining.**
- Closed: `rera-store.ts` had **no** tests (round 1, Phase 7 item 4) — now 4, including the batch-resilience contract.
- Closed: `metrics-store.ts`'s "ignores unknown metric names" claim was asserted in a test name but never actually exercised — now it is.
- Remaining: `channel/store.ts` (in-memory demo store) and `persistence/media-store.ts` still have no direct tests; the `login`/`register` route bodies are covered only via `credential-flow` tests.

**5. Process note on this environment.** Two things cost avoidable time and are worth fixing in the harness: (a) `pnpm` is not on `PATH` — `corepack enable pnpm && corepack prepare pnpm@10.4.1 --activate` fixes it; (b) `node_modules` is absent on a fresh checkout, so no gate can run until `pnpm install`. Both are one-time. `pnpm db:validate` is *not* blocked (§2) once the shipped shim is installed — future rounds should not carry forward the "blocked by egress" note.

---

## 7. Audit trail — fix ↔ BUG-ID ↔ failing test ↔ commit

| BUG-ID | Failing test (red-first) | Red pre-fix | Fix commit | Post-fix |
|---|---|---|---|---|
| BUG-R4-001 | `client/src/lib/observability/metrics-store.test.ts` — 3 tests named `BUG-R4-001: …`; `client/src/lib/observability/observability.test.ts` — 1 test named `BUG-R4-001: the public RUM route cannot mint unbounded series via arbitrary names` | **4 failed** (`expected 1 to be +0` on the route probe) | `10b88e8` | 4 green |
| BUG-R4-002 | `client/src/lib/auth/request-safety.test.ts` — `BUG-R4-002: the bucket map stays bounded…`, `…expired windows are reclaimed…` | **2 failed** (+ measured 66.4 MB heap growth / 200k requests via throwaway probe) | `9a9f240`, then `866698b` (eviction order) | 2 green, 3rd guard green throughout |
| BUG-R4-003 | `client/src/lib/auth/login-throttle.test.ts` — `BUG-R4-003: the email bucket map stays bounded…`, `…the ip bucket map stays bounded…`, `…expired windows are reclaimed…` | **3 failed** | `e75f841` | 3 green, 4th guard green throughout |
| BUG-R4-004 | `client/src/lib/persistence/rera-store.test.ts` (new file) — `BUG-R4-004: an upsert failure on one row must not abort the rest of the batch`, `…an audit-event failure is contained the same way` | **2 failed** (`Error: Invalid value provided. Expected Date, got Invalid Date.` propagated out of the batch) | `0225e0e` | 2 green, 2 pre-existing-behaviour pins green throughout |

Every commit message names its BUG-ID. Every guard test is named after its BUG-ID, so `grep -rn "BUG-R4-00" client/src` enumerates the whole regression surface.

---

## 8. Phase 5 — validation record

| Check | Baseline `420b77c` | Final `0225e0e` |
|---|---|---|
| `pnpm test` | 159 files / **1725** pass · 2 files / 46 tests skipped · 0 fail | 160 files / **1740** pass · 2 files / 46 tests skipped · 0 fail |
| `pnpm check` (`tsc --noEmit`) | clean, exit 0 | clean, exit 0 |
| `pnpm lint` (`eslint app client/src`) | exit 0 | exit 0 |
| `pnpm db:validate` | **valid** (via the shipped sandbox shim — see §2) | **valid** |
| `pnpm location:import:test` | 28/28 | unchanged |
| `pnpm privacy:requirements:test` | 3/3 | unchanged |
| `pnpm env:audit` | pass | unchanged |

**Test delta:** 1725 → 1740 = **+15 guard tests** (R4-001: 4 · R4-002: 3 · R4-003: 4 · R4-004: 4). No pre-existing test was modified or deleted; the +1 file is `rera-store.test.ts`.

**Diff:** 9 files, +456 / −39 — 5 source files, 4 test files. No migration, no schema change, no dependency change, no unrelated refactor.

**UI-impacting verification:** none required. No fixed code path changes rendered output, routing, or public page content, so `pnpm test:a11y` / `pnpm test:ui` were not run. The RUM and login fixes are ingest-side only; the RERA fix is a background cron.

**End-to-end confirmation a reviewer can run in a deployed environment (not possible here — no live DB):**
1. POST 5 000 distinct `name` values to `/api/observability/web-vitals`, then read `seriesCount` from `metricsStoreMeta()` — must be ≤ 6.
2. Watch `heapUsed` across a burst of mutations carrying rotating `x-real-ip` — the curve must plateau at the `MAX_RATE_LIMIT_BUCKETS` ceiling instead of climbing.
3. Force one `reraRecord.upsert` to fail (e.g. a malformed `retrievedAt`) and confirm the cron returns `ok: false` with the row named in `errors`, `refreshed` still counting the other rows, and the *next* run reaching rows beyond the failed one.
