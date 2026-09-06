-- Saved-search alert outbox (cost-reduction-audit P1.6).
--
-- Saved-search alerts used to fire one Resend email per (listing, saved
-- search) pair the moment a listing was published — a bursty, unbounded send
-- pattern whose cost scales with both inventory turnover and the number of
-- watchers. This table makes alerting digest-able and quotable:
--
--   * Every matched (listing, saved search) pair enqueues ONE row,
--     idempotently keyed like the Resend send itself
--     (`<stableId>:<savedSearchId>`), so a repeated publish event cannot
--     double-queue.
--   * In `digest` mode the rows stay PENDING until the daily platform cron
--     (/api/internal/scheduled/saved-search-alert-digest) groups them per
--     user and mails ONE digest per watcher instead of N per-match emails.
--   * In `per_match` mode the rows are still written (this is the durable
--     send log the quota counts against) and the send happens immediately,
--     suppressed when the watcher's daily limit is already used.
--
-- Statuses:
--   PENDING    queued, not yet mailed (digest mode backlog)
--   SENT       mailed (sentAt set) — counted by the daily quota
--   SUPPRESSED over the per-user daily limit in per_match mode; no send
--
-- Buyer PII note: `email` is the consented watcher address (the row exists
-- only because notify:true was opted into) and `userId` references the
-- owning account. Nothing here is cross-tenant: the table is not
-- RLS-covered, like SavedSearch itself.

CREATE TYPE "AlertOutboxStatus" AS ENUM ('PENDING', 'SENT', 'SUPPRESSED');

CREATE TABLE "SavedSearchAlertOutbox" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "savedSearchId" TEXT NOT NULL,
    "stableId" TEXT NOT NULL,
    "listingTitle" TEXT NOT NULL,
    "listingPrice" TEXT,
    "localitySlug" TEXT,
    "citySlug" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "status" "AlertOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SavedSearchAlertOutbox_idempotencyKey_key" UNIQUE ("idempotencyKey")
);

CREATE INDEX "SavedSearchAlertOutbox_status_createdAt_idx" ON "SavedSearchAlertOutbox"("status", "createdAt");
CREATE INDEX "SavedSearchAlertOutbox_email_sentAt_idx" ON "SavedSearchAlertOutbox"("email", "sentAt");
