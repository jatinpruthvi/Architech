-- Listing.transactionType — buy vs rent.
--
-- Why this migration exists: `client/src/lib/repositories/mappers.ts` has read
-- `row.transactionType` since the prisma data mode landed, but the column was
-- never in the schema. The mapper's row type declares the field optional
-- (`transactionType?: string | null`), so the read type-checked, the field was
-- never selected, and the expression
--
--     row.transactionType?.toUpperCase() === "RENT" ? "rent" : "buy"
--
-- evaluated to "buy" for EVERY row. No error, no warning — just a silently
-- wrong answer on every listing. Rental inventory could not be represented at
-- all in prisma mode.
--
-- DEFAULT 'BUY' is the honest backfill, not a convenience: it reproduces
-- exactly what the application already believed about every existing row, so
-- this migration changes no observable behaviour on current data. Rows become
-- RENT only when something explicitly sets them, which is the correct
-- direction — inferring "this looks like a rental" from a price label would be
-- inventing a fact about inventory.

CREATE TYPE "TransactionType" AS ENUM ('BUY', 'RENT');

ALTER TABLE "Listing"
  ADD COLUMN "transactionType" "TransactionType" NOT NULL DEFAULT 'BUY';

-- Partial index rather than a plain one. Rent is expected to be the minority
-- of rows for the foreseeable future, and every rent-scoped query filters on
-- exactly this predicate; indexing only the RENT rows keeps the index small
-- and leaves the (dominant) BUY path to the existing city/locality indexes.
CREATE INDEX "Listing_transactionType_rent_idx"
  ON "Listing" ("cityId", "localityId")
  WHERE "transactionType" = 'RENT';
