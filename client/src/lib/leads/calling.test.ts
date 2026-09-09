import { describe, expect, it } from "vitest";
import {
  CALL_OUTCOMES,
  DEFAULT_CALLING_HOURS,
  LEAD_STAGES,
  OUTCOME_RULES,
  REVEAL_BLOCKED_COPY,
  REVEAL_BLOCKED_REASONS,
  decideReveal,
  isWithinCallingHours,
  istMinutesOfDay,
  nextStageFor,
  parseCallingHours,
  planAllowsReveal,
  type LeadStage,
  type RevealGateInput,
} from "./calling";

/* The gate inputs that represent "everything is fine". Each test perturbs one
   field, so a failure names the check that broke rather than the whole gate. */
const OPEN: RevealGateInput = {
  planStatus: "ACTIVE",
  hasPermission: true,
  ownedBySessionOrg: true,
  humanFirstTouch: true,
  suppressed: false,
  withinCallingHours: true,
  attemptsRemaining: true,
  contactStored: true,
};

describe("call outcome → lead stage mapping (workflow doc §3)", () => {
  it("keeps the stage put for an unanswered or busy dial", () => {
    // §3: "No answer → Keep current stage" and "Busy/call later → Keep current
    // stage". The whole point of separating outcome from stage is that a missed
    // call must not read as pipeline movement.
    for (const stage of LEAD_STAGES) {
      expect(nextStageFor(stage, "NO_ANSWER")).toBe(stage);
      expect(nextStageFor(stage, "BUSY_CALL_LATER")).toBe(stage);
    }
  });

  it("moves to AT LEAST contacted on a connected call, never backwards", () => {
    expect(nextStageFor("NEW", "CONNECTED_INTERESTED")).toBe("CONTACTED");
    // A lead already deep in the funnel keeps its position: one more "interested"
    // call must not drag Negotiation back down to Contacted.
    expect(nextStageFor("NEGOTIATION", "CONNECTED_INTERESTED")).toBe("NEGOTIATION");
    expect(nextStageFor("WON", "CONNECTED_FOLLOWUP")).toBe("WON");
    expect(nextStageFor("CONTACTED", "CONNECTED_FOLLOWUP")).toBe("CONTACTED");
  });

  it("reaches the Real Estate profile's Site Visit step", () => {
    // §3 places Site Visit Scheduled between Qualified and Proposal.
    expect(nextStageFor("NEW", "CONNECTED_SITE_VISIT")).toBe("SITE_VISIT");
    expect(nextStageFor("QUALIFIED", "CONNECTED_SITE_VISIT")).toBe("SITE_VISIT");
    expect(nextStageFor("NEGOTIATION", "CONNECTED_SITE_VISIT")).toBe("NEGOTIATION");
  });

  it("loses the lead on not-interested and wrong-number", () => {
    expect(nextStageFor("NEW", "NOT_INTERESTED")).toBe("LOST");
    expect(nextStageFor("QUALIFIED", "WRONG_OR_INVALID_NUMBER")).toBe("LOST");
    // `set`, not `atLeast`: a lost lead is lost whatever it was.
    expect(nextStageFor("NEGOTIATION", "NOT_INTERESTED")).toBe("LOST");
  });

  it("requires a next action or a lost reason for every outcome", () => {
    // §3 "Required next action" is populated for all seven rows — there is no
    // outcome that can be logged with nothing attached, which is what stops the
    // trail becoming a pile of undated dials.
    for (const outcome of CALL_OUTCOMES) expect(OUTCOME_RULES[outcome].requires).not.toBe("NOTHING");
  });

  it("suppresses contact permanently only on the two stop outcomes", () => {
    const suppressors = CALL_OUTCOMES.filter((outcome) => OUTCOME_RULES[outcome].suppressesContact);
    expect(suppressors).toEqual(["NOT_INTERESTED", "WRONG_OR_INVALID_NUMBER"]);
  });

  it("reaches a defined stage for every outcome from every stage", () => {
    // Total-function check: no outcome/stage pair may fall through to undefined.
    for (const outcome of CALL_OUTCOMES) {
      for (const stage of LEAD_STAGES) {
        expect(LEAD_STAGES).toContain(nextStageFor(stage, outcome));
      }
    }
  });
});

describe("the reveal gate", () => {
  it("opens when every check passes", () => {
    expect(decideReveal(OPEN)).toEqual({ ok: true });
    expect(decideReveal({ ...OPEN, planStatus: "TRIAL" })).toEqual({ ok: true });
  });

  it("refuses a broker with no activated plan (decision D3)", () => {
    expect(decideReveal({ ...OPEN, planStatus: "NONE" })).toEqual({ ok: false, reason: "PLAN_REQUIRED" });
    expect(decideReveal({ ...OPEN, planStatus: "EXPIRED" })).toEqual({ ok: false, reason: "PLAN_REQUIRED" });
    expect(planAllowsReveal("ACTIVE")).toBe(true);
    expect(planAllowsReveal("TRIAL")).toBe(true);
    expect(planAllowsReveal("EXPIRED")).toBe(false);
    expect(planAllowsReveal("NONE")).toBe(false);
  });

  it("refuses each individual gate", () => {
    expect(decideReveal({ ...OPEN, ownedBySessionOrg: false })).toEqual({ ok: false, reason: "NOT_OWNED" });
    expect(decideReveal({ ...OPEN, hasPermission: false })).toEqual({ ok: false, reason: "NO_PERMISSION" });
    expect(decideReveal({ ...OPEN, humanFirstTouch: false })).toEqual({ ok: false, reason: "CONSENT_CLASS" });
    expect(decideReveal({ ...OPEN, suppressed: true })).toEqual({ ok: false, reason: "SUPPRESSED" });
    expect(decideReveal({ ...OPEN, contactStored: false })).toEqual({ ok: false, reason: "NOT_STORED" });
    expect(decideReveal({ ...OPEN, withinCallingHours: false })).toEqual({ ok: false, reason: "OUTSIDE_HOURS" });
    expect(decideReveal({ ...OPEN, attemptsRemaining: false })).toEqual({ ok: false, reason: "ATTEMPT_LIMIT" });
  });

  it("puts ownership and permission ahead of the commercial plan message", () => {
    // Order is the contract. A broker who does not own the lead must be told
    // that, not sold a plan — otherwise the gate leaks which leads exist and
    // offers an upgrade that would not help.
    expect(decideReveal({ ...OPEN, ownedBySessionOrg: false, planStatus: "NONE" })).toEqual({ ok: false, reason: "NOT_OWNED" });
    expect(decideReveal({ ...OPEN, hasPermission: false, planStatus: "NONE" })).toEqual({ ok: false, reason: "NO_PERMISSION" });
    expect(decideReveal({ ...OPEN, planStatus: "NONE", suppressed: true })).toEqual({ ok: false, reason: "PLAN_REQUIRED" });
  });

  it("reports NOT_STORED ahead of the transient gates", () => {
    // A pre-migration lead can never be dialled. Telling that broker it is
    // "outside calling hours" would invite them to come back at 09:00 for
    // something that will still not work.
    expect(decideReveal({ ...OPEN, contactStored: false, withinCallingHours: false })).toEqual({ ok: false, reason: "NOT_STORED" });
    expect(decideReveal({ ...OPEN, contactStored: false, attemptsRemaining: false })).toEqual({ ok: false, reason: "NOT_STORED" });
  });

  it("has broker-facing copy for every blocked reason, and no reason without copy", () => {
    // A blocked Call button that cannot explain itself is a dead button.
    for (const reason of REVEAL_BLOCKED_REASONS) {
      expect(REVEAL_BLOCKED_COPY[reason].title.length).toBeGreaterThan(5);
      expect(REVEAL_BLOCKED_COPY[reason].body.length).toBeGreaterThan(15);
    }
    expect(Object.keys(REVEAL_BLOCKED_COPY).sort()).toEqual([...REVEAL_BLOCKED_REASONS].sort());
  });

  it("names the plan as the actionable route to unlocking calls", () => {
    expect(REVEAL_BLOCKED_COPY.PLAN_REQUIRED.cta).toBeTruthy();
  });
});

describe("calling hours are evaluated in IST, not server-local time", () => {
  it("converts an instant to IST minutes past midnight regardless of host tz", () => {
    // 06:30 UTC is 12:00 IST. Computed from the epoch, so a UTC CI box and a
    // Kolkata dev machine agree.
    expect(istMinutesOfDay(new Date("2026-09-08T06:30:00Z"))).toBe(12 * 60);
    // 18:00 UTC is 23:30 IST — crosses midnight.
    expect(istMinutesOfDay(new Date("2026-09-08T18:00:00Z"))).toBe(23 * 60 + 30);
  });

  it("allows the default 09:00–20:00 IST window and refuses either side of it", () => {
    const at = (hhmm: string) => {
      // Build a UTC instant that lands on hhmm IST by subtracting the 5:30 offset.
      const [h, m] = hhmm.split(":").map(Number);
      return new Date(Date.UTC(2026, 8, 8, h, m) - (5 * 60 + 30) * 60_000);
    };
    expect(isWithinCallingHours(at("09:00"), DEFAULT_CALLING_HOURS)).toBe(true);
    expect(isWithinCallingHours(at("13:30"), DEFAULT_CALLING_HOURS)).toBe(true);
    expect(isWithinCallingHours(at("19:59"), DEFAULT_CALLING_HOURS)).toBe(true);
    expect(isWithinCallingHours(at("20:00"), DEFAULT_CALLING_HOURS)).toBe(false);
    expect(isWithinCallingHours(at("08:59"), DEFAULT_CALLING_HOURS)).toBe(false);
    expect(isWithinCallingHours(at("23:00"), DEFAULT_CALLING_HOURS)).toBe(false);
  });

  it("handles a window that wraps midnight", () => {
    const nightShift = { startHour: 21, startMinute: 0, endHour: 6, endMinute: 0 };
    const at = (hhmm: string) => {
      const [h, m] = hhmm.split(":").map(Number);
      return new Date(Date.UTC(2026, 8, 8, h, m) - (5 * 60 + 30) * 60_000);
    };
    expect(isWithinCallingHours(at("22:00"), nightShift)).toBe(true);
    expect(isWithinCallingHours(at("03:00"), nightShift)).toBe(true);
    expect(isWithinCallingHours(at("12:00"), nightShift)).toBe(false);
  });

  it("parses a configured window and fails closed on nonsense", () => {
    expect(parseCallingHours("09:00-20:00")).toEqual(DEFAULT_CALLING_HOURS);
    expect(parseCallingHours(" 9:05 - 21:30 ")).toEqual({ startHour: 9, startMinute: 5, endHour: 21, endMinute: 30 });
    // An unparseable window must refuse calling, never allow it: guessing open
    // would let a typo turn into calls at 3am.
    expect(parseCallingHours(undefined)).toBeNull();
    expect(parseCallingHours("")).toBeNull();
    expect(parseCallingHours("nine to eight")).toBeNull();
    expect(parseCallingHours("25:00-26:00")).toBeNull();
    expect(parseCallingHours("09:00-20:99")).toBeNull();
  });
});

describe("the vocabularies stay separate (§3)", () => {
  it("does not reuse stage names as outcomes", () => {
    // If these two lists ever merge, a missed call starts moving pipeline.
    const overlap = (CALL_OUTCOMES as readonly string[]).filter((o) => (LEAD_STAGES as readonly string[]).includes(o));
    expect(overlap).toEqual([]);
  });

  it("has a label for every outcome and every stage", () => {
    const stageLabels: LeadStage[] = [...LEAD_STAGES];
    expect(stageLabels).toHaveLength(8);
    expect(CALL_OUTCOMES).toHaveLength(7);
  });
});
