import { describe, expect, it } from "vitest";
import {
  callStateFor,
  callStateLabel,
  compareQueueRows,
  endOfDay,
  formatCallTime,
  type CallState,
} from "./call-lifecycle";

const NOW = new Date("2026-09-18T10:00:00.000Z");

describe("callStateFor", () => {
  it("new when no outcome exists", () => {
    expect(callStateFor(null, null, NOW)).toBe("new");
    expect(callStateFor(undefined, undefined, NOW)).toBe("new");
  });

  it.each(["connected", "deal", "wrong_number"] as const)("done for terminal outcome %s", (outcome) => {
    expect(callStateFor(outcome, null, NOW)).toBe("done");
  });

  it("retry after no_answer regardless of dates", () => {
    expect(callStateFor("no_answer", null, NOW)).toBe("retry");
  });

  it("follow_up with no date is due, never silently dropped", () => {
    expect(callStateFor("follow_up", null, NOW)).toBe("followup");
  });

  it("follow_up due today or overdue resurfaces", () => {
    const today = new Date("2026-09-18T09:00:00.000Z");
    const past = new Date("2026-09-15T09:00:00.000Z");
    expect(callStateFor("follow_up", today, NOW)).toBe("followup");
    expect(callStateFor("follow_up", past, NOW)).toBe("followup");
    expect(callStateFor("follow_up", today.toISOString(), NOW)).toBe("followup");
  });

  it("follow_up tomorrow is scheduled (future dates stay out of today)", () => {
    const tomorrow = new Date("2026-09-19T09:00:00.000Z");
    const tonightLate = new Date("2026-09-18T23:59:59.000Z");
    expect(callStateFor("follow_up", tomorrow, NOW)).toBe("scheduled");
    // end-of-day granularity: 23:59:59 tonight is still due today
    expect(callStateFor("follow_up", tonightLate, NOW)).toBe("followup");
  });
});

describe("compareQueueRows", () => {
  const row = (callState: CallState, extra: Partial<{ datePosted: Date; lastOutcomeAt: Date; followUpAt: Date }> = {}) => ({
    callState,
    datePosted: null,
    lastOutcomeAt: null,
    followUpAt: null,
    ...extra,
  });

  it("due follow-ups first, then retries, then news, then done", () => {
    const ordered = [
      row("new"),
      row("done"),
      row("followup"),
      row("retry"),
    ].sort(compareQueueRows);
    expect(ordered.map((r) => r.callState)).toEqual(["followup", "retry", "new", "done"]);
  });

  it("oldest retry attempt rises to the top of the retry block", () => {
    const older = row("retry", { lastOutcomeAt: new Date("2026-09-16T08:00:00Z") });
    const newer = row("retry", { lastOutcomeAt: new Date("2026-09-17T08:00:00Z") });
    expect([newer, older].sort(compareQueueRows)[0]).toBe(older);
  });

  it("most overdue follow-up rises to the top of the follow-up block", () => {
    const overdue = row("followup", { followUpAt: new Date("2026-09-15T08:00:00Z") });
    const today = row("followup", { followUpAt: new Date("2026-09-18T08:00:00Z") });
    expect([today, overdue].sort(compareQueueRows)[0]).toBe(overdue);
  });
});

describe("callStateLabel", () => {
  it("labels retries and undated due follow-ups", () => {
    expect(callStateLabel({ callState: "retry", followUpAt: null, lastOutcomeAt: null }, NOW)).toBe("No answer · try again");
    expect(callStateLabel({ callState: "followup", followUpAt: null, lastOutcomeAt: null }, NOW)).toBe("Follow up · due");
  });

  it("is overdue once the promised MINUTE has passed, in the smallest honest unit", () => {
    // Promised 10:00, it is 10:30 → overdue 30m.
    expect(
      callStateLabel({ callState: "followup", followUpAt: new Date("2026-09-18T10:00:00Z"), lastOutcomeAt: null }, new Date("2026-09-18T10:30:00Z")),
    ).toBe("Follow up · overdue 30m");
    // Promised 08:00, it is 10:00 → overdue 2h.
    expect(
      callStateLabel({ callState: "followup", followUpAt: new Date("2026-09-18T08:00:00Z"), lastOutcomeAt: null }, NOW),
    ).toBe("Follow up · overdue 2h");
    // Promised 3 days 2h ago → still reported in whole days.
    expect(
      callStateLabel({ callState: "followup", followUpAt: new Date("2026-09-15T08:00:00Z"), lastOutcomeAt: null }, NOW),
    ).toBe("Follow up · overdue 3d");
  });

  it("shows the promised time for a follow-up due later today", () => {
    const due = new Date("2026-09-18T12:30:00Z");
    expect(
      callStateLabel({ callState: "followup", followUpAt: due, lastOutcomeAt: null }, NOW),
    ).toBe(`Follow up · due ${formatCallTime(due)}`);
  });

  it("labels scheduled follow-ups by distance, with the promised time tomorrow", () => {
    const tomorrow = new Date("2026-09-19T09:00:00Z");
    expect(
      callStateLabel({ callState: "scheduled", followUpAt: tomorrow, lastOutcomeAt: null }, NOW),
    ).toBe(`Follow up · tomorrow ${formatCallTime(tomorrow)}`);
    expect(
      callStateLabel({ callState: "scheduled", followUpAt: new Date("2026-09-25T09:00:00Z"), lastOutcomeAt: null }, NOW),
    ).toBe("Follow up · in 7 days");
  });

  it("no label for new and done (chips already cover them)", () => {
    expect(callStateLabel({ callState: "new", followUpAt: null, lastOutcomeAt: null }, NOW)).toBeNull();
    expect(callStateLabel({ callState: "done", followUpAt: null, lastOutcomeAt: null }, NOW)).toBeNull();
  });
});

describe("formatCallTime", () => {
  it("formats local wall-clock time in 12h notation", () => {
    const d = new Date(2026, 8, 18, 17, 5, 0); // local 5:05 PM
    expect(formatCallTime(d)).toBe("5:05 PM");
    const noon = new Date(2026, 8, 18, 12, 0, 0);
    expect(formatCallTime(noon)).toBe("12:00 PM");
    const midnight = new Date(2026, 8, 18, 0, 30, 0);
    expect(formatCallTime(midnight)).toBe("12:30 AM");
  });
});

describe("endOfDay", () => {
  it("returns the last millisecond of the given day", () => {
    const end = endOfDay(new Date("2026-09-18T01:02:03.004Z"));
    expect(end.getHours()).toBe(23);
    expect(end.getMinutes()).toBe(59);
    expect(end.getSeconds()).toBe(59);
  });
});
