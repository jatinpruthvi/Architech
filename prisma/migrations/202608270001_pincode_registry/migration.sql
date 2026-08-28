-- Pincode-aware place registry.
--
-- India Post PIN codes are stored as arrays on both sides because the
-- relationship is many-to-many: one locality can span several PINs and one PIN
-- can cover several localities. PINs are a query dimension only; canonical URLs
-- remain slug-based.

ALTER TABLE "City" ADD COLUMN "pincodePrefixes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Locality" ADD COLUMN "pincodes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Listing" ADD COLUMN "postalCode" TEXT;

-- GIN index so `WHERE pincodes @> ARRAY['380007']` is an index scan rather than
-- a sequential scan over every locality in the country.
CREATE INDEX "Locality_pincodes_idx" ON "Locality" USING GIN ("pincodes");

-- Listing lookups by PIN are always scoped to live listings.
CREATE INDEX "Listing_postalCode_lifecycle_idx" ON "Listing" ("postalCode", "lifecycle");
