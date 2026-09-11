-- Query-shape indexes for broker worklists and locality freshness filters.
CREATE INDEX IF NOT EXISTS "Listing_cityId_localityId_lifecycle_meaningfulUpdatedAt_idx"
  ON "Listing" ("cityId", "localityId", "lifecycle", "meaningfulUpdatedAt");

CREATE INDEX IF NOT EXISTS "Listing_brokerOrgId_lifecycle_updatedAt_idx"
  ON "Listing" ("brokerOrgId", "lifecycle", "updatedAt");
