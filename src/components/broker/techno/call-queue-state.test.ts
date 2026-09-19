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

  it("moves a follow-up logged THIS session into the scheduled bucket", () => {
    const outcomes = applyLoggedOutcome({}, "new-1", "follow_up");
    const summary = summarizeCallQueue(rows, outcomes);
    expect(summary.pending.map((row) => row.id)).toEqual(["new-2"]);
    expect(summary.scheduled).toContainEqual(expect.objectContaining({ id: "new-1" }));
    // it still counts as a logged call on the progress card
    expect(summary.completedCount).toBe(2);
    expect(summary.percent).toBe(67);
  });

  it("keeps a server-side DUE follow-up pending; future ones sit in scheduled", () => {
    const rowsWithDue = [
      { id: "due-1", currentOutcome: "follow_up", callState: "followup" as const },
      { id: "sched-1", currentOutcome: "follow_up", callState: "scheduled" as const },
      { id: "new-1", currentOutcome: null },
    ];
    const summary = summarizeCallQueue(rowsWithDue, {});
    expect(summary.pending.map((row) => row.id)).toEqual(["due-1", "new-1"]);
    expect(summary.scheduled.map((row) => row.id)).toEqual(["sched-1"]);
    expect(summary.completed).toEqual([]);
    // the scheduled one was still a call made: logged = 1 of 3
    expect(summary.completedCount).toBe(1);
    expect(summary.percent).toBe(33);
  });

  it("handles an empty queue without dividing by zero", () => {
    expect(summarizeCallQueue([], {})).toEqual({
      pending: [],
      scheduled: [],
      completed: [],
      completedCount: 0,
      total: 0,
      percent: 0,
    });
  });
});

import { nextPendingId, outcomeCounts } from "./call-queue-state";

describe("nextPendingId", () => {
  it("hands off to the next owner in the rendered line", () => {
    const line = [
      { id: "a", currentOutcome: null },
      { id: "b", currentOutcome: null },
      { id: "c", currentOutcome: null },
    ];
    expect(nextPendingId(line, {}, "a")).toBe("b");
    expect(nextPendingId(line, {}, "c")).toBeNull();
  });

  it("skips rows that already completed or went to scheduled", () => {
    const line = [
      { id: "a", currentOutcome: null },
      { id: "b", currentOutcome: "connected" },
      { id: "c", currentOutcome: "follow_up", callState: "scheduled" as const },
      { id: "d", currentOutcome: null },
    ];
    expect(nextPendingId(line, {}, "a")).toBe("d");
  });

  it("a row that just left the line (terminal) hands off to its successor", () => {
    const line = [
      { id: "a", currentOutcome: null },
      { id: "b", currentOutcome: null },
    ];
    // Logged "connected" on "a" — computed against the outcomes BEFORE the log.
    expect(nextPendingId(line, {}, "a")).toBe("b");
    // ...and after the log, "a" is gone; the successor of "b" is nothing.
    expect(nextPendingId(line, { a: "connected" }, "b")).toBeNull();
  });

  it("a no-answer row STAYS in line and hands off to its successor", () => {
    const line = [
      { id: "a", currentOutcome: "no_answer" },
      { id: "b", currentOutcome: null },
    ];
    expect(nextPendingId(line, { a: "no_answer" }, "a")).toBe("b");
  });

  it("returns null for a row that is not (or no longer) pending", () => {
    const line = [{ id: "a", currentOutcome: "connected" }];
    expect(nextPendingId(line, {}, "a")).toBeNull();
    expect(nextPendingId(line, {}, "ghost")).toBeNull();
  });
});

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
