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
-- WHAT THIS MIGRATION DELIBERATELY DOES NOT DO
--
-- `Locality_aliases_idx` (202609070001) is GIN over the text[] column. Its
-- migration comment claims it makes the alias match cheap "as the registry
-- grows", but the query it was written for is
--
--     EXISTS (SELECT 1 FROM unnest(locality."aliases") AS alias
--             WHERE alias ILIKE $n ESCAPE '\' OR alias % $n)
--
-- and a plain array GIN index serves array CONTAINMENT operators (@>, &&, =
-- ANY) — it cannot serve ILIKE or `%` applied to elements after unnest(),
-- because unnest() is an opaque set-returning function to the planner. That
-- index is therefore not doing the job its comment describes.
--
-- The honest fix is a rewrite of the predicate (or a normalised alias table
-- with its own trigram index — LocalityAlias already exists and carries
-- normalizedName). That is a recall-affecting change to the superset
-- guarantee, so it is NOT bundled into an index-only migration; it is
-- recorded in the audit report's watchlist for review instead. Shipping an
-- index that silently does not apply is how the current gap happened.
