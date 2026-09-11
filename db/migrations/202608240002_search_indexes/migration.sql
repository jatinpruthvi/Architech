-- Phase 1 search foundation: PostgreSQL full-text search and trigram indexes.
-- Safe to run after the Prisma-created Listing/Locality tables exist.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TABLE "Listing"
  ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("addressLocality", '')), 'C') ||
    setweight(to_tsvector('english', coalesce("availability", '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Listing_searchVector_idx"
  ON "Listing" USING GIN ("searchVector");

CREATE INDEX IF NOT EXISTS "Listing_title_trgm_idx"
  ON "Listing" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Listing_description_trgm_idx"
  ON "Listing" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Listing_addressLocality_trgm_idx"
  ON "Listing" USING GIN ("addressLocality" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "Locality_name_trgm_idx"
  ON "Locality" USING GIN ("name" gin_trgm_ops);
