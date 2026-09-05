import "server-only";

/* Wires saved-search alerts to the listing event spine (I-12 runtime side).
 *
 * Registration happens from `instrumentation.ts` — the same once-at-startup
 * discipline as the SEO subscribers — and only when every activation key is
 * present (see alerts.ts for the gate). Without the gate this module logs
 * once that a promise-bearing feature stays silent, which is the audit's
 * demanded honesty: a `notify:true` checkbox must never look enqueued when
 * nothing will ever send.
 */
import { onListingEvent, type ListingEvent } from "@/lib/listing/events";
import { getListingByIdForServer, getPrismaClient } from "@/lib/repositories/server/prisma";
import { isPrismaDataSource } from "@/lib/repositories/source";
import { logger } from "@/lib/observability/logger";
import { collectAlertTargets, dispatchSavedSearchAlerts, savedSearchAlertGate, type AlertCandidateRow } from "./alerts";

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
  const rows = await prisma.savedSearch.findMany({
    where: { notify: true, userId: { not: null } },
    select: { id: true, notify: true, query: true, filters: true, user: { select: { email: true } } },
  });

  const targets = collectAlertTargets({ stableId: event.stableId, listing, rows });
  if (targets.length === 0) return;
  const result = await dispatchSavedSearchAlerts(gate, listing, targets);
  logger.info({ event: "saved_search.alerts_dispatched", stableId: event.stableId, ...result }, "saved-search alerts dispatched");
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
