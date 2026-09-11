-- Widen Listing.priceInr from Int32 to BigInt.
--
-- WHY: "Listing"."priceInr" was integer, which caps at 2,147,483,647 —
-- about ₹214 crore. That is not a theoretical limit: commercial property and
-- land transactions reach it, and an overflow is a hard INSERT failure that
-- rejects a legitimate listing rather than a value that merely rounds badly.
--
-- It also matters for the broker channel. "ChannelRequest"."priceInr" and the
-- budget columns are specified as BigInt, and they are populated from this
-- column via sourceListingId. Mixing widths on a field that ultimately feeds a
-- financial sync into ERPNext invites silent coercion bugs, so the source and
-- the destination should agree before that path is built.
--
-- SAFETY: integer -> bigint is a widening conversion. Every existing value is
-- representable, so PostgreSQL performs it without data loss and without a
-- USING clause. No backfill is required.
--
-- LOCKING: this is an ALTER TABLE ... TYPE, which takes an ACCESS EXCLUSIVE
-- lock and rewrites the table. On PostgreSQL 17 there is no optimisation that
-- avoids the rewrite for int->bigint, because the on-disk width genuinely
-- changes. At current table size this is fast; if "Listing" grows large before
-- this ships to production, run it in a maintenance window rather than
-- assuming it is instant.

ALTER TABLE "Listing"
    ALTER COLUMN "priceInr" TYPE BIGINT;

-- The existing price index is rebuilt automatically by the type change, so no
-- explicit DROP/CREATE INDEX is needed here.
