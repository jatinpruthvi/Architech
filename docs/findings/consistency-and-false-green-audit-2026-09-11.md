# Consistency & false-green audit — 11 Sep 2026

**Scope:** "is there any bug in development, and does any item conflict with another item?"
Answered as two questions: (1) are any of the repo's own checks lying about their result, and
(2) do any two artefacts in the repo assert incompatible things about the same subject.

**Method:** `.skills/superpowers/` — `systematic-debugging` (Phase 1 evidence before any fix,
Phase 2 compare against a working example in the same codebase) and
`verification-before-completion` (every claim below carries the command that produced it and
the number it returned).

**Environment:** Node v22.22.3, pnpm 10.4.1 (installed this session; `node_modules` was absent).
Working tree at `66e70c6`.

---

## 1. Verified baseline (before and after the fixes in §2)

| Gate | Command | Result |
|---|---|---|
| Types | `pnpm check` | exit 0 |
| Lint | `pnpm lint` | exit 0 |
| Unit | `pnpm test` | 201 files passed / 2 skipped; **2209 passed, 49 skipped (2258)** |
| Schema | `pnpm db:validate:offline` | `The schema at db/schema.prisma is valid 🚀` |
| SEO smoke | `pnpm test:seo` (against live dev server) | 19 routes, 8 sitemaps, 2 AI index files; onpage-audit 525 URLs, 0 errors |
| PWA | `node ops/scripts/audit/pwa-audit.mjs http://127.0.0.1:3000` | 30/30 checks passed |
| Mobile | `node ops/scripts/audit/mobile-audit.mjs http://127.0.0.1:3000` | 14/14 routes, 0 advisory findings |
| Contrast | `pnpm audit:contrast` | pass |
| Security/legal/ops/release | `security:headers`, `security:rls` (16 passed, 0 failed, 1 note), `legal:gates`, `ops:audit`, `release:audit`, `production:plan:audit` | all pass |

The application itself is healthy. Every real defect found below is in **tooling and
contracts**, not in shipped app behaviour — which is precisely why they survived: nothing
that was green was measuring them.

---

## 2. Bugs found — fixed and verified this session

### BUG-1 · Three npm scripts pointed at a directory that does not exist

`package.json` referenced `scripts/location/…` and `scripts/privacy/…`. There is no root
`scripts/` directory (`git ls-files scripts/` → **0 tracked files**); those scripts moved to
`ops/scripts/` per `AGENTS.md`.

Two of the three used a shell glob, which is the dangerous variant — an unmatched glob is
passed through literally, `node --test` finds no files, and it **exits 0**:

```
$ pnpm location:import:test        →  # tests 0   # pass 0   EXIT=0
$ pnpm privacy:requirements:test   →  # tests 0   # pass 0   EXIT=0
$ pnpm privacy:leads:test          →  Could not find 'scripts/privacy/purge-expired-leads.test.mjs'   EXIT=1
```

The third failed loudly; the first two were **silent false greens** — a caller sees exit 0 and
concludes the tests ran.

**Why this matters more than a typo:** `pnpm privacy:requirements:test` is a
`requiredChecks` entry for **both staging and production** in
`ops/config/governance/environments/phase-1-environments.json`. The promotion gate for the
DPDP retention-purge behaviour (`blocker.md` LEG-002) was wired to a command that executed
zero tests and reported success.

**Fix applied** — three paths in `package.json` (`scripts/` → `ops/scripts/`).

**Verified after the fix:**

```
$ pnpm location:import:test       →  # tests 28  # pass 28  # fail 0  EXIT=0
$ pnpm privacy:requirements:test  →  # tests 6   # pass 6   # fail 0  EXIT=0
$ pnpm privacy:leads:test         →  # tests 3   # pass 3   # fail 0  EXIT=0
```

28 + 6 + 3 = **37 tests were previously unreachable through their documented entry points.**

### BUG-2 · `audit:mobile` could not fail

`ops/scripts/audit/mobile-audit.mjs` had **no exit-code logic at all** — no `process.exit`, no
failure counter. With the server down, all 14 routes recorded `status: "ERROR"`, were printed
as `ERROR`, were then skipped by the two `if (r.status === "ERROR") continue` guards, and the
script exited 0:

```
$ node ops/scripts/audit/mobile-audit.mjs     # nothing listening on :3000
... 14 × "ERROR   TypeError: fetch failed"
REAL exit=0
```

"Server down" and "audit clean" were the same exit status.

Phase 2 comparison found the working sibling in the same directory:
`ops/scripts/audit/pwa-audit.mjs:242-253` counts failures and ends with
`process.exit(failed ? 1 : 0)`. The difference was only that accounting.

**Fix applied** — the same contract, scoped narrowly: a route that could not be audited, or
that returned non-200, fails the run. Advisory findings (overflow / tapRisk / grid) stay
non-fatal, because they are review signals rather than breakage, and making them fatal would
have changed the script's meaning rather than its honesty.

**Verified both ways:**

```
$ node ops/scripts/audit/mobile-audit.mjs http://127.0.0.1:3000
  14/14 routes audited at http://127.0.0.1:3000; 0 advisory finding(s).      EXIT=0
$ node ops/scripts/audit/mobile-audit.mjs http://127.0.0.1:3999
  0/14 routes audited at http://127.0.0.1:3999; 0 advisory finding(s).
  ✗ 14 route(s) could not be audited                                         EXIT=1
```

`audit:mobile` is not referenced in `.github/workflows/ci.yml`, so this changed no CI outcome —
it changed what a developer learns when they run it.

---

## 3. Conflicts found — items that contradict each other (reported, not changed)

### C-1 · The three `.env.*.example` files disagree, and every disagreeing key is live in code

| Key | in code | `.env.example` | staging | production |
|---|---|---|---|---|
| `ARCHITECH_SEARCH_SQL_PAGE` | 7 files | ✗ | ✓ | ✓ |
| `CRON_SECRET` | 5 files | ✗ | ✓ | ✓ |
| `ARCHITECH_SEARCH_SQL_NARROW` | 2 files | ✗ | ✓ | ✓ |
| `ARCHITECH_AUTHORITY_STORAGE` | 2 files | ✓ | ✗ | ✗ |
| `ARCHITECH_BROKER_PLAN_STATUS` | 5 files | ✓ | ✗ | ✗ |
| `ARCHITECH_CALLING_HOURS_IST` | 3 files | ✓ | ✗ | ✗ |
| `ARCHITECH_LEAD_CALL_ATTEMPT_LIMIT` | 2 files | ✓ | ✗ | ✗ |
| `ARCHITECH_LEAD_RETENTION_DAYS` | 2 files | ✓ | ✗ | ✗ |
| `ARCHITECH_SUPER_ADMIN_PASSWORD_HASH` | 3 files | ✓ | ✗ | ✗ |
| `NEXT_PUBLIC_MAPLIBRE_VENDOR_PATH` | 3 files | ✓ | ✗ | ✗ |

Ten keys, all referenced from `src/`. An operator provisioning staging or production from the
shipped template is not told about the super-admin password hash, lead-retention window, or
calling hours; a developer on preview is not told about the SQL search path or `CRON_SECRET`.

**Why no gate caught it:** `src/lib/env-docs-parity.test.ts` is the parity guard, and by its own
documented scope it checks only `NEXT_PUBLIC_*` against `.env.example` — one variable family,
one file. Server-side `ARCHITECH_*` keys and the staging/production templates are outside it.
The `environment-audit.mjs` that does run in CI validates the JSON matrix's *shape*, not the
example files, and passes.

*Suggested shape of a fix:* widen the parity test to all env keys across all three templates,
or generate the staging/production templates from the matrix.

### C-2 · Vendored skill libraries give mutually exclusive timing rules for the same UI element

All three are loaded from `.skills/`, so an agent asked to animate a modal gets three
incompatible answers depending on which skill fires:

| Element | `skills/skills/animate` | `genjutsu/_jutsu/motion-principles` | `motion-design-skill` |
|---|---|---|---|
| Modal / drawer | `200–500ms` (:121) — but "**UI animations stay under 300ms**" (:124) and ">300ms with no reason" is listed as a smell to fix to `150–250ms` (:178) | `200-300ms` (:18) | `300-400ms` (:119) |
| Page / route transition | — | `300-500ms` (:19), "**Never exceed 500ms** on a UI interaction" (:205) | `400-600ms` (:120) |
| Micro / icon / tooltip | `125–200ms` (:119) | `100-150ms` (:17) | `150-250ms` (:117) |

Two are hard contradictions, not overlaps: `motion-design-skill` prescribes a 300–400ms modal
that `animate` explicitly flags as a defect, and its 400–600ms page transition exceeds the
ceiling `motion-principles` calls absolute.

### C-3 · Skill libraries target animation/3D stacks this project does not use

`package.json` declares exactly one animation dependency: `motion: ^13.1.1`. There is **no**
`gsap`, `three`, `lottie`, or `framer-motion` anywhere in `dependencies` or `devDependencies`,
and 0 files in `src/` import any of them (`grep -rIl 'from "three' src` → 0).

Yet `.skills/` ships `gsap-skills/` (8 skills), `threejs-skills/` (10 skills),
`motion-design-skill/` (Lottie), and genjutsu's `gsap`, `framer-motion`, `threejs-r3f`,
`swiftui-*` and `compose-multiplatform` modules. Their descriptions instruct "Recommend GSAP
when the user needs timelines" — i.e. they will pull in a new runtime dependency that
conflicts with the project's CSS-reveal contract.

The conflict is sharper still for the one library that *is* installed: `motion@13.1.1` is
imported by **zero** files in `src/`, `ops/` and `tests/`, and
`src/lib/ui/design-token-discipline.test.ts:613` asserts
`expect(results).not.toMatch(/from "motion\/react"/)` on `src/screens/ResultsPage.tsx`, with the
comment "the library itself blew the search first-load budget. CSS reveal + listing keys is the
contract." So the repo both declares `motion` as a production dependency and enforces a test
that forbids importing it.

### C-4 · 29 broken relative links inside `.skills/`; 4 of them are functional instructions

Most are documentation casualties of the intentional vendoring trim described in
`.skills/README.md` (dropped upstream `docs/`, `CHANGELOG.md`, `.github/`). Four are different —
they are runtime instructions an agent is told to *load and follow*, and the targets do not
exist under any name:

| Referenced from | Broken link | Nearest real file |
|---|---|---|
| `.skills/impeccable/skill/reference/new-work.md:116` | `degraded/finish-reviewer.md` | `skill/agents/impeccable-finish-reviewer.md` |
| `.skills/impeccable/skill/reference/new-work.md:118` | `degraded/finish-reviewer.md` | `skill/agents/impeccable-finish-reviewer.md` |
| `.skills/impeccable/skill/reference/new-work.md:124` | `degraded/documenter.md` | `skill/agents/impeccable-documenter.md` |
| `.skills/impeccable/skill/reference/visualize.md:52` | `degraded/asset-producer.md` | `skill/agents/impeccable-asset-producer.md` |

`.skills/impeccable/skill/reference/degraded/` does not exist at all. These are the
"no-subagent-capable harness" fallback paths, so they break exactly in the environment least
able to improvise around them.

Also in this class: `.skills/superpowers/skills/writing-skills/anthropic-best-practices.md`
carries 15 dead links (`FORMS.md`, `REFERENCE.md`, `EXAMPLES.md`, `reference/*.md`, …) because
those siblings were not vendored.

### C-5 · Two MCP config files declare the same server differently

`.mcp.json` and `.cursor/mcp.json` both define `prompts.chat` at the same URL, but only
`.mcp.json` sets `"type": "http"`. Two sources of truth for one server, already divergent in
shape. (`.mcp.json` also carries a `21st` server whose `x-api-key` is masked as
`21st_*****a6` — a placeholder, not a leak.)

### C-6 · `docs/planning/blocker.md` states a stale baseline

Line 5: "all code/test/CI gates are green locally (tsc, eslint, **1517 unit tests**, 19-route SEO
smoke, 113 E2E checks…)". Measured today: **2209 passed / 49 skipped (2258 total)**. The file is
dated 5 Sep 2026 and is otherwise accurate; the number just predates ~690 tests. Harmless in
isolation, but `blocker.md` is the document someone reads to decide whether the baseline is
trustworthy, so a wrong count there is the wrong place for drift.

---

## 4. Investigated and **not** a bug — do not "fix" these

Recorded because each looks like a defect on first contact and each has a deliberate cause.

- **`/sitemap/localities.xml` lists 70 `/buy/` and 68 `/rent/` locality URLs against a registry
  of 72.** The `Locality` type has no `intents` field (0 of 72 declare one), so this is not data.
  It is `src/lib/seo/page-gate.ts`: `activeListingsIn()` filters by transaction intent, and its
  header comment states the reason — "The `intent` filter is what stops the rent surface
  becoming a doorway farm… would publish a rental page with nothing to rent on it." Working as
  designed, and it is the behaviour `intent-nav-parity.test.ts` guards.
- **27 CSS custom properties in `src/theme.css` are declared twice with different values.** The
  two declarations are `:root` (line 65) and `.dark` (line 116) — the light/dark token pairs.
  A further 7 are identical re-declarations, which is redundancy, not conflict.
- **Registry vs documentation.** `STATUS.md` claims "12 live cities, 72 localities"; a probe over
  the real modules returned `citiesTotal: 12, byStatus: {"live": 12}, localitiesTotal: 72,
  orphanLocalities: []`. Exact match, no orphaned locality.
- **No routing collisions.** 0 directories hold both `page.tsx` and `route.ts`; 0 same-level
  sibling dynamic segments across 39 dynamic dirs; 0 duplicate city slugs; 0 duplicate component
  basenames under `src/components/`; 0 duplicate `<loc>` entries in any of the 7 sitemaps.
- **No test reads a file that has moved.** All 15 literal file paths referenced from tests across
  `src/**/*.test.ts` and `ops/**/*.test.mjs` resolve — the BUG-1 class of defect does not recur
  inside the test suite.
- **All 28 governance `requiredChecks` resolve to real `package.json` scripts**, and every
  `requiredSecrets` entry appears in its matching `.env.*.example`. (One of those checks was the
  vacuous command from BUG-1 — the wiring was right, the target was broken.)
- **`ops/config` has one shared id, `observability`**, in
  `phase-1-operational-readiness.json` (`/services[5]`) and
  `production-enablement-plan.json` (`/adapterSwitches[6]`). Cross-reference between two
  different record types, not a duplicated definition with conflicting values.

---

## 5. Not run here, and why

| Check | Reason |
|---|---|
| `pnpm test:e2e` / `test:perf` / `test:crawl` | require a production build (`pnpm build:ci`) |
| `pnpm test:a11y`, `test:ui`, `test:a11y:broker` | require `playwright install --with-deps chromium` |
| `pnpm location:coverage:audit` | exits 1 with `DATABASE_URL is required.` — needs a live PostGIS cluster |
| `pnpm storybook:smoke` | not exercised this session |

Nothing in §2 or §3 depends on these.

---

## 6. Changes made

| File | Change |
|---|---|
| `package.json` | 3 script paths: `scripts/…` → `ops/scripts/…` (`location:import:test`, `privacy:leads:test`, `privacy:requirements:test`) |
| `ops/scripts/audit/mobile-audit.mjs` | exit 1 when a route could not be audited or returned non-200; print an audited-route/advisory-finding summary. Advisory findings remain non-fatal |

Re-ran after the edits: `pnpm check` exit 0 · `pnpm lint` exit 0 · `pnpm test` 2209 passed / 49
skipped · `pnpm db:validate:offline` valid. No regression.

§3 is reported, not changed: C-1 needs a decision about which template is authoritative, C-2
needs a decision about which timing table wins, and C-3 needs a decision about whether `motion`
stays in `dependencies`.

---

# Part 2 — deeper pass (same session)

Round 1 stopped at tooling and contracts. This pass goes into application logic, the data
layer, the security surface, and the two large gates that had never been executed here.

## 7. The two gates nobody had run now pass

| Gate | Command | Result |
|---|---|---|
| Production build | `NODE_ENV=production node ops/scripts/build-ci.mjs` | `✓ Compiled successfully in 24.9s`, **603/603 static pages** generated, `BUILD_EXIT=0` |
| End-to-end | `node tests/e2e/run-all.mjs` | **139/139 checks passed** across 4 suites (public journeys 68, marketplace 16, broker ops 5, auth 50), `E2E_EXIT=0` |

Both boot the production runtime, so they cover route wiring, SSG param generation and the
auth/CSRF/throttle behaviour that unit tests stub out. Neither found a defect.

> `docs/planning/blocker.md:5` says "113 E2E checks". Measured today: **139**. The suite grew;
> the number did not.

## 8. Headline finding — a broker visibility feature that no live code path can reach

This is the deepest conflict found, and it is invisible to every gate in the repo.

**The chain, each link verified:**

1. `src/lib/broker/workflow.ts:42-45` — the draft contract declares
   `visibility?`, `addressVisibility?`, `contactVisibility?`, `brokerShareNote?`.
2. That type is the live request body type: `/api/broker/listings/route.ts:5` and
   `/api/broker/listings/[draftId]/route.ts:9` both `import type { ListingDraftInput }`.
3. `db/schema.prisma:791-794` has the four columns, plus indexes at `:882-883`
   (`@@index([visibility, lifecycle, meaningfulUpdatedAt])`, `@@index([addressVisibility, lifecycle])`).
4. The handler that persists the draft — `src/lib/persistence/broker-store.ts`, imported by
   **all 6 broker/admin API routes** — writes **none of the four**. Its `update` and `create`
   payloads go `… listerType: draft.listerType ?? "OWNER",` straight to `brokerOrgId` /
   `description`, with no visibility keys at all.
5. So the Prisma defaults always win: `PUBLIC`, `LOCALITY_ONLY`, `RELAY_ONLY`, `null`.
6. The **only** module that maps them is `src/lib/broker/store.ts` — a 584-line near-duplicate
   of the live file with **0 importers**. Side by side, the same function:

   ```diff
   # src/lib/persistence/broker-store.ts (LIVE — 6 importers)
     listerType: draft.listerType ?? "OWNER",
   + # src/lib/broker/store.ts (ORPHAN — 0 importers)
     listerType: draft.listerType ?? "OWNER",
   + visibility: draft.visibility ?? "PUBLIC",
   + addressVisibility: draft.addressVisibility ?? "LOCALITY_ONLY",
   + contactVisibility: draft.contactVisibility ?? "RELAY_ONLY",
   + brokerShareNote: draft.brokerShareNote ?? null,
   ```

   That is the *entire* substantive diff between the two 584/576-line files (the rest is one
   import path and 8 lines of the same block repeated in `update` and `create`).
7. `db/seed.mjs` and `ops/scripts/` never set them either — grep across both returns only the
   schema itself.

**Consequence.** Every reader of those columns is unreachable, so the feature is inert rather
than merely unwritten:

| Reader | Reads | Importers |
|---|---|---|
| `src/lib/auth/access.ts:55` `capabilitiesFor()` | `addressVisibility !== "LOCALITY_ONLY"` → `canRequestAddress`; `=== "PUBLIC_EXACT"` → `canViewExactAddress`; `contactVisibility !== "PUBLIC_BUSINESS"` → `canRelayCall` | **0 non-test callers** |
| `src/lib/channel/collaboration.ts:14` | `where: { …, visibility: "BROKER_SHAREABLE" }` | **0** |
| `src/lib/leads/contact-request.ts:12` | `select: { contactVisibility: true }` | **0** |
| `src/lib/leads/disclosure.ts:15` | `select: { addressVisibility: true }` | **0** |
| `src/screens/BrokerInventory.tsx:9` | renders `capabilities.canRequestExactAddress` | **0** |

`access.test.ts` passes because it constructs the input object by hand — it never goes through
the persistence layer that drops the values. Since `visibility: "BROKER_SHAREABLE"` is never
written by anything, `collaboration.ts`'s query could not match a row even if it were called.

**Net effect a user would hit:** a broker POSTs `addressVisibility: "PUBLIC_EXACT"` to
`/api/broker/listings`; it type-checks, is accepted, returns 201, and the value is discarded —
the listing lands on `LOCALITY_ONLY`.

**Why no gate catches it.** The four fields are optional (`?`) on `ListingDraftInput`, so
omitting them from the write payload is legal TypeScript. `pnpm check` passes, `pnpm lint`
passes, the unit tests for each island pass, and the e2e suites never exercise broker
visibility. There is no test that asserts "what the API accepts is what the DB stores".

**Two possible intents — the maintainer has to pick one:**
- *The feature is deferred:* delete the orphan twin and the four unreachable readers, and drop
  the four fields from `ListingDraftInput` so the API stops advertising an input it discards.
- *The feature is meant to be live:* the four mappings in `broker/store.ts` are the missing
  piece — port them into `persistence/broker-store.ts` and wire `capabilitiesFor` into the
  listing/broker screens.

Either way, **17 modules totalling 1,250 lines have zero importers**, of which this feature is
~900 lines. Full list, all verified with full-subpath greps:

```
src/lib/broker/store.ts (584)   src/lib/broker/panels.ts (203)   src/lib/listing/listings.ts (66)
src/lib/channel/collaboration.ts (28)   src/lib/leads/disclosure.ts (31)
src/lib/leads/contact-request.ts (17)   src/lib/auth/session.ts (7)   src/lib/proxy.ts (19)
src/lib/media/next-image-loader.ts (14)   src/shared/const.ts (2)
src/screens/BrokerInventory.tsx (21)   src/screens/BrokerPlan.tsx (13)
src/components/ErrorBoundary.tsx (63)   src/components/ui/accordion.tsx (64)
src/components/ui/tabs.tsx (64)   src/components/magicui/Marquee.tsx (14)
src/components/magicui/WordReveal.tsx (40)
```

`src/test/server-only-stub.ts` looks orphaned but is not — `vitest.config.ts:13` aliases
`server-only` to it.

## 9. Security surface — checked, and clean

All **54** mutation-bearing API routes were enumerated. The controls are applied three ways, and
every route is covered:

- **38** call `authorizeRequest`, which runs `enforceMutationSafety` on its first line
  (`src/lib/auth/guards.ts:22`) — so they inherit body-size, origin and burst checks.
- **7** public mutations call `enforceMutationSafety` directly: `/api/auth/login`, `/logout`,
  `/register`, `/api/leads`, `/api/observability/errors`, `/api/observability/web-vitals`.
- **4** cron routes (`/api/internal/scheduled/*`) verify a `CRON_SECRET` bearer token compared
  in constant time and **fail closed** — 503, not open, when the secret is unset.
- `/api/auth/super/sign-in` fails closed when unconfigured (503) and runs IP-keyed throttling
  with a 429 (`registerLoginAttempt`).

Only 3 mutation routes have no control at all — `/api/cost/ownership`, `/api/investment/metrics`,
`/api/listings/[id]/stats` — all stateless calculators/telemetry with no authz-relevant write.
**No gap found.** The `STATUS.md` claim about the centralized guard holds.

## 10. Data layer — checked, and consistent

A probe run against the real `cities.ts` / `localities.ts` modules validated 7 invariants across
12 cities and 72 localities. **0 problems.**

- every `marker` agrees with its human-readable `coords`
- every centroid sits inside its own `bbox` (`west,south,east,north`)
- no 3-digit PIN prefix is claimed by two cities (17 prefixes, no ambiguity in the
  `pincodes.ts` city fallback)
- no 6-digit PIN spans two cities (73 distinct PINs; 10 are shared by several localities
  *within* a city — the documented many-to-many)
- every locality PIN prefix is owned by its city
- no duplicate locality slugs or duplicate locality names within a city
- all `priceIndex` and `pricePerSqft` values positive

## 11. Investigated and cleared — hypotheses that did not survive checking

Recorded so they are not re-investigated, and because two of them looked convincing at first:

- **`property-generator.ts:146` formats ₹/sq ft without `Math.round`**, unlike the three other
  copies of that label. Not a bug: `salePerSqft = Math.round((bandPerSqft * spread) / 10) * 10`
  (line 126) is always an integer multiple of 10, so the raw `toLocaleString` can never emit a
  fraction.
- **Lead retention silently inherits the requirement retention window** —
  `leads/server.ts:56` falls back `ARCHITECH_LEAD_RETENTION_DAYS ?? ARCHITECH_REQUIREMENT_RETENTION_DAYS ?? "180"`,
  and `.env.staging.example:5` sets the requirement var to **30** while never setting the lead
  var, so staging leads get 30 days. Deliberate and documented: `.env.example:46` says "falls
  back to ARCHITECH_REQUIREMENT_RETENTION_DAYS". There is also **no stamp-vs-purge mismatch** —
  both purge scripts filter on the stored `retentionUntil` column, not on a re-read env var, so
  records are always purged on the window they were created with. The only real residue is the
  §3 C-1 drift: the fallback is documented in `.env.example` and mentioned nowhere in the
  staging/production templates, which is exactly where it takes effect.
- **`money.ts` vs `realestate/format-inr.ts`** are not competing formatters — one is bigint
  precision conversion, the other compact display. No overlapping responsibility.

## 12. Environment note

`pnpm` and `node_modules/` do not survive between turns in this sandbox (the global npm prefix
and the pnpm symlink farm live outside the persisted workspace). Any future session must
`corepack prepare pnpm@10.4.1 --activate && pnpm install --frozen-lockfile` (~20s) before the
gates in §1 and §7 will run. This is a sandbox property, not a repo defect.

## 13. Round-2 verdict

No new defect was fixed in this pass — the findings here are reported, not changed, because each
needs a product decision rather than a correction:

| # | Finding | Class | Needs |
|---|---|---|---|
| §8 | Broker visibility feature unreachable; orphan twin holds the only mapping | **Conflict** | decision: retire or wire up |
| §8 | 17 modules / 1,250 lines with zero importers | dead code | decision: delete or wire |
| §7 | `blocker.md` counts stale (113 e2e → 139; 1517 unit → 2209) | doc drift | one-line update |
| §3 C-1 | env template drift, now with a concrete consequence | **Conflict** | widen parity test |
| §3 C-2/C-3 | skill libraries contradict each other and the project's stack | **Conflict** | pick a canonical table |

What the deeper pass *did* establish: the application core is sound. Production build, 603
static pages, 139 e2e checks, 2,209 unit tests, the security surface and the geo/PIN data layer
all verify clean. The problems are concentrated in **duplicate modules that drifted apart** and
**documentation that stopped matching the code** — not in the running product.
