-- Bug-fix migration: saved-search dedupe/sort, authority registry tables,
-- and schema drift for the generated search vector.

-- SavedSearch: the Prisma path previously dropped `sort` and had no duplicate
-- detection. `dedupeKey` is the canonical identity written by the app; the
-- unique index makes a concurrent repeat-save race-safe.
ALTER TABLE "SavedSearch" ADD COLUMN "sort" TEXT;
ALTER TABLE "SavedSearch" ADD COLUMN "dedupeKey" TEXT;

-- Backfill existing demo rows so the column can be NOT NULL.
UPDATE "SavedSearch"
SET "dedupeKey" = coalesce("query", '') || '::' || coalesce("filters"::text, '') || '::'
WHERE "dedupeKey" IS NULL;

ALTER TABLE "SavedSearch" ALTER COLUMN "dedupeKey" SET NOT NULL;
CREATE UNIQUE INDEX "SavedSearch_dedupeKey_key" ON "SavedSearch"("dedupeKey");
CREATE INDEX "SavedSearch_sort_idx" ON "SavedSearch"("sort");

-- Authority asset & outreach registry (ARCHITECH_AUTHORITY_STORAGE=prisma).
-- `type` / `outcome` / `disclosure` are application-vocabulary codes kept as
-- TEXT so they can grow without an enum migration (see schema.prisma).
CREATE TABLE "AuthorityAsset" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT,
    "isNofollow" BOOLEAN NOT NULL DEFAULT true,
    "paidForLink" BOOLEAN NOT NULL DEFAULT false,
    "disclosure" TEXT NOT NULL DEFAULT 'required',
    "relationshipRegistry" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AuthorityAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuthorityOutreach" (
    "id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "target" TEXT NOT NULL,
    "assetId" TEXT,
    "outcome" TEXT NOT NULL,
    "reviewedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuthorityOutreach_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuthorityAsset_type_idx" ON "AuthorityAsset"("type");
CREATE INDEX "AuthorityOutreach_assetId_idx" ON "AuthorityOutreach"("assetId");
CREATE INDEX "AuthorityOutreach_date_idx" ON "AuthorityOutreach"("date");

-- Foreign key: an outreach references the asset it was sent about; deleting
-- the asset must not destroy the outreach history.
ALTER TABLE "AuthorityOutreach"
    ADD CONSTRAINT "AuthorityOutreach_assetId_fkey"
    FOREIGN KEY ("assetId") REFERENCES "AuthorityAsset"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Listing.searchVector is a generated tsvector column created by the
-- 202608240002_search_indexes raw migration. It is now declared in
-- schema.prisma as Unsupported("tsvector")? (Prisma cannot express generated
-- expressions); this guard keeps the column alive if the table is recreated.
ALTER TABLE "Listing" ADD COLUMN IF NOT EXISTS "searchVector" tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("addressLocality", '')), 'C') ||
    setweight(to_tsvector('english', coalesce("availability", '')), 'D')
  ) STORED;

CREATE INDEX IF NOT EXISTS "Listing_searchVector_idx"
  ON "Listing" USING GIN ("searchVector");
