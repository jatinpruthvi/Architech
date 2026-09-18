import { TERMINAL_OUTCOMES, type CallState } from "@/lib/technoproperty/call-lifecycle";

export type LoggedOutcomes = Record<string, string>;

type QueueRow = { id: string; currentOutcome?: string | null; callState?: CallState };

export function applyLoggedOutcome(
  outcomes: LoggedOutcomes,
  propertyId: string,
  outcome: string,
): LoggedOutcomes {
  return { ...outcomes, [propertyId]: outcome };
}

/* The completed section mirrors the server lifecycle. A DUE follow-up stays
 * pending (it is today's work — the server orders it first); only a FUTURE
 * one (callState "scheduled") leaves the list. Rows lacking callState fall
 * back to outcome strings. Outcomes logged THIS session apply instantly:
 * terminal ones complete the row, a follow-up is out of the way until its
 * date arrives (the next full reload re-buckets it via callState). */
export function summarizeCallQueue<T extends QueueRow>(rows: T[], outcomes: LoggedOutcomes) {
  const isCompleted = (row: T) => {
    const logged = outcomes[row.id];
    if (logged === "follow_up") return true;
    if (logged) return TERMINAL_OUTCOMES.has(logged);
    if (row.callState) return row.callState === "done" || row.callState === "scheduled";
    const outcome = row.currentOutcome ?? null;
    return outcome !== null && (TERMINAL_OUTCOMES.has(outcome) || outcome === "follow_up");
  };
  const pending = rows.filter((row) => !isCompleted(row));
  const completed = rows.filter(isCompleted);
  const total = rows.length;
  const completedCount = completed.length;
  return {
    pending,
    completed,
    completedCount,
    total,
    percent: total === 0 ? 0 : Math.round((completedCount / total) * 100),
  };
}
