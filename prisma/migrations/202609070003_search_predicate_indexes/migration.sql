-- Indexes for search predicates that are ALREADY EMITTED but unsupported.
--
-- This migration adds no columns and changes no data. Every index below was
-- chosen by reading the SQL the query builders actually emit (captured by
-- executing buildSqlNarrowPlan / buildSqlPagePlan, not by reading the source)
-- and diffing those predicates against the indexes that exist. Nothing
-- speculative is included: an index is here only if a hot query emits the
-- matching operator today.
--
-- ---------------------------------------------------------------------------
-- 1. City."name" trigram — the missing half of a pair.
--
-- buildSqlNarrowPlan emits, once PER RESIDUAL TOKEN:
--
--     OR locality."name" % $n
--     OR city."name"     % $n
--
-- `Locality_name_trgm_idx` (202608240002) supports the first line. There has
-- never been a trigram index on City."name", so the second line has always
-- been a sequential scan of City with a per-row similarity() computation —
-- and because it sits in an OR chain, Postgres cannot satisfy the chain from
-- the Locality index alone. The pair was written as symmetric; only one side
-- was ever indexed. `%` requires gin_trgm_ops specifically — no btree index
-- (and City."name" has none either) can serve it.
--
-- City is small today, which is exactly why this never showed up in a test:
-- a sequential scan of a handful of cities is instant on fixtures. The cost
-- is per-token, per-search, and grows with the city table.
CREATE INDEX IF NOT EXISTS "City_name_trgm_idx"
  ON "City" USING GIN ("name" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 2. Listing."titleHi" / "descriptionHi" / "note" trigram — ILIKE '%...%'
--    haystack columns with no index of any kind.
--
-- NARROW_HAYSTACK_SQL_TARGETS (lib/search/sql.ts) lists nine ILIKE targets.
-- 202608240002 indexed three of them (title, description, addressLocality)
-- back when those were the whole haystack. The haystack has since grown the
-- bilingual columns and `note`, and the index set was never extended, so
-- three of the nine alternatives force a scan.
--
-- A leading-wildcard ILIKE is unindexable by btree BUT IS indexable by a GIN
-- trigram index — that is precisely what gin_trgm_ops exists for, and it is
-- the same mechanism already relied on for `title`. Adding these makes the
-- ILIKE chain uniformly supported instead of three-ninths supported.
--
-- propertyType is deliberately EXCLUDED: it is a low-cardinality enum-like
-- column where a trigram index would cost writes and win nothing.
CREATE INDEX IF NOT EXISTS "Listing_titleHi_trgm_idx"
  ON "Listing" USING GIN ("titleHi" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Listing_descriptionHi_trgm_idx"
  ON "Listing" USING GIN ("descriptionHi" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Listing_note_trgm_idx"
  ON "Listing" USING GIN ("note" gin_trgm_ops);

-- ---------------------------------------------------------------------------
-- 3. LocalityAlias."normalizedName" trigram — replacing an index that could
--    never apply (QP-19-004).
--
-- `Locality_aliases_idx` (202609070001) is GIN over the `aliases` text[]
-- column. Its comment claims it makes the alias match cheap as the registry
-- grows, but the query it was written for was
--
--     EXISTS (SELECT 1 FROM unnest(locality."aliases") AS alias
--             WHERE alias ILIKE $n ESCAPE '\' OR alias % $n)
--
-- and a plain array GIN index serves array CONTAINMENT operators (@>, &&,
-- = ANY) — it cannot serve ILIKE or `%` applied to elements after unnest(),
-- because unnest() is an opaque set-returning function to the planner. Both
-- alternatives were therefore unindexable and the array was scanned per row.
--
-- The predicate now matches the normalised LocalityAlias table instead (see
-- lib/search/sql.ts), which this index makes sargable for the `%` operand and
-- the leading-wildcard ILIKE alike.
--
-- WHY THE REWRITE IS RECALL-SAFE (it widens, never narrows): LocalityAlias is
-- a strict superset of the legacy array. Migration 202608300002 backfilled it
-- with a CROSS JOIN LATERAL UNNEST(locality."aliases") as type SEARCH, on top
-- of the OFFICIAL name and the TRANSLITERATION hindiName, and prisma/seed.mjs
-- continues to write both representations. The alternative is OR'd into a
-- candidate SUPERSET that the unchanged JS filter then narrows, so widening
-- the candidate pool cannot change which rows the caller returns.
CREATE INDEX IF NOT EXISTS "LocalityAlias_normalizedName_trgm_idx"
  ON "LocalityAlias" USING GIN ("normalizedName" gin_trgm_ops);

-- `Locality_aliases_idx` is intentionally LEFT IN PLACE. It is not dead: the
-- array column is still written by the seed and still read by the location
-- import reconciliation, and array-containment lookups against it remain
-- servable. Dropping it is a separate decision from fixing the search
-- predicate, and this migration does not make it.

-- ---------------------------------------------------------------------------
-- 4. Leftmost-column indexes for two single-column filters (W1, W2).
--
-- Carried over from the watchlist of docs/ai/sql-perf-bug-hunt-2026-09-06.md,
-- where both were deferred for one reason: "sandbox cannot run prisma validate
-- (engine download TLS-blocked), and ARCH-17 step 6 forbids unverifiable
-- migrations". That blocker is gone -- `pnpm db:validate:offline` (the
-- schema-engine shim) validates the schema without network egress, so these
-- are now verifiable in-sandbox and ship here.
--
-- Both are instances of ONE mistake: a composite index is only usable for a
-- filter if the filtered column is the LEFTMOST one. A query filtering on a
-- column that sits second in every existing index gets no index at all.
--
-- W1 -- getModerationQueueForServer (lib/persistence/broker-store.ts):
--
--     findMany({ where: { lifecycle: "IN_REVIEW" },
--                orderBy: { updatedAt: "asc" }, take: 500 })
--
-- Listing has six lifecycle indexes -- (cityId, lifecycle), (localityId,
-- lifecycle), (postalCode, lifecycle), (listerType, lifecycle), (brokerOrgId,
-- lifecycle, updatedAt), (cityId, localityId, lifecycle, meaningfulUpdatedAt)
-- -- and lifecycle is a TRAILING column in every one, so a lifecycle-only
-- filter can use none of them. This is a sequential scan of the whole Listing
-- table on the path brokers wait on. The existing take: 500 cap bounds MEMORY,
-- not scan cost -- the scan still reads every row to find the matching ones.
--
-- updatedAt is included as the second column so the FIFO ordering is served by
-- the same index, making the read an index scan rather than a scan plus sort.
CREATE INDEX IF NOT EXISTS "Listing_lifecycle_updatedAt_idx"
  ON "Listing" ("lifecycle", "updatedAt");

-- W2 -- refreshStaleReraRecordsForServer (lib/persistence/rera-store.ts):
--
--     findMany({ where: { verificationStatus: "STALE" },
--                orderBy: { updatedAt: "asc" }, take: 10 })
--
-- Both ReraRecord indexes -- (jurisdictionSlug, verificationStatus) and
-- (state, verificationStatus) -- have verificationStatus SECOND.
--
-- HONEST SCOPE: the source audit called this impact "negligible at take: 10",
-- and that assessment stands -- a small LIMIT on a small table is cheap even
-- scanned. It ships because it is the identical defect to W1 and costs one
-- statement, NOT because it was independently justified by measurement. As
-- ReraRecord grows with real registry data the scan grows with it while the
-- LIMIT does not.
CREATE INDEX IF NOT EXISTS "ReraRecord_verificationStatus_updatedAt_idx"
  ON "ReraRecord" ("verificationStatus", "updatedAt");
