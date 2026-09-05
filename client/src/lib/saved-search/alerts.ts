import "server-only";

/* Saved-search alert delivery (I-12).
 *
 * The plane of truth: a buyer ticks "notify me" and until now nothing ever
 * notified — `notify:true` was stored intent with no delivery pipeline, which
 * the audit correctly named a broken promise. This module closes it:
 *
 *  - ACTIVATION, two keys and a flag, all mandatory: `RESEND_API_KEY`,
 *    `SAVED_SEARCH_ALERT_FROM` (verified sender), `SAVED_SEARCH_ALERTS=on`,
 *    plus prisma saved-search storage (alerts need account emails; in-memory
 *    demo sessions have none — never fabricate an address).
 *  - MATCHING is conservative on purpose: a saved search alerts only when the
 *    matching helpers see the listing under BOTH buy and rent projections
 *    (intent is not persisted on a saved search today, so intent-dependent
 *    chips could otherwise fire for the wrong market — over-alerting is spam
 *    with extra steps). Documented on /saved-searches completion copy.
 *  - REPLY TRAIL: Resend `Idempotency-Key` = `${stableId}:${savedSearchId}`,
 *    so a repeated moderation emit cannot double-mail. A provider failure is
 *    logged and swallowed (the life-cycle write itself already committed —
 *    the spine's isolation rule).
 *  - LEG-005 owns activation: the email carries the manage-alerts link and
 *    the "you asked for this" consent sentence before any credential makes
 *    this live.
 */
import { matchesQuery } from "@/lib/filters";
import { applyFacetState, facetGroups, parseFacetState } from "@/lib/search/facets";
import type { Property } from "@/lib/repositories";
import { logger } from "@/lib/observability/logger";
import type { SavedSearchState } from "./saved-search";

/* ProcessEnv-compatible: extra keys may be present (we only read ours). */
export type AlertEnv = Record<string, string | undefined>;

export type AlertGate = { enabled: true; from: string; apiKey: string; baseUrl: string } | { enabled: false; missing: string[] };

export function savedSearchAlertGate(env: AlertEnv = process.env): AlertGate {
  const missing: string[] = [];
  if ((env.SAVED_SEARCH_ALERTS ?? "").trim().toLowerCase() !== "on") missing.push("SAVED_SEARCH_ALERTS=on");
  if (!env.RESEND_API_KEY) missing.push("RESEND_API_KEY");
  if (!env.SAVED_SEARCH_ALERT_FROM) missing.push("SAVED_SEARCH_ALERT_FROM");
  if (missing.length) return { enabled: false, missing };
  return {
    enabled: true,
    apiKey: env.RESEND_API_KEY as string,
    from: env.SAVED_SEARCH_ALERT_FROM as string,
    baseUrl: (env.NEXT_PUBLIC_SITE_URL ?? "https://www.architech.in").replace(/\/$/, ""),
  };
}

/** The conservative match: free text via the ONE shared matcher, and every
    facet token accepted under both intent projections. A token that only
    passes under one intent stays silent — false silence is recoverable
    (search again); a wrong-market email is not. */
export function savedSearchMatchesListing(search: Pick<SavedSearchState, "query" | "filters">, listing: Property): boolean {
  if (search.query && !matchesQuery(listing, search.query)) return false;
  const tokens = (search.filters ?? []).filter(Boolean);
  if (tokens.length === 0) return true;
  for (const intent of ["buy", "rent"] as const) {
    const state = parseFacetState(tokens.join(","), facetGroups({ intent }));
    if (applyFacetState([listing], state, facetGroups({ intent })).length === 0) return false;
  }
  return true;
}

export type AlertTarget = { savedSearchId: string; email: string; idempotencyKey: string };
export type AlertCandidateRow = { id: string; notify: boolean; query: string | null; filters: unknown; user: { email: string | null } | null };

/** Pure target selection over pre-fetched rows — the query-side query is the
    responsibility of the caller so this stays testable without a database. */
export function collectAlertTargets(args: { stableId: string; listing: Property; rows: AlertCandidateRow[] }): AlertTarget[] {
  const targets: AlertTarget[] = [];
  for (const row of args.rows) {
    if (!row.notify) continue;
    /* Never mail a row that cannot reach a person, and never invent an
       address from an id. */
    const email = row.user?.email?.trim();
    if (!email) continue;
    const contract: Pick<SavedSearchState, "query" | "filters"> = {
      query: row.query ?? "",
      filters: Array.isArray(row.filters) ? (row.filters as string[]) : [],
    };
    if (!savedSearchMatchesListing(contract, args.listing)) continue;
    targets.push({ savedSearchId: row.id, email, idempotencyKey: `${args.stableId}:${row.id}` });
  }
  return targets;
}

export type AlertDelivery = { delivered: number; failed: number; skipped: number };

/** Deliver one email per target. Independently isolated per recipient: one
    bad address or provider hiccup must not starve the rest. */
export async function dispatchSavedSearchAlerts(
  gate: Extract<AlertGate, { enabled: true }>,
  listing: Property,
  targets: AlertTarget[],
  fetchImpl: typeof fetch = fetch,
): Promise<AlertDelivery> {
  const delivery: AlertDelivery = { delivered: 0, failed: 0, skipped: 0 };
  for (const target of targets) {
    /* LEG-005 shape: the very first line says why the buyer is receiving
       this, and the manage link is one click deep — never buried. */
    const subject = `New match: ${listing.title}`;
    const text = [
      `You asked to be alerted when a home matching your saved search goes live.`,
      ``,
      `${listing.title} — ${listing.locality}, ${listing.price}`,
      listing.localitySlug && listing.citySlug ? `View: ${gate.baseUrl}/listing/${listing.id}/` : "",
      ``,
      `Manage or turn off these alerts: ${gate.baseUrl}/saved-searches/`,
      `You are receiving this because you saved this search on Architech with alerts on.`,
    ].filter(Boolean).join("\n");
    try {
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${gate.apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": target.idempotencyKey,
        },
        body: JSON.stringify({ from: gate.from, to: target.email, subject, text }),
      });
      if (!response.ok) {
        delivery.failed += 1;
        logger.error({ event: "saved_search.alert_failed", savedSearchId: target.savedSearchId, status: response.status }, "saved-search alert delivery failed");
      } else {
        delivery.delivered += 1;
      }
    } catch (error) {
      delivery.failed += 1;
      logger.error({ event: "saved_search.alert_failed", savedSearchId: target.savedSearchId, error }, "saved-search alert transport failed");
    }
  }
  return delivery;
}
