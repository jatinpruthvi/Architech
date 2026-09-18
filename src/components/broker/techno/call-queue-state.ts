export type LoggedOutcomes = Record<string, string>;

type QueueRow = { id: string; currentOutcome?: string | null };

export function applyLoggedOutcome(
  outcomes: LoggedOutcomes,
  propertyId: string,
  outcome: string,
): LoggedOutcomes {
  return { ...outcomes, [propertyId]: outcome };
}

export function summarizeCallQueue<T extends QueueRow>(rows: T[], outcomes: LoggedOutcomes) {
  const hasOutcome = (row: T) => Boolean(outcomes[row.id] ?? row.currentOutcome);
  const pending = rows.filter((row) => !hasOutcome(row));
  const completed = rows.filter(hasOutcome);
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
