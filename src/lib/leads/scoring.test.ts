import { describe, expect, it } from "vitest";
import { leadGradeLabel, scoreLead } from "./scoring";

function lead(overrides: Partial<Parameters<typeof scoreLead>[0]> = {}) {
  return {
    message: "I would like to visit this home and discuss the price this week.",
    name: "Kinjal Shah",
    phoneMasked: "•••• ••• 3210",
    consentText: "I consent to masked contact for this enquiry.",
    email: "kinjal@example.com",
    ...overrides,
  };
}

describe("deterministic lead scoring", () => {
  it("scores a detailed, intent-rich, consented lead as hot", () => {
    const scored = scoreLead(lead());
    expect(scored.grade).toBe("hot");
    expect(scored.score).toBeGreaterThanOrEqual(75);
    expect(scored.signals.some((signal) => signal.includes("Intent keywords"))).toBe(true);
  });

  it("scores a sparse lead as cold", () => {
    const scored = scoreLead(lead({ message: "hi", phoneMasked: "••••", consentText: "", email: undefined }));
    expect(scored.grade).toBe("cold");
    expect(scored.score).toBeLessThan(45);
  });

  it("reports missing consent as a signal", () => {
    const scored = scoreLead(lead({ consentText: "" }));
    expect(scored.signals).toContain("Consent missing");
  });

  it("exposes grade labels", () => {
    expect(leadGradeLabel("hot")).toBe("Hot");
    expect(leadGradeLabel("warm")).toBe("Warm");
    expect(leadGradeLabel("cold")).toBe("Cold");
  });
});
