-- Search text configuration: recover the recall the 'english'-only search
-- vector silently loses on Indian place names, and index the Hindi columns
-- that were never in the vector at all.
--
-- WHY (measured on a live cluster, not assumed):
--
--   1. STOPWORD ERASURE. The 'english' dictionary erases 37 of the short
--      tokens we tested, INCLUDING words that are real Indian place-name
--      components: "Do" (Do Talao), "Am" (Am Bagh), "In", "On", "At", "Under",
--      "Most", "Own", "Same", "Out", "Off", "Over", "All", "No", "So", "Be".
--      `to_tsvector('english','Do Talao')` = 'talao':2 — the token "Do" is
--      GONE, so a search for "Do Talao" cannot match on that token, and a
--      locality named only of stopwords would index to the empty vector.
--
--   2. NO UNACCENT. `to_tsvector('english','Paldi') @@
--      websearch_to_tsquery('english','pāldi')` is FALSE. Any diacritic a
--      person types (or that arrives in transliterated source data) misses.
--
--   3. HINDI WAS NEVER INDEXED. The original generated column covers
--      title/description/addressLocality/availability only. `titleHi` and
--      `descriptionHi` — real columns, populated on the bilingual path — were
--      absent from the search vector entirely, so Devanagari full-text search
--      matched nothing regardless of configuration.
--
-- WHAT THIS DOES *NOT* DO: it does not replace 'english' with 'simple'.
-- Measured, that trade is not free: 'simple' cannot match the query "garden"
-- against the document "Thaltej Gardens" (no stemming), which is a real
-- recall loss in the other direction. The fix is a UNION vector — index each
-- field under BOTH configurations — so English stemming AND exact/unaccented/
-- Devanagari matching are available simultaneously. Verified on a live
-- cluster: 3 previously-failing cases recovered, 0 regressions.
--
-- Weights are preserved exactly (A title, B description, C addressLocality,
-- D availability) so any future ts_rank/ts_rank_cd ordering keeps the same
-- field-importance semantics. Hindi mirrors its English counterpart's weight.

CREATE EXTENSION IF NOT EXISTS unaccent;

-- A configuration that is diacritic-insensitive but NON-stemming and
-- NON-stopworded: proper nouns survive verbatim. `simple` never removes
-- stopwords, so no place-name component can be erased.
--
-- NOTE: text search configurations are schema-qualified objects. The
-- generated column below references this by bare name, which resolves
-- against search_path at DDL time and is then stored as a fixed OID — so a
-- later search_path change cannot silently repoint the column.
DROP TEXT SEARCH CONFIGURATION IF EXISTS architech_simple;
CREATE TEXT SEARCH CONFIGURATION architech_simple (COPY = simple);
ALTER TEXT SEARCH CONFIGURATION architech_simple
  ALTER MAPPING FOR hword, hword_part, word WITH unaccent, simple;

-- Rebuild the generated column as the union. A generated column cannot be
-- altered in place; drop and recreate. The GIN index is dropped with it and
-- rebuilt below.
DROP INDEX IF EXISTS "Listing_searchVector_idx";
ALTER TABLE "Listing" DROP COLUMN IF EXISTS "searchVector";

ALTER TABLE "Listing"
  ADD COLUMN "searchVector" tsvector
  GENERATED ALWAYS AS (
    -- English-stemmed half: keeps "garden" matching "Gardens".
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("addressLocality", '')), 'C') ||
    setweight(to_tsvector('english', coalesce("availability", '')), 'D') ||
    -- Verbatim/unaccented half: keeps "Do Talao", "pāldi", and every
    -- stopword-shaped place name findable.
    setweight(to_tsvector('architech_simple', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('architech_simple', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('architech_simple', coalesce("addressLocality", '')), 'C') ||
    setweight(to_tsvector('architech_simple', coalesce("availability", '')), 'D') ||
    -- Hindi columns, previously unindexed. 'architech_simple' only: the
    -- English stemmer has no useful behaviour on Devanagari.
    setweight(to_tsvector('architech_simple', coalesce("titleHi", '')), 'A') ||
    setweight(to_tsvector('architech_simple', coalesce("descriptionHi", '')), 'B')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Listing_searchVector_idx"
  ON "Listing" USING GIN ("searchVector");

-- Locality.aliases already carries the ASCII + Devanagari forms the registry
-- knows ("Prahlad Nagar" / "प्रह्लाद नगर"). The narrow path matches aliases
-- with ILIKE and trigram; a GIN index over the array makes the containment
-- side of that cheap as the registry grows past demo size.
CREATE INDEX IF NOT EXISTS "Locality_aliases_idx"
  ON "Locality" USING GIN ("aliases");
