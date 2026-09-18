/* Call-outcome lifecycle for the broker call queue.
 *
 * Every (broker, property) pair has exactly one live state, derived from the
 * LATEST contact event the broker logged for that property:
 *
 *   new       no outcome logged yet                          -> call now
 *   retry     last outcome was `no_answer` (or unknown)      -> call again, after the news
 *   followup  `follow_up` whose date is today or overdue     -> call now, after retries
 *   scheduled `follow_up` with a future date                 -> OUT of today's queue;
 *                                                               counted, resurfaces on its day
 *   done      `connected` | `deal` | `wrong_number`          -> OUT of the queue; the
 *                                                               completed section keeps history
 *
 * Pure functions only: the repository feeds the latest event in, the queue
 * renderer consumes the ordered rows out — both sides are trivially testable
 * and the state rules live in exactly one place.
 */

export type CallState = "new" | "retry" | "followup" | "scheduled" | "done";

export const TERMINAL_OUTCOMES: ReadonlySet<string> = new Set(["connected", "deal", "wrong_number"]);
export const FOLLOW_UP_OUTCOME = "follow_up";

/** 23:59:59.999 local-server-time of the day `d` belongs to. A follow-up due
 *  any time today counts as due now — brokers think in days, not timestamps. */
export function endOfDay(d: Date = new Date()): Date {
  const end = new Date(d);
  end.setHours(23, 59, 59, 999);
  return end;
}

export function callStateFor(
  lastOutcome: string | null | undefined,
  followUpAt: Date | string | null | undefined,
  now: Date = new Date(),
): CallState {
  if (!lastOutcome) return "new";
  if (TERMINAL_OUTCOMES.has(lastOutcome)) return "done";
  if (lastOutcome === FOLLOW_UP_OUTCOME) {
    if (!followUpAt) return "followup"; // date never set: due immediately, never silently dropped
    const due = typeof followUpAt === "string" ? new Date(followUpAt) : followUpAt;
    return due.getTime() <= endOfDay(now).getTime() ? "followup" : "scheduled";
  }
  return "retry"; // no_answer and anything unrecognized deserves another dial, not deletion
}

/** Smaller sorts earlier inside the "Next to call" list. Promises beat fresh
 *  work: a follow-up you promised (or a callback you owe) surfaces before
 *  brand-new listings, otherwise a busy day would bury them forever. */
export const CALL_STATE_RANK: Record<Exclude<CallState, "scheduled" | "done">, number> = {
  followup: 0,
  retry: 1,
  new: 2,
};

type QueueRowLike = {
  callState: CallState;
  datePosted: Date | string | null;
  lastOutcomeAt: Date | string | null;
  followUpAt: Date | string | null;
};

const time = (d: Date | string | null | undefined) => (d ? new Date(d).getTime() : 0);

/** Full queue comparator: news first (newest listing first), then no-answer
 *  retries (oldest attempt first — they have waited longest), then follow-ups
 *  (most overdue first), then completed history (newest listing first). */
export function compareQueueRows(a: QueueRowLike, b: QueueRowLike): number {
  const rankOf = (state: CallState) => (CALL_STATE_RANK as Record<string, number>)[state] ?? 9;
  const rank = rankOf(a.callState) - rankOf(b.callState);
  if (rank !== 0) return rank;
  if (a.callState === "new" || a.callState === "done") return time(b.datePosted) - time(a.datePosted);
  if (a.callState === "retry") return time(a.lastOutcomeAt) - time(b.lastOutcomeAt);
  return time(a.followUpAt) - time(b.followUpAt);
}

/** Short human label for the state chip on a queue card. */
export function callStateLabel(
  row: { callState: CallState; followUpAt: Date | string | null; lastOutcomeAt: Date | string | null },
  now: Date = new Date(),
): string | null {
  switch (row.callState) {
    case "retry":
      return "No answer · try again";
    case "followup": {
      if (!row.followUpAt) return "Follow up · due";
      const due = time(row.followUpAt);
      const day = 86_400_000;
      const overdueDays = Math.floor((endOfDay(now).getTime() - due) / day);
      if (overdueDays >= 1) return `Follow up · overdue ${overdueDays}d`;
      return "Follow up · due today";
    }
    case "scheduled": {
      if (!row.followUpAt) return "Follow up · scheduled";
      const days = Math.round((time(row.followUpAt) - now.getTime()) / 86_400_000);
      return days <= 1 ? "Follow up · tomorrow" : `Follow up · in ${days} days`;
    }
    default:
      return null;
  }
}
