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

  it("keeps a no-answer as pending work (retry), not completed", () => {
    const outcomes = applyLoggedOutcome({}, "new-1", "no_answer");
    const summary = summarizeCallQueue(rows, outcomes);
    // A retry is still work: it stays pending (the card gains a
    // "No answer · try again" chip and the server orders it after news).
    expect(summary.pending.map((row) => row.id)).toEqual(["new-1", "new-2"]);
    expect(summary.completed.map((row) => row.id)).toEqual(["done-1"]);
    expect(summary.completedCount).toBe(1);
    expect(summary.percent).toBe(33);
  });

  it("moves an owner to completed after a terminal outcome", () => {
    const outcomes = applyLoggedOutcome({}, "new-1", "connected");
    const summary = summarizeCallQueue(rows, outcomes);
    expect(summary.pending.map((row) => row.id)).toEqual(["new-2"]);
    expect(summary.completed.map((row) => row.id)).toEqual(["new-1", "done-1"]);
    expect(summary.completedCount).toBe(2);
    expect(summary.percent).toBe(67);
  });

  it("moves a follow-up logged THIS session out of the pending split", () => {
    const outcomes = applyLoggedOutcome({}, "new-1", "follow_up");
    const summary = summarizeCallQueue(rows, outcomes);
    expect(summary.pending.map((row) => row.id)).toEqual(["new-2"]);
    expect(summary.completed).toContainEqual(expect.objectContaining({ id: "new-1" }));
  });

  it("keeps a server-side DUE follow-up pending (it is today's work)", () => {
    const rowsWithDue = [
      { id: "due-1", currentOutcome: "follow_up", callState: "followup" as const },
      { id: "sched-1", currentOutcome: "follow_up", callState: "scheduled" as const },
      { id: "new-1", currentOutcome: null },
    ];
    const summary = summarizeCallQueue(rowsWithDue, {});
    expect(summary.pending.map((row) => row.id)).toEqual(["due-1", "new-1"]);
    expect(summary.completed.map((row) => row.id)).toEqual(["sched-1"]);
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

import { outcomeCounts } from "./call-queue-state";

describe("outcomeCounts", () => {
  it("buckets rows by live outcome", () => {
    const rows = [
      { id: "a", currentOutcome: null },
      { id: "b", currentOutcome: "connected" },
      { id: "c", currentOutcome: "no_answer" },
      { id: "d", currentOutcome: "no_answer" },
      { id: "e", currentOutcome: "follow_up" },
      { id: "f", currentOutcome: "deal" },
    ];
    expect(outcomeCounts(rows, {})).toEqual({ new: 1, connected: 1, no_answer: 2, wrong_number: 0, follow_up: 1, deal: 1 });
    // logged-this-session overrides count immediately
    expect(outcomeCounts(rows, { a: "connected" }).connected).toBe(2);
    expect(outcomeCounts(rows, { a: "connected" }).new).toBe(0);
  });
});
