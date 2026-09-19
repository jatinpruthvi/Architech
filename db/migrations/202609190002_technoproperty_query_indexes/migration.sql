-- Indexes for the TechnoProperty and TechnoContactEvent predicates that are
-- ALREADY EMITTED but unsupported.
--
-- This migration adds no columns and changes no data. Every index below was
-- chosen by reading the queries `src/lib/technoproperty/repository.ts` actually
-- issues (function cited per index, not "the source in general") and diffing
-- those predicates against the indexes created by 202609160001. Nothing
-- speculative is included: an index is here only if a query emits the matching
-- equality prefix / ordering today.
--
-- THE FINDING BEHIND MOST OF THIS FILE
--
-- Three of the five existing TechnoProperty indexes lead with `active`
-- (orgId, active, category, datePosted / orgId, active, isPremium /
-- orgId, active, sourceShortlisted). The *owner-side* list queries built by
-- `buildOwnerWhere()` never constrain `active` — so there the index degrades to
-- an orgId-only prefix scan, and because `active` sits between the equality
-- columns and `datePosted` in the key, the index cannot supply
-- `ORDER BY "datePosted" DESC` either; Postgres sorts the whole org's rows
-- before applying LIMIT/ OFFSET. The indexes below put the columns in the order
-- the queries ask for. (Adding `active` to those queries is NOT the fix here:
-- it would change which rows the owner screens show, and is a product decision.)

-- ---------------------------------------------------------------------------
-- 1. TechnoProperty(orgId, active, firstSeenAt) — the "added" clock.
--
-- getDashboardKpis issues, in parallel:
--   count   { orgId, active, firstSeenAt: { gte: today0 } }
--   count   { orgId, active, firstSeenAt: { gte: yday0, lt: today0 } }
--   groupBy category { orgId, active, firstSeenAt: { gte: today0 } }
--   groupBy category { orgId, active, firstSeenAt: { gte: yday0, lt: today0 } }
--   count   { orgId, active, firstSeenAt: { gte: d15 } }
--
-- and `countMatchesSince` — one call PER SAVED SEARCH, up to
-- SAVED_SEARCH_PAGE_CAP = 20 per My Activities load (listSavedSearches):
--   count   { orgId, active, firstSeenAt: { gte: since }, <category/q/premium/rented> }
--
-- firstSeenAt had no index at all, so every one of those was a scan of the
-- org's active rows: the single most repeated predicate in the workspace.
CREATE INDEX IF NOT EXISTS "TechnoProperty_orgId_active_firstSeenAt_idx"
  ON "TechnoProperty"("orgId", "active", "firstSeenAt");

-- ---------------------------------------------------------------------------
-- 2. TechnoProperty(orgId, active, sourceStatus, datePosted) — what is still
--    "live" and recent.
--
-- getDashboardKpis:
--   count { orgId, active, sourceStatus: "ACTIVE" }                      (activeOwner)
--   count { orgId, active, sourceStatus: "ACTIVE",
--           ownerPhoneLast4: null, datePosted: { gte: daysAgo(2) } }      (freshUnrevealed)
-- countFreshUnrevealed (same shape, plus a NOT EXISTS on contactEvents) — this
-- is the techno LAYOUT badge, so it runs on every broker navigation.
-- getCallingQueue's freshness-window read:
--   findMany { orgId, active, sourceStatus: "ACTIVE",
--              ownerPhoneCipher: { not: null }, datePosted: { gte: since } }
--   ORDER BY "datePosted" DESC  LIMIT 200
-- sourceStatus equality followed by a datePosted range in key order means the
-- queue's ORDER BY ... LIMIT is served by an index scan instead of
-- filter-then-sort-everything.
CREATE INDEX IF NOT EXISTS "TechnoProperty_orgId_active_sourceStatus_datePosted_idx"
  ON "TechnoProperty"("orgId", "active", "sourceStatus", "datePosted");

-- ---------------------------------------------------------------------------
-- 3. TechnoProperty(orgId, category, datePosted) — the paginated owner lists.
--
-- listOwnerProperties (owners, owners/[category], requirements/[category],
-- premium, shortlisted) via buildOwnerWhere: `where` carries orgId plus a
-- category (a single value, or `in [four]`), and the read is always
--   ORDER BY "datePosted" DESC/ASC  OFFSET … LIMIT …
-- never constrained by `active`. Two consequences the old indexes could not
-- serve: the category equality has `active` in front of it, and datePosted is
-- behind `active` too, so the sort + page slice happened over every org row.
--
-- listMatchCandidates is the same shape:
--   { orgId, active, isRentedOut: false, soldOut: false,
--     category: { in: [two] } } ORDER BY "datePosted" DESC LIMIT 300
-- (there the `active` equality is satisfied by the leading columns here only
-- after the category, which is why this index does not replace index 2 — they
-- answer different queries).
CREATE INDEX IF NOT EXISTS "TechnoProperty_orgId_category_datePosted_idx"
  ON "TechnoProperty"("orgId", "category", "datePosted");

-- ---------------------------------------------------------------------------
-- 4. TechnoProperty(orgId, isPremium, datePosted) — the Premium tab.
--
-- listOwnerProperties with premium="1" → { orgId, isPremium: true } ordered by
-- datePosted. Same `active`-in-the-middle problem as index 3, on a different
-- equality column; `category` is NOT constrained on this tab, so index 3
-- cannot stand in for it.
CREATE INDEX IF NOT EXISTS "TechnoProperty_orgId_isPremium_datePosted_idx"
  ON "TechnoProperty"("orgId", "isPremium", "datePosted");

-- ---------------------------------------------------------------------------
-- 5. TechnoContactEvent(orgId, brokerUserId, createdAt) — one broker's history.
--
-- getActivities (recent reveals):   { orgId, brokerUserId, listingType }
--                                   ORDER BY "createdAt" DESC LIMIT 8
-- getCallingQueue (follow-up log):  { orgId, brokerUserId, outcome }
--                                   ORDER BY "createdAt" DESC LIMIT 1000
--
-- The existing indexes key on (orgId, createdAt) and (brokerUserId, createdAt)
-- — single-tenant / cross-tenant respectively. Neither gives the combination
-- these two reads use, so with (orgId, createdAt) Postgres walks the org's
-- events newest-first and FILTERS by broker until it has 8 (the LIMIT only
-- applies after the filter), and the follow-up read can stop early only by
-- luck. Both are equality on exactly the first two columns of this key.
CREATE INDEX IF NOT EXISTS "TechnoContactEvent_orgId_brokerUserId_createdAt_idx"
  ON "TechnoContactEvent"("orgId", "brokerUserId", "createdAt");

-- ---------------------------------------------------------------------------
-- CONSIDERED AND DELIBERATELY NOT ADDED
--
-- * TechnoProperty(orgId, sourceShortlisted) and a second arm for the
--   "Important" tab (OR sourceShortlisted / category = IMPORTANT). That tab
--   would want a bitmap OR over two indexes; index 3 covers the category arm,
--   and the sourceShortlisted arm is a small boolean slice of one org. Adding a
--   fifth btree to TechnoProperty for it is not justified without EXPLAIN data.
-- * A covering index on (orgId, active, firstSeenAt, category) to make the two
--   grouped "added" counts index-only scans. The range on firstSeenAt already
--   narrows enough that the heap fetch is cheap; revisit with measured plans.
-- * Partial indexes (… WHERE active), which would shrink the keys but cannot be
--   expressed in schema.prisma's @@index and would need hand-written SQL that
--   Prisma's migration diff would later try to revert.
-- * The five GIN trigram indexes in section 6 are the one exception to the
--   "declared in schema.prisma" rule: Prisma's @@index cannot express
--   `USING GIN (col gin_trgm_ops)` (the same reason 202608240002 and
--   202609070003 are hand-written). They are pinned by
--   src/lib/technoproperty/index-coverage.test.ts instead.
--
-- NOTE ON WRITE COST: TechnoProperty is crawler-fed, so each index here is paid
-- for on every inserted/updated row. That is the trade this migration accepts,
-- on the reasoning that the reads above are per-navigation and per-badge while
-- the crawler writes in batches; if a future crawl profile shows otherwise, the
-- indexes are individually droppable without touching application code.

-- ---------------------------------------------------------------------------
-- 6. Trigram indexes for the broker workspace's search haystacks.
--
-- buildOwnerWhere() emits, when a broker types a search term (owners, owners/
-- [category], premium, requirements/[category], shortlisted — every "?q=" page):
--
--     OR address       ILIKE '%' || $1 || '%'
--     OR premiseName   ILIKE '%' || $1 || '%'
--     OR descriptionRaw ILIKE '%' || $1 || '%'
--     OR ownerName     ILIKE '%' || $1 || '%'
--     OR ownerPhoneLast4 LIKE '%' || $1 || '%'
--     OR area          ILIKE '%' || $1 || '%'
--
-- and listBrokerProperties emits the premiseName/address/area subset. A leading
-- wildcard matches no btree index, and because these predicates sit in an OR
-- chain, ONE unindexed arm forces a sequential scan of the whole predicate —
-- partial coverage would buy nothing. The same audit that put trigram indexes
-- on Listing/City/LocalityAlias (202608240002, 202609070003) never covered the
-- Techno properties, so every such search is a full scan with six ILIKEs per
-- row today. pg_trgm is already installed (202608240002).
--
-- ownerPhoneLast4 is deliberately NOT indexed here: it is VarChar(4), so a
-- trigram index on it would match a large fraction of the table and the planner
-- would (correctly) prefer a filter. That arm stays a filter; the working
-- equality path for that column is the existing
-- TechnoProperty_orgId_ownerPhoneLast4_idx.
CREATE INDEX IF NOT EXISTS "TechnoProperty_address_trgm_idx"
  ON "TechnoProperty" USING GIN ("address" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "TechnoProperty_premiseName_trgm_idx"
  ON "TechnoProperty" USING GIN ("premiseName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "TechnoProperty_area_trgm_idx"
  ON "TechnoProperty" USING GIN ("area" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "TechnoProperty_ownerName_trgm_idx"
  ON "TechnoProperty" USING GIN ("ownerName" gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "TechnoProperty_descriptionRaw_trgm_idx"
  ON "TechnoProperty" USING GIN ("descriptionRaw" gin_trgm_ops);
