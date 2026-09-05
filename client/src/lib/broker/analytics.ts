/* Broker desk analytics — every figure DERIVED from rows the desk already
   loads (lead inbox, drafts), never estimated. Two honesty rules hold
   throughout:
   1. A metric with no source rows is `null`, and renders as "Gathering data"
      or "—" in the UI — a confident 0 is the bug this closes (I-6 extended).
   2. Small samples are disclosed: first-response medians always carry their
      n, because n=2 and n=200 are different facts with the same number. */
import type { LeadRecord } from "@/lib/leads/lead";
import type { ListingDraft } from "./workflow";

export type LeadFunnel = {
  total: number;
  fresh: number;
  acknowledged: number;
  replied: number;
  closed: number;
  /** Leads whose consent was revoked or that were soft-deleted: excluded from
      every working funnel count, but disclosed — silent disappearance is how
      "conversion" numbers get inflated. */
  excluded: number;
};

export function leadFunnel(leads: LeadRecord[]): LeadFunnel {
  const active = leads.filter((lead) => lead.status !== "DELETED");
  const funnel: LeadFunnel = {
    total: active.length,
    fresh: 0,
    acknowledged: 0,
    replied: 0,
    closed: 0,
    excluded: leads.length - active.length,
  };
  for (const lead of active) {
    if (lead.status === "NEW") funnel.fresh += 1;
    else if (lead.status === "ACKNOWLEDGED") funnel.acknowledged += 1;
    else if (lead.status === "REPLIED") funnel.replied += 1;
    else if (lead.status === "CLOSED") funnel.closed += 1;
  }
  return funnel;
}

export type FirstResponseStats = { count: number; medianMinutes: number };

/** created → first acknowledgement/reply. Leads never answered contribute to
    NOTHING here — folding them in as a fabricated "no response = 0 minutes"
    or as the period length would both lie. */
export function firstResponseStats(leads: LeadRecord[]): FirstResponseStats | null {
  const minutes: number[] = [];
  for (const lead of leads) {
    if (lead.status === "DELETED") continue;
    const created = new Date(lead.createdAt).getTime();
    if (Number.isNaN(created)) continue;
    let firstResponse: number | null = null;
    for (const event of lead.statusHistory) {
      if (event.action !== "lead.acknowledged" && event.action !== "lead.replied") continue;
      const at = new Date(event.at).getTime();
      if (Number.isNaN(at) || at < created) continue;
      if (firstResponse === null || at < firstResponse) firstResponse = at;
    }
    if (firstResponse !== null) minutes.push((firstResponse - created) / 60_000);
  }
  if (minutes.length === 0) return null;
  minutes.sort((a, b) => a - b);
  const mid = Math.floor(minutes.length / 2);
  const median = minutes.length % 2 === 0 ? (minutes[mid - 1] + minutes[mid]) / 2 : minutes[mid];
  return { count: minutes.length, medianMinutes: Math.round(median) };
}

export type DemandRow = { listingTitle: string; leads: number };

/** Which listings attract enquiries, by count, capped. Listing TITLE is the
    stable label here — the inbox contract guarantees it; a locality join
    would depend on cross-table data the desk row does not carry. */
export function demandByListing(leads: LeadRecord[], limit = 5): DemandRow[] {
  const counts = new Map<string, number>();
  for (const lead of leads) {
    if (lead.status === "DELETED") continue;
    const title = lead.listingTitle?.trim();
    if (!title) continue;
    counts.set(title, (counts.get(title) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([listingTitle, count]) => ({ listingTitle, leads: count }))
    .sort((a, b) => b.leads - a.leads || a.listingTitle.localeCompare(b.listingTitle))
    .slice(0, limit);
}

export type DraftPortfolio = {
  total: number;
  byStatus: Array<{ status: string; count: number }>;
  /** Days since the most recently touched draft — portfolio freshness, not
      an estimate of anything else. Null when there are no drafts. */
  lastEditDays: number | null;
};

export function draftPortfolio(drafts: ListingDraft[], now = new Date()): DraftPortfolio {
  const byStatus = new Map<string, number>();
  let newest: number | null = null;
  for (const draft of drafts) {
    byStatus.set(draft.status, (byStatus.get(draft.status) ?? 0) + 1);
    const at = new Date(draft.updatedAt).getTime();
    if (!Number.isNaN(at) && (newest === null || at > newest)) newest = at;
  }
  return {
    total: drafts.length,
    byStatus: [...byStatus.entries()].map(([status, count]) => ({ status: status.toLowerCase(), count })).sort((a, b) => b.count - a.count),
    lastEditDays: newest === null ? null : Math.max(0, Math.round((now.getTime() - newest) / 86_400_000)),
  };
}
