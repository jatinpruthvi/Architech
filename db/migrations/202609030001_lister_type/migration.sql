-- Listing attribution: owner or broker.
--
-- Captured at sign-up on "User" (defaults the listing form) and again on
-- "Listing" (what a buyer is actually shown). The two are separate columns on
-- purpose: a broker may list their own home, and an owner may later appoint an
-- agent, so the per-listing value must be able to differ from the account's.
--
-- This is a SELF-DECLARATION, not a permission. Broker authority continues to
-- come from "User"."role" plus an active "BrokerUser" membership row. Nothing
-- in this migration grants access to anything.

CREATE TYPE "ListerType" AS ENUM ('OWNER', 'BROKER');

-- Existing rows are backfilled to OWNER by the column default. That is the
-- conservative direction: claiming to be an agent is the claim that carries
-- professional weight, so no historical account is credited with it.
ALTER TABLE "User"
    ADD COLUMN "listerType" "ListerType" NOT NULL DEFAULT 'OWNER';

ALTER TABLE "Listing"
    ADD COLUMN "listerType" "ListerType" NOT NULL DEFAULT 'OWNER';

-- Buyers filter on "owner listings only", and the broker workspace already
-- splits agent vs owner inventory, so this is a query dimension rather than a
-- display-only column. Paired with lifecycle because every such query is
-- scoped to live listings.
CREATE INDEX "Listing_listerType_lifecycle_idx" ON "Listing" ("listerType", "lifecycle");
