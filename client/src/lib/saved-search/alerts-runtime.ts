import "server-only";

/* Wires saved-search alerts to the listing event spine (I-12 runtime side),
   with the P1.6 cost controls on top of the I-12 delivery pipeline:

   - ENQUEUE FIRST: every matched (listing, search) pair writes ONE durable
     SavedSearchAlertOutbox row, idempotently keyed like the Resend send
     itself. The row is the send log the quota counts and the digest flush
     delivers — a repeated publish event cannot double-mail or double-count.
   - PER_MATCH (default): the row is delivered immediately, suppressed when
     the watcher's daily limit (SAVED_SEARCH_ALERT_DAILY_LIMIT, default 3,
     0 = unlimited) is already used for the UTC day.
   - DIGEST: the row stays PENDING; the daily platform cron
     (/api/internal/scheduled/saved-search-alert-digest) groups the backlog
     per watcher and mails ONE digest per run instead of N per-match emails.

   Registration happens from `instrumentation.ts` — the same once-at-startup
   discipline as the SEO subscribers — and only when every activation key is
   present (see alerts.ts for the gate). Without the gate this module logs
   once that a promise-bearing feature stays silent, which is the audit's
   demanded honesty: a `notify:true` checkbox must never look enqueued when
   nothing will ever send.
 */
import { createHash } from "node:crypto";
import { onListingEvent, type ListingEvent } from "@/lib/listing/events";
import { getListingByIdForServer, getPrismaClient } from "@/lib/repositories/server/prisma";
import { isPrismaDataSource } from "@/lib/repositories/source";
import { logger } from "@/lib/observability/logger";
import {
  alertDayKey,
  buildDigestEmail,
  collectAlertTargets,
  dispatchSavedSearchAlerts,
  savedSearchAlertGate,
  type AlertCandidateRow,
} from "./alerts";

/** The outbox model as this module reads/writes it (typed by hand so the
    prisma client shape stays an implementation detail). */
type OutboxRow = {
  id: string;
  userId: string;
  email: string;
  savedSearchId: string;
  stableId: string;
  listingTitle: string;
  listingPrice: string | null;
  localitySlug: string | null;
  citySlug: string | null;
  idempotencyKey: string;
  status: "PENDING" | "SENT" | "SUPPRESSED";
  sentAt: Date | null;
  createdAt: Date;
};

type AlertOutboxModel = {
  upsert(args: unknown): Promise<OutboxRow>;
  findMany(args: unknown): Promise<OutboxRow[]>;
  count(args: unknown): Promise<number>;
  updateMany(args: unknown): Promise<{ count: number }>;
};

function alertOutbox(): AlertOutboxModel {
  return (getPrismaClient() as unknown as { savedSearchAlertOutbox: AlertOutboxModel }).savedSearchAlertOutbox;
}

/** Start of the UTC day the quota counts against (alertDayKey's anchor). */
function startOfUtcDay(now: Date = new Date()): Date {
  return new Date(`${alertDayKey(now)}T00:00:00.000Z`);
}

async function onListingPublished(event: ListingEvent): Promise<void> {
  if (event.type !== "listing.published") return;
  const gate = savedSearchAlertGate();
  if (!gate.enabled) return; /* registration already announced silent mode */
  if (!isPrismaDataSource()) return; /* demo/in-memory sessions own no consented addresses */

  const listing = await getListingByIdForServer(event.stableId);
  if (!listing) return;

  /* Bounded read: the alert table in question is per-account opt-ins, and an
     account-bounded system that scans it per publish beats a workers queue
     this quarter. If it outgrows the scan, the scan is the perf bug to fix,
     not the contract the buyer was promised. */
  const prisma = getPrismaClient() as unknown as {
    savedSearch: { findMany(args: unknown): Promise<AlertCandidateRow[]> };
  };
  /* sql-perf: intentionally-unbounded — per design comment above: an
     account-scoped opt-in scan chosen over a workers queue this quarter.
     Watchlist SQL-PERF-17: if saved-search opt-ins outgrow the scan, this
     becomes the perf bug the comment predicts. */
  const rows = await prisma.savedSearch.findMany({
    where: { notify: true, userId: { not: null } },
    select: { id: true, userId: true, notify: true, query: true, filters: true, user: { select: { email: true } } },
  });

  const targets = collectAlertTargets({ stableId: event.stableId, listing, rows });
  if (targets.length === 0) return;

  const outbox = alertOutbox();
  /* ENQUEUE FIRST (both modes): the row exists before any HTTP send, so a
     crash mid-dispatch cannot lose the promise, and a replayed publish event
     upserts onto the same row instead of creating a second one. */
  const rowsByKey = new Map<string, OutboxRow>();
  let enqueued = 0;
  for (const target of targets) {
    const row = await outbox.upsert({
      where: { idempotencyKey: target.idempotencyKey },
      update: {}, /* the facts never change after first enqueue */
      create: {
        userId: target.userId,
        email: target.email,
        savedSearchId: target.savedSearchId,
        stableId: event.stableId,
        listingTitle: listing.title,
        listingPrice: listing.price ?? null,
        localitySlug: listing.localitySlug ?? null,
        citySlug: listing.citySlug ?? null,
        idempotencyKey: target.idempotencyKey,
      },
    });
    rowsByKey.set(target.idempotencyKey, row);
    if (row.status === "PENDING") enqueued += 1;
  }

  if (gate.mode === "digest") {
    /* Digest mode: delivery is the daily cron's job. A PENDING row the
       publish event cannot clear is still owed, not lost. */
    logger.info(
      { event: "saved_search.alerts_enqueued", stableId: event.stableId, enqueued, total: targets.length },
      "saved-search alerts enqueued for the daily digest",
    );
    return;
  }

  /* PER_MATCH: deliver now, throttled by the per-watcher daily quota. The
     quota counts SENT rows for this email this UTC day — from the durable
     outbox, so a process restart cannot reset the cap. */
  let delivered = 0;
  let failed = 0;
  let suppressed = 0;
  let skipped = 0;
  const dayStart = startOfUtcDay();
  for (const target of targets) {
    const row = rowsByKey.get(target.idempotencyKey)!;
    /* Already resolved (a replayed publish event, or a prior run): the Resend
       idempotency key would no-op it anyway — skip the read as well. */
    if (row.status !== "PENDING") {
      skipped += 1;
      continue;
    }
    if (gate.dailyLimit > 0) {
      const sentToday = await outbox.count({
        where: { email: target.email, status: "SENT", sentAt: { gte: dayStart } },
      });
      if (sentToday >= gate.dailyLimit) {
        /* Over quota: record the suppression durably instead of silently
           dropping it — the row is visible in the outbox and the watcher is
           never double-mailed for the same match. */
        await outbox.updateMany({ where: { id: row.id }, data: { status: "SUPPRESSED" } });
        suppressed += 1;
        logger.info(
          { event: "saved_search.alert_suppressed", stableId: event.stableId, savedSearchId: target.savedSearchId, sentToday, limit: gate.dailyLimit },
          "saved-search alert suppressed by the daily quota",
        );
        continue;
      }
    }
    const result = await dispatchSavedSearchAlerts(gate, listing, [target]);
    if (result.delivered > 0) {
      await outbox.updateMany({ where: { id: row.id }, data: { status: "SENT", sentAt: new Date() } });
      delivered += 1;
    } else {
      /* Transport/provider failure: the row STAYS PENDING, so a later flush
         (the digest cron in either mode) can still deliver it. The spine's
         isolation rule is unchanged — no throw. */
      failed += 1;
    }
  }
  logger.info(
    { event: "saved_search.alerts_dispatched", stableId: event.stableId, delivered, failed, suppressed, skipped },
    "saved-search alerts dispatched (per-match)",
  );
}

let registered = false;

/** Subscribe once per process. Idempotent — instrumentation may re-run in dev. */
export function registerSavedSearchAlertRuntime(): void {
  if (registered) return;
  registered = true;
  const gate = savedSearchAlertGate();
  if (!gate.enabled) {
    logger.info({ event: "saved_search.alerts_disabled", missing: gate.missing }, "saved-search alerts stay silent until configured");
    return;
  }
  onListingEvent((event) => {
    /* The spine isolates subscribers, but catching here too keeps a surprise
       from ever surfacing as a rejected emit. */
    void onListingPublished(event).catch((error: unknown) => {
      logger.error({ event: "saved_search.alert_cycle_failed", error }, "saved-search alert cycle failed");
    });
  });
}

export type DigestFlushResult = {
  ok: boolean;
  reason?: string;
  missing?: string[];
  emails: number;
  emailsFailed: number;
  rowsDelivered: number;
  remaining: number;
};

/**
 * The daily digest flush — the external driver behind
 * POST /api/internal/scheduled/saved-search-alert-digest/. Groups PENDING
 * outbox rows per watcher and mails ONE digest per watcher per run, capped
 * at `digestMaxListings` per email; the remainder waits for the next run.
 *
 * Idempotency: the Resend `Idempotency-Key` is
 * `digest:<utcDay>:<email>:<sha256 of the batch's stableIds>` — a cron retry
 * with the same batch is a no-op at the provider, while a DIFFERENT batch
 * (backlog beyond the cap) gets its own key instead of silently inheriting
 * the first email's contents. Works in both modes: in digest mode it is the
 * delivery path; in per_match mode it retries rows whose immediate send
 * failed.
 */
export async function flushSavedSearchAlertDigestForServer(fetchImpl: typeof fetch = fetch): Promise<DigestFlushResult> {
  const empty = { emails: 0, emailsFailed: 0, rowsDelivered: 0, remaining: 0 };
  const gate = savedSearchAlertGate();
  if (!gate.enabled) return { ok: false, reason: "saved-search alert gate disabled", missing: gate.missing, ...empty };
  if (!isPrismaDataSource()) return { ok: false, reason: "prisma data source required", ...empty };

  const outbox = alertOutbox();
  /* Oldest first: the longest-watched match is the most owed. Bounded read. */
  const rows = await outbox.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, take: 500 });
  if (rows.length === 0) return { ok: true, ...empty };

  const byEmail = new Map<string, OutboxRow[]>();
  for (const row of rows) {
    const group = byEmail.get(row.email);
    if (group) group.push(row);
    else byEmail.set(row.email, [row]);
  }

  const dayKey = alertDayKey();
  let emails = 0;
  let emailsFailed = 0;
  let rowsDelivered = 0;
  for (const [email, group] of byEmail) {
    const capped = group.slice(0, gate.digestMaxListings);
    /* The same listing can match several of one watcher's searches. The
       digest notifies about LISTINGS, not per search, so each stableId is
       listed once — but every matching row is still cleared below, or the
       duplicate would be "delivered" again next run. */
    const seenStableIds = new Set<string>();
    const batch = capped.filter((row) => {
      if (seenStableIds.has(row.stableId)) return false;
      seenStableIds.add(row.stableId);
      return true;
    });
    const { subject, text } = buildDigestEmail(gate, batch.map((row) => ({
      stableId: row.stableId,
      listingTitle: row.listingTitle,
      listingPrice: row.listingPrice,
      localitySlug: row.localitySlug,
      citySlug: row.citySlug,
    })));
    const fingerprint = createHash("sha256").update(batch.map((row) => row.stableId).sort().join("\n")).digest("hex").slice(0, 32);
    const idempotencyKey = `digest:${dayKey}:${email}:${fingerprint}`;
    try {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gate.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ from: gate.from, to: email, subject, text }),
      });
      if (response.ok) {
        emails += 1;
        /* Every row in the capped window is cleared — the deduped
           duplicates included, since the email already notified them. */
        rowsDelivered += capped.length;
        await outbox.updateMany({ where: { id: { in: capped.map((row) => row.id) } }, data: { status: "SENT", sentAt: new Date() } });
      } else {
        emailsFailed += 1;
        logger.error({ event: "saved_search.digest_failed", email, status: response.status, batch: batch.length }, "saved-search digest delivery failed");
      }
    } catch (error) {
      emailsFailed += 1;
      logger.error({ event: "saved_search.digest_failed", email, error }, "saved-search digest transport failed");
    }
  }
  /* True backlog, not the read window: `rows` was bounded by `take: 500`,
     so `rows.length - rowsDelivered` under-reports whenever PENDING exceeds
     the window (a cron run could report remaining: 0 while 700+ rows were
     still owed). Counting PENDING after the loop is the honest figure. */
  const remaining = await outbox.count({ where: { status: "PENDING" } });
  logger.info({ event: "saved_search.digest_flushed", emails, emailsFailed, rowsDelivered, remaining }, "saved-search alert digest flushed");
  return { ok: true, emails, emailsFailed, rowsDelivered, remaining };
}
