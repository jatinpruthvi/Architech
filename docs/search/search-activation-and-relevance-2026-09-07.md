# Search activation, text configuration, and relevance ordering

**Date:** 7 Sep 2026
**Scope:** activate and measure the existing SQL search path; fix the full-text
configuration; add a relevance sort; fix a sandbox provisioning defect found
while doing so. No new runtime dependencies, no new infrastructure, no new
service.

This document records what was *measured*, not what was expected. Two of the
conclusions contradict the recommendation that prompted the work, and the
contradictions are kept here on purpose.

---

## 1. Activation and baseline measurement

The repository already shipped `pg_trgm`, a weighted generated `tsvector`, GIN
indexes, an SQL narrowing path, a full SQL page path, a 45-scenario parity
matrix and a latency bench — all behind `ARCHITECH_SEARCH_SQL_NARROW` /
`ARCHITECH_SEARCH_SQL_PAGE`, and none of it had ever been run against a real
database in this workspace. Both gates default to `off`, so the standing state
was "believed to work".

A live PostgreSQL cluster was provisioned (`pnpm db:setup:sandbox`), all 17
migrations applied, and three databases created: the main sandbox, a parity
database, and a throwaway bench database.

> **A sandbox defect found and fixed along the way.**
> `scripts/sandbox/setup-local-db.mjs` decided whether to stub migrations from
> a *single* `hasPostGis()` probe — and that one boolean gated the `pg_trgm`
> stubs too. PostGIS and `pg_trgm` are unrelated extensions, and the embedded
> server ships `pg_trgm` (1.6) but not PostGIS, so **every sandbox database
> silently skipped `CREATE EXTENSION pg_trgm` and all four trigram indexes on
> a server that could have had them.**
>
> The failure was quiet and expensive: the trigram predicates and the `%`
> similarity operator were never exercised, so a sandbox looked like a working
> search environment while testing something weaker than production. The
> script now probes each extension independently and stubs only what is
> genuinely missing. Verified from scratch: a clean run reports *"missing:
> postgis"* only, installs `pg_trgm` + `unaccent`, creates all four trigram
> indexes, and passes 48/48 parity with no manual steps.
>
> The first measurements below were taken after applying `pg_trgm` by hand;
> they are reproducible now without that workaround.

### Parity: 45/45, then 48/48

```
ARCHITECH_PARITY_DATABASE_URL=... pnpm vitest run \
  client/src/lib/search/sql-page-integration.test.ts
```

45/45 passed on first run — the SQL page path returns byte-identical wire JSON
to the JS path across every predicate shape. Three relevance scenarios were
added later, taking it to **48/48**.

### Latency: the SQL path is ~7x faster

5,200-row dataset, 5,000 read at the ceiling, p50/p95 over 21 runs, warm-up
excluded:

| Scenario | p50 | p95 |
|---|---|---|
| JS bare nationwide (5,000 rows, facet counts) | 266.6 ms | 304.5 ms |
| JS nationwide + free text | 257.0 ms | 294.4 ms |
| JS city + query + bhk + price | 236.0 ms | 279.9 ms |
| **SQL bare nationwide (page path)** | **27.8 ms** | **30.5 ms** |
| **SQL nationwide + free text (page path)** | **42.8 ms** | **59.6 ms** |

**Recommendation:** enable `ARCHITECH_SEARCH_SQL_PAGE=on` in any environment
whose Postgres has the search migrations applied. The evidence for it now
exists; the fallback remains fail-closed and logged.

---

## 2. Text configuration: `english` alone was losing real queries

### What was actually wrong (measured, not assumed)

1. **Stopword erasure.** The `english` dictionary erases 37 of the short tokens
   tested, including real Indian place-name components. `to_tsvector('english',
   'Do Talao')` is `'talao':2` — the token `Do` is gone. Same for `Am Bagh`.
   A locality composed entirely of such words indexes to the empty vector.
2. **No unaccent.** `to_tsvector('english','Paldi') @@
   websearch_to_tsquery('english','pāldi')` is **false**.
3. **Hindi was never indexed at all.** The original generated column covered
   `title`, `description`, `addressLocality`, `availability`. The real,
   populated `titleHi` and `descriptionHi` columns were absent, so Devanagari
   full-text search matched nothing under *any* configuration.

### The correction to the original advice

The earlier recommendation was "switch `english` → `simple` + unaccent". Testing
shows that trade is **not free**: under `simple`, the query `garden` no longer
matches the document `Thaltej Gardens`, because nothing stems. That is a real
recall loss in the opposite direction.

Migration `202609070001_search_text_config` therefore indexes each field under
**both** configurations — a union vector — rather than replacing one with the
other:

- `english` — stemming, so `garden` still finds `Gardens`.
- `architech_simple` (`simple` + `unaccent`) — verbatim and diacritic-insensitive,
  so `Do Talao`, `pāldi`, and Devanagari all survive.

Measured on real rows with the real GIN index:

| Query | Old (`english` only) | New (union) |
|---|---|---|
| `do` (→ "Do Talao heritage rowhouse") | **no match** | match |
| `pāldi` (→ "Paldi riverside") | **no match** | match |
| `थलतेज` (→ Hindi `titleHi`) | **no match** | match |
| `garden` (→ "Thaltej Gardens duplex") | match | match |
| `gardens`, `heritage` | match | match |

**Three recoveries, zero regressions.** Field weights (A/B/C/D) are preserved
exactly, which the ranking in §3 depends on.

`client/src/lib/search/sql.ts` now exposes `FTS_CONFIGS` and `ftsMatchSql()` so
both the narrow path and the page path ask both configurations from one
definition, and `db-schema.test.ts` fails the build if the migration and the
code list ever drift apart.

---

## 3. Relevance ordering (`ts_rank_cd`)

The sort vocabulary was `fresh | price-asc | price-desc`. Someone typing
`thaltej garden duplex` was getting results ordered by *edit date*.
`search.ts` carried a standing note that relevance was deliberately not
advertised because `applySort` had no scoring — this work supplies the scoring
rather than removing the note's premise.

- **SQL path** — `ts_rank_cd('{0.1,0.2,0.4,1.0}', searchVector, <union tsquery>)`,
  the weight array mirroring the D/C/B/A `setweight` labels.
- **JS path** — `client/src/lib/search/relevance.ts`, scoring the same weighted
  fields so the fallback answers the same question.
- Both tie-break on read order (`fresh`), then `id`, giving a total, stable
  order so a page boundary cannot duplicate or drop a row.
- With no residual query tokens both degrade to the read order. `relevance`
  is only offered in the UI when query text exists, and a `?sort=relevance`
  URL whose query is cleared falls back to `fresh` — an option that silently
  means "freshest" is a lie the sort menu should not tell.

### The parity matrix caught a real bug

The first JS implementation scored `max(weight)` per token. Postgres does not:
`ts_rank_cd` is **linear in term frequency** (measured — a title containing
`garden` three times scores 8.4 against 2.0 for one clean title hit). With the
max-based scorer, SQL ordered `rel-c, rel-a, rel-b` while JS ordered
`rel-a, rel-b, rel-c`: two different answers to the same question, exactly the
failure the matrix exists to prevent. The scorer was rewritten to count
occurrences, after which both paths agree.

That behaviour is now pinned by a unit test (`relevance.test.ts`, 10 tests) and
three live parity scenarios, so a future "simplification" back to a boolean
scorer fails the build.

---

## 4. Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | pass |
| `eslint app client/src` | pass, 0 warnings |
| `prisma validate` | pass |
| Unit tests | **1,807 passed**, 2 skipped (live-only suites) |
| Live parity matrix | **48/48** |
| Migrations from scratch | **18/18** applied on a clean database |
| Production build (`build:ci`) | pass |
| SEO smoke | pass — 19 routes, 7 sitemaps |
| Crawl simulation | pass — 163 pages, 47 sitemap URLs, no broken links, self-canonicals hold |
| Surface contrast audit | pass |
| Security / legal / ops / release / provisioning audits | pass |
| End-to-end | 134 pass; 2 pre-existing failures (see below) |
| Latency bench | re-run; see below |

### The two end-to-end failures are pre-existing and environmental

`broker channel journey` fails two checks on requirement storage (503). Both
were confirmed pre-existing by re-running the suite with this entire change set
stashed — identical failures. The cause is not a code defect: durable
requirement capture requires `ARCHITECH_CONTACT_ENCRYPTION_KEY` (a canonical
base64 32-byte key) because `Requirement.phoneCiphertext` is an encrypted
envelope enforced by a CHECK constraint
(`octet_length BETWEEN 40 AND 47` with a fixed 4-byte header). The E2E harness
does not supply that key to the server it spawns, so the route **fails closed
with 503 rather than storing an unencrypted phone number** — the designed
behaviour. Fixing it belongs to the E2E harness environment, not to search.

### On the bench's wire-hashes

The bench prints a SHA-256 of each scenario's wire JSON as a "same output"
proof. Two free-text hashes moved. Investigated rather than waved through: the
wire JSON includes `queryPlan`, a **descriptive artefact** (the SQL text the
plan builder would emit), and its string now shows the union tsquery. Re-hashing
every response with `queryPlan` removed gives **identical hashes before and
after** on all five scenarios, and the free-text result count is unchanged (623
JS / 626 SQL). The caveat is now documented in the bench header so the next
person does not repeat the investigation.

---

## 5. What was deliberately *not* done

- **ParadeDB / `pg_search`.** Recommended elsewhere as a `CREATE EXTENSION` on
  the existing database. It is not: `pg_search` must be loaded via
  `shared_preload_libraries`, which a managed Postgres does not permit, and on
  Railway it ships as a **separate Docker image**. Adopting it means moving the
  database that must also host PostGIS, pgvector, 18 migrations and RLS
  policies — the highest-risk item on the list, labelled zero-cost. Revisit at
  Phase 2 scale, behind the `ListingSearchProvider` seam the architecture
  already mandates, off by default, with the parity matrix as its acceptance
  test.
- **Client-side search libraries** (FlexSearch, Orama, Fuse.js, MiniSearch).
  `suggest.ts` + `text-match.ts` already rank exact → prefix → word-prefix →
  substring → bounded typo, fold Devanagari, resolve PINs, and derive popular
  queries from live inventory with real counts. Adding a second fuzzy
  implementation would make the dropdown and the results disagree, and would be
  paid for out of the CI-enforced JS bundle budget. Suggestions are currently a
  cached HTTP call costing ~0 KB of client JS.
- **Pagefind.** Right tool, no corpus: there are **7** guides. Revisit at
  ~150 content pages.
- **Benchmarking relevance quality on generated data.** Every listing outside
  Ahmedabad is deterministic demo data from `property-generator.ts`. Comparing
  BM25 against `ts_rank_cd` on synthetic titles would measure the generator,
  not the ranking. The honest re-measure point (step 4) is after real inventory
  exists.

---

## 6. Operator notes

Enabling on an environment that already has the migrations:

```bash
ARCHITECH_SEARCH_SQL_PAGE=on     # DB-side filtering, pagination, facet counts
ARCHITECH_SEARCH_SQL_NARROW=on   # candidate narrowing (independent flag)
```

Both fail closed: any SQL error is logged (`search.sql_page_failed`,
`search.sql_narrow_failed`) and the JS path serves. Re-run the proofs with:

```bash
ARCHITECH_PARITY_DATABASE_URL=postgres://... \
  pnpm vitest run client/src/lib/search/sql-page-integration.test.ts

ARCHITECH_BENCH_DATABASE_URL=postgres://... \
  pnpm vitest run client/src/lib/search/latency-bench.test.ts
```

The migration is additive and idempotent in effect: it drops and recreates the
generated column and its index. On a large table that rewrite is not free —
schedule it like any other column rewrite.
