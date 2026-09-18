import { describe, expect, it } from "vitest";
import { applyLoggedOutcome, summarizeCallQueue } from "./call-queue-state";

const rows = [
  { id: "new-1", currentOutcome: null },
  { id: "done-1", currentOutcome: "connected" },
  { id: "new-2", currentOutcome: null },
];

describe("call queue progress", () => {
  it("puts uncalled owners first and reports honest progress", () => {
    const summary = summarizeCallQueue(rows, {});
    expect(summary.pending.map((row) => row.id)).toEqual(["new-1", "new-2"]);
    expect(summary.completed.map((row) => row.id)).toEqual(["done-1"]);
    expect(summary.completedCount).toBe(1);
    expect(summary.percent).toBe(33);
  });

  it("moves an owner to completed only after a saved outcome", () => {
    const outcomes = applyLoggedOutcome({}, "new-1", "no_answer");
    const summary = summarizeCallQueue(rows, outcomes);
    expect(summary.pending.map((row) => row.id)).toEqual(["new-2"]);
    expect(summary.completed.map((row) => row.id)).toEqual(["new-1", "done-1"]);
    expect(summary.completedCount).toBe(2);
    expect(summary.percent).toBe(67);
  });

  it("handles an empty queue without dividing by zero", () => {
    expect(summarizeCallQueue([], {})).toEqual({
      pending: [],
      completed: [],
      completedCount: 0,
      total: 0,
      percent: 0,
    });
  });
});
