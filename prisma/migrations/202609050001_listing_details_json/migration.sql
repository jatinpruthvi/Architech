-- Structured listing details: `Listing.detailsJson JSONB`.
--
-- Until now `bathrooms`, `parkingSpaces`, `furnishing`, `floor`, `facing`
-- and `amenities` had no column of their own. The broker path smuggled them
-- into `sourceSummary` as `JSON.stringify(details)` while the seed and feed
-- paths used the same column as a prose note — one column, two incompatible
-- meanings, and no way to facet on the values in SQL.
--
-- This migration adds the column but deliberately performs NO backfill:
-- legacy rows keep working because the read path (repositories/mappers.ts
-- and persistence/broker-store.ts) prefers `detailsJson` and falls back to
-- the validated prose/JSON scrape of `sourceSummary` only when the column
-- is empty. Backfilling by casting prose strings would be lossy by
-- definition, which is exactly what the contract in
-- `lib/listing-details-contract.ts` forbids.

ALTER TABLE "Listing" ADD COLUMN "detailsJson" JSONB;
