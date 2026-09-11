# Query optimization audit — 7 September 2026

Corpus-wide audit of the SQL the search layer actually emits, against the indexes that
actually exist. Same method as the on-page SEO audit (`docs/seo/onpage-audit-2026-09-07.md`):
get a community prompt through the documented retrieval playbook, strip what does not
survive contact with this repository, and report only what is verifiable from artifacts.

---

## 1. Retrieval path (prompt-library playbook, Step 4)

| Step | Action | Result |
|---|---|---|
| 1 | `POST https://prompts.chat/api/mcp` (`tools/list`, 20s timeout) | `http_code=000` — egress blocked, as documented. **One bounded attempt, not retried**, per the playbook. |
| 2 | Path A — `https://prompts.chat/prompts?q=query%20optimization` | 8 results, full content inline. |
| 2 | Path B — `https://prompts.chat/tags/database` | 6 prompts. |
| 2 | Path B — `https://prompts.chat/tags/optimization` | 11 prompts. |
| 3 | Path C — `.../cmmx2l3950001ic04hgs1q1dz_database-architect-agent-role` | Exact page, for provenance. |

## 2. Candidate comparison

| Prompt | Author | Verdict |
|---|---|---|
| **Database Architect Agent Role** | `@wkaandemir` | **ADOPTED as base.** Only candidate with a real query-optimization method: EXPLAIN-before-and-after, indexes justified by actual query patterns, an explicit "Red Flags" list, and per-finding rationale + testing. |
| Code Reviewer Agent Role | `@wkaandemir` | Partially adopted — contributes the N+1 and "database query efficiency" sweep items, but query work is one bullet among security/quality/bugs. Too shallow alone. |
| Supabase Principal Architect | `@samhiotis` | **Rejected.** Supabase/Edge-specific; names unrelated third-party systems (OpenHands, Hermes, KAI9000). Body is an unfilled stub (`Step 1: ...`). |
| Data Lineage Agent Skill | `@ajillell_uhg` | **Rejected.** Points at a specific unrelated GitHub repo; about lineage, not performance. |
| High-Frequency RSS Ingestion Architect | `@samhiotis` | **Rejected.** Stub body; fractal-dimension pseudo-metrics. |
| Prompt Enhancer / Constraint Solver | various | **Rejected.** Not query work. |

### Adaptation log — what was dropped and why

1. **`TODO_database-architect.md` output rule — dropped.** The prompt mandates writing all
   findings to that one file and creating no others. This repo's convention is a dated
   report under the relevant `docs/` domain plus registration in the markdown index.
2. **"EXPLAIN ANALYZE before and after" — retained as the standard, but unmet.** There is no
   live database in the sandbox (`DATABASE_URL` points at `localhost:5432`; no `psql`, no
   Postgres, no Docker). Recorded honestly in §5 rather than faked.
3. **Migration-safety section (gh-ost, online DDL, low-traffic windows) — dropped.** The
   shipped migration is index-only and additive; none of it applies.
4. **MongoDB / Redis guidance — dropped.** Neither is in this stack.
5. **"Review and remove unused indexes quarterly" — dropped as an action, kept as a note.**
   Identifying unused indexes requires `pg_stat_user_indexes` from production.
6. **Added, from the repo's own ARCH-17:** fixture data is small, so a green test run is not
   evidence of query health. This shaped the entire method below.

### Method actually used

Because correctness gates are blind to index usage, the audit did not read the query
builders and reason about them. It **executed** them in a throwaway Vitest file and
captured the literal SQL string emitted, then diffed those predicates against every
`CREATE INDEX` in `db/migrations`. Both sides are real artifacts.

---

## 3. Findings

| ID | Severity | Class | Location | Status |
|---|---|---|---|---|
| QP-19-001 | High | Redundant work | `src/lib/search/sql.ts` — `buildSqlNarrowPlan` | **Fixed** |
| QP-19-002 | High | Missing index | `City."name"` trigram | **Fixed** |
| QP-19-003 | Medium | Missing index | `Listing."titleHi"`, `"descriptionHi"`, `"note"` | **Fixed** |
| QP-19-004 | Medium | Ineffective index | `Locality_aliases_idx` / alias predicate | **Fixed** (see §4) |

### QP-19-001 — the narrow query ignored the city scope

`searchListingsForServer` (`src/lib/search/server.ts`) runs candidate narrowing and
then the scoped read:

```ts
const outcome = await narrowListingIdsForQuery(query);          // nationwide
const listings = await getListingsForServer({ citySlug, narrowToIds });  // city-scoped
```

`buildSqlNarrowPlan` emitted only `WHERE listing."lifecycle" = 'ACTIVE'` plus the token
clauses — **no city predicate**, even when the caller was searching one city. So a search
for "garden" in Ahmedabad scanned and matched listings in every city, returned all of their
ids, shipped that id list over the wire, and handed it to a Prisma
`id: { in: [...] }` whose sibling `city: { slug }` predicate then discarded every
out-of-city one. The expensive half of the work was thrown away by the next line.

**Why it is safe to fix:** this is an identity, not a heuristic. A candidate outside the
scoped city could never survive the outer read, so removing it changes no returned row.

**Fix:** `buildSqlNarrowPlan(rawQuery, citySlug?)` emits `AND city."slug" = $1` when scoped;
threaded through `narrowListingIdsForQuery` and the call site. Nationwide searches are
byte-for-byte unchanged (no predicate emitted).

**Explicitly NOT done:** adding a `LIMIT` to the narrow query. The candidate set is
unordered, so truncating it would silently drop rows the JS filter would have kept —
destroying the superset guarantee the whole path depends on for correct recall.

### QP-19-002 — `City."name" % $n` had no trigram index (and never had)

Emitted per residual token, per search:

```sql
OR locality."name" % $2
OR city."name"     % $2
```

`Locality_name_trgm_idx` (migration `202608240002`) supports line 1. **No index has ever
existed on `City."name"`** — not trigram, not even btree. The pair was written symmetric;
only one side was indexed. `%` is servable *only* by `gin_trgm_ops`, so this was an
unavoidable sequential scan of `City` with a per-row `similarity()` call, inside an OR
chain the planner cannot satisfy from the Locality index alone.

Invisible on fixtures because scanning a handful of cities is instant.

### QP-19-003 — three of nine ILIKE haystack columns were unindexed

`NARROW_HAYSTACK_SQL_TARGETS` declares nine ILIKE targets. Migration `202608240002` indexed
three (`title`, `description`, `addressLocality`) when those *were* the whole haystack. The
haystack later grew `titleHi`, `descriptionHi` and `note`; the index set never followed.

Leading-wildcard ILIKE is unindexable by btree but **is** servable by GIN trigram — the same
mechanism already used for `title`. `propertyType` is deliberately exempt (low-cardinality
enum-like; a trigram index costs writes and wins nothing) and that exemption is now asserted
by name in the guard test.

---

## 4. QP-19-004 — alias matching could not use an index at all

*Deferred in the first pass as a watchlist item, then fixed once it was confirmed the
database is not yet live (so the migration could be corrected in place rather than stacked).*

Migration `202609070001` creates `GIN ("aliases")` over the `text[]` column, commenting that
it makes the alias match cheap as the registry grows. The query was:

```sql
EXISTS (SELECT 1 FROM unnest(locality."aliases") AS alias
        WHERE alias ILIKE $1 ESCAPE '\' OR alias % $2)
```

A plain array GIN index serves array **containment** (`@>`, `&&`, `= ANY`). It cannot serve
`ILIKE` or `%` applied to elements *after* `unnest()`, because `unnest()` is an opaque
set-returning function to the planner. **Both** alternatives were therefore unindexable, and
the array was scanned per row per token. The index was real but inapplicable — worse than a
missing index, because its comment asserted coverage that did not exist.

**Fix.** The predicate now matches the normalised `LocalityAlias` table:

```sql
EXISTS (SELECT 1 FROM "LocalityAlias" AS alias
        WHERE alias."localityId" = locality."id"
          AND (alias."normalizedName" ILIKE $1 ESCAPE '\'
               OR alias."normalizedName" % $2))
```

with `LocalityAlias_normalizedName_trgm_idx` added. The correlation rides the leading column
of the existing `(localityId, normalizedName, languageCode)` unique key.

**Why this is recall-safe — it widens, never narrows.** `LocalityAlias` is a strict superset
of the legacy array: migration `202608300002` backfilled it via
`CROSS JOIN LATERAL UNNEST(locality."aliases")` as type `SEARCH`, *in addition to* the
`OFFICIAL` name and the `TRANSLITERATION` `hindiName` rows, and `db/seed.mjs` still
writes both representations. Crucially this alternative is **OR'd** into a candidate
*superset* that the unchanged JS filter then narrows, so a wider candidate pool cannot change
which rows the caller returns. That is what made the earlier "this changes recall" concern
resolvable rather than blocking.

`Locality_aliases_idx` is deliberately **left in place**: the array column is still seeded and
still read by location-import reconciliation, and containment lookups against it remain
servable. Dropping it is a separate decision this migration does not make.

### Watchlist — still open

Nothing from this audit remains unfixed. The only outstanding items are the measurements in
§5, which need a live database.

## 5. What I could not check

| Gap | What would unlock it |
|---|---|
| Whether the planner **chooses** the new indexes | `EXPLAIN (ANALYZE, BUFFERS)` on production-shaped data. No database in the sandbox: `DATABASE_URL` is `localhost:5432`, and there is no `psql`, no Postgres install, and no Docker. |
| Actual latency change | `ARCHITECH_BENCH_DATABASE_URL=... pnpm vitest run src/lib/search/latency-bench.test.ts` — the harness exists and is opt-in; it skipped here. |
| Which existing indexes are unused | `pg_stat_user_indexes` from production. |
| Write-cost of the four new GIN indexes | Measured insert throughput on production-shaped data. GIN maintenance is not free; these are justified by read patterns that demonstrably exist, but the trade was not measured. |

`pnpm db:validate` cannot run in the sandbox either (it downloads a schema engine over
blocked egress). The repo's own `pnpm db:validate:offline` shim was used instead — schema
valid.

## 6. The one thing

**Correctness gates cannot see performance defects.** Every finding here survived `tsc`,
lint, 1972 tests, the 48-case SQL/JS parity matrix and the 578-page crawler — because all of
them assert *which rows come back*, and on fixture-sized data a sequential scan returns
exactly the same rows as an index scan, just slower. The class was structurally invisible.

That is why the fix ships with `src/lib/search/sql-index-coverage.test.ts`, which
asserts a *different kind* of property: it executes the query builder, extracts every
predicate that requires a specific index type, and checks a matching `CREATE INDEX` exists
in the migrations. It needs no database. It cannot prove the planner picks the index — but
it makes "this predicate has no index at all" impossible to merge again.

**Both guards were verified to fail, not just to pass.** Reverting the alias predicate to
its `unnest(...)` form produced:

```
× never reintroduces unnest() over the aliases array
  AssertionError: expected '...' not to contain 'unnest('
× correlates the alias subquery to the joined locality
  AssertionError: expected '...' to contain 'alias."localityId" = locality."id"'
```

and temporarily removing the `City_name_trgm_idx` statement produced:

```
× every trigram (%) operand in the emitted narrow plan has a gin_trgm_ops index
  AssertionError: expected [ 'city.name' ] to deeply equal []
× every ILIKE haystack column has a gin_trgm_ops index (or a named exemption)
  AssertionError: expected [ 'City.name' ] to deeply equal []
```

The migration was then restored and `git diff --stat db/` confirmed clean.

## 7. Verification

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `pnpm lint` | clean |
| `npx vitest run` | **1981 passed / 49 skipped (2030)** — was 1972/49; +9 from the new guard |
| `pnpm db:validate:offline` | schema valid |
| Guard fails on regression | verified (§6) |

## 8. Changes

- `src/lib/search/sql.ts` — optional `citySlug` scope pushdown (QP-19-001).
- `src/lib/search/sql-narrow.ts` — threads `citySlug`; logs it in telemetry.
- `src/lib/search/server.ts` — passes the resolved city scope.
- `db/migrations/202609070003_search_predicate_indexes/migration.sql` — five additive
  GIN trigram indexes (QP-19-002, QP-19-003, QP-19-004). Amended in place rather than
  superseded by a further migration: the database is not yet live anywhere, so no
  environment has applied it and there is no checksum to invalidate. Once it is deployed,
  the same change would have to be a new migration.
- `src/lib/search/sql.test.ts` — the assertion pinning the old `unnest(...)` form
  updated to the new contract.
- `src/lib/search/sql-index-coverage.test.ts` — the index-coverage invariant.

---

## 9. Follow-up — leftmost-column index defects (W1, W2)

Carried over from the watchlist of `docs/ai/sql-perf-bug-hunt-2026-09-06.md`, which deferred
both for one stated reason:

> **Not shipped:** sandbox cannot run `prisma validate` (engine download TLS-blocked), and
> ARCH-17 step 6 forbids unverifiable migrations.

That blocker is gone. `pnpm db:validate:offline` (the schema-engine shim) validates without
network egress, and the database is not live anywhere, so the index could be appended to the
existing unapplied migration rather than stacked behind it.

### The shared defect

**A composite index only serves a filter if the filtered column is the leftmost one.** Both
findings are the same mistake, and both are dangerous precisely because the schema *looks*
well indexed.

| ID | Query | Existing indexes | Why none applied |
|---|---|---|---|
| W1 | `getModerationQueueForServer` — `where: { lifecycle: "IN_REVIEW" }`, `orderBy: updatedAt asc`, `take: 500` | `Listing` has **six** indexes mentioning `lifecycle` | `lifecycle` is a *trailing* column in every one |
| W2 | `refreshStaleReraRecordsForServer` — `where: { verificationStatus: "STALE" }`, `orderBy: updatedAt asc`, `take: 10` | `[jurisdictionSlug, verificationStatus]`, `[state, verificationStatus]` | `verificationStatus` is second in both |

W1 is the one that matters: it is a sequential scan of the whole `Listing` table on the path
brokers wait on. The existing `take: 500` cap bounds **memory, not scan cost** — the scan
still reads every row to find the matching ones.

**Fix:** `@@index([lifecycle, updatedAt])` on `Listing` and
`@@index([verificationStatus, updatedAt])` on `ReraRecord`, with `updatedAt` second so the
FIFO ordering is served by the same index instead of requiring a separate sort.

### Honest scope on W2

The source audit called W2's impact "negligible at `take: 10`", and **that assessment still
stands**. It shipped because it is the identical defect to W1 and costs one statement — not
because measurement justified it independently. A small `LIMIT` on a small table is cheap
even when scanned; the scan grows with the table while the `LIMIT` does not.

### Census — what was checked and cleared

The sweep looked for every single-column equality filter reaching Postgres, not just the two
already known. It found four; two were the defects above, and:

- `SavedSearchAlertOutbox.status` (`where: { status: "PENDING" }`, drain + count) — **already
  correct.** `@@index([status, createdAt])` leads with `status`. Cleared, and added to the
  guard registry so it stays that way.
- `ChannelRequestSource.sourceListingId` initially flagged by a rough detector — **false
  positive.** It is `@unique`, so Postgres creates a unique index that serves it; the
  detector only looked for plain `CREATE INDEX`. Recorded because the corrected extractor now
  handles field-level `@unique` and `@id`.

### Guard

`src/lib/db/index-leftmost-coverage.test.ts` reads `db/schema.prisma` and asserts
each registered single-column filter has **some** index — plain, unique, or composite — whose
*first* column is that field. No database required.

It also guards itself: one test asserts the extractor reports `updatedAt` as **not** covered
on `Listing` (it appears only as a trailing column). Without that, the whole file would be
decorative, since every model has plenty of indexes *mentioning* the relevant columns.

**Verified to fail, not just to pass.** Removing both new `@@index` lines produced:

```
× Listing.lifecycle has an index leading with that column
  AssertionError: expected [ 'cityId', 'cityId', …(11) ] to include 'lifecycle'
× ReraRecord.verificationStatus has an index leading with that column
  AssertionError: expected [ 'jurisdictionSlug', …(3) ] to include 'verificationStatus'
× treats a trailing column as NOT covered
```

The schema was then restored and `git diff --stat db/schema.prisma` confirmed clean.

**Known limit:** the registry is hand-maintained, so a *newly added* single-column filter is
not auto-discovered. Step 2 of ARCH-19 re-runs the census. The registry is asserted non-empty
and every entry is checked to name a real model field, so it cannot rot silently.

### Verification

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | clean |
| `pnpm lint` | clean |
| `npx vitest run` | **1987 passed / 49 skipped (2036)** — was 1981/49; +6 from the new guard |
| `pnpm db:validate:offline` | schema valid |
| Guard fails on regression | verified above |

### Still open

Unchanged from §5: everything needing a live database (`EXPLAIN ANALYZE`,
`pg_stat_user_indexes`, the latency bench, and the write-cost of the now-seven added
indexes). No further static work remains from either audit's watchlist.
