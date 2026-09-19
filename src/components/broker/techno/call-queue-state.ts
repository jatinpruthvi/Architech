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

/* Three buckets mirror the server lifecycle. A DUE follow-up stays pending
 * (it is today's work — the server orders it first); a FUTURE one is its own
 * "scheduled" bucket (out of the way, visible via the Follow-up filter and
 * the collapsed section). Rows lacking callState fall back to outcome
 * strings. Outcomes logged THIS session apply instantly: terminal ones
 * complete the row, a follow-up moves to scheduled until its date arrives
 * (the next full reload re-buckets it via callState). "Calls logged" on the
 * progress card counts completed + scheduled — both mean a call was made. */
export function isRowScheduled(row: QueueRow, outcomes: LoggedOutcomes): boolean {
  const logged = outcomes[row.id];
  if (logged) return logged === "follow_up";
  if (row.callState) return row.callState === "scheduled";
  return (row.currentOutcome ?? null) === "follow_up" && !TERMINAL_OUTCOMES.has(row.currentOutcome ?? "");
}

export function isRowCompleted(row: QueueRow, outcomes: LoggedOutcomes): boolean {
  const logged = outcomes[row.id];
  if (logged) return TERMINAL_OUTCOMES.has(logged);
  if (row.callState) return row.callState === "done";
  const outcome = row.currentOutcome ?? null;
  return outcome !== null && TERMINAL_OUTCOMES.has(outcome);
}

export function summarizeCallQueue<T extends QueueRow>(rows: T[], outcomes: LoggedOutcomes) {
  const pending = rows.filter((row) => !isRowScheduled(row, outcomes) && !isRowCompleted(row, outcomes));
  const scheduled = rows.filter((row) => isRowScheduled(row, outcomes));
  const completed = rows.filter((row) => isRowCompleted(row, outcomes));
  const total = rows.length;
  const loggedCount = scheduled.length + completed.length;
  return {
    pending,
    scheduled,
    completed,
    completedCount: loggedCount,
    total,
    percent: total === 0 ? 0 : Math.round((loggedCount / total) * 100),
  };
}

/* Auto-advance target: the card that sits next in the broker's dialing line
 * after `currentId`, in the SAME order the pending section renders (rows
 * arrive pre-sorted from the server; session outcomes don't reorder them).
 * Computed against the OUTCOMES BEFORE this log, so a row that just left the
 * line (terminal outcome) hands off to whoever was after it, and a row that
 * stays (no_answer) hands off to its successor. null = nothing left. */
export function nextPendingId<T extends QueueRow>(rows: T[], outcomesBefore: LoggedOutcomes, currentId: string): string | null {
  const pending = rows.filter((row) => !isRowScheduled(row, outcomesBefore) && !isRowCompleted(row, outcomesBefore));
  const idx = pending.findIndex((row) => row.id === currentId);
  if (idx === -1) return null;
  const next = pending[idx + 1];
  return next ? next.id : null;
}

/* Status board: how many calls sit in each outcome bucket right now.
 * "new" = not dialed yet. Uses the same live view as the split: outcomes
 * logged this session count immediately. */
export type OutcomeFilter = "all" | "new" | "connected" | "no_answer" | "wrong_number" | "follow_up" | "deal";

export type OutcomeCounts = Record<Exclude<OutcomeFilter, "all">, number>;

export function outcomeCounts<T extends QueueRow>(rows: T[], outcomes: LoggedOutcomes): OutcomeCounts {
  const counts: OutcomeCounts = { new: 0, connected: 0, no_answer: 0, wrong_number: 0, follow_up: 0, deal: 0 };
  for (const row of rows) {
    const outcome = outcomes[row.id] ?? row.currentOutcome ?? null;
    if (outcome === null) counts.new += 1;
    else if (outcome in counts) counts[outcome as keyof OutcomeCounts] += 1;
    else counts.new += 1;
  }
  return counts;
}
