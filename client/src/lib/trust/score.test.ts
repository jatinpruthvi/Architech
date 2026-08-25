import { describe, expect, it } from "vitest";
import { badgesToTrustInput, computeTrustScore, computeTrustSignals, TRUST_CONFIG, trustGradeLabel } from "./score";

const fullTrust = {
  verification: "RERA_VERIFIED",
  brokerVerified: true,
  reraVerified: true,
  mediaRightsConfirmed: true,
  mediaApproved: true,
  meaningfulUpdatedAt: new Date().toISOString(),
  freshnessMaxDays: TRUST_CONFIG.defaultFreshnessMaxDays,
};

describe("trust verification score model", () => {
  it("scores a fully verified listing as HIGH with all signals met", () => {
    const score = computeTrustScore(fullTrust);
    expect(score.grade).toBe("HIGH");
    expect(score.score).toBe(100);
    expect(score.signals.every((signal) => signal.met)).toBe(true);
    expect(score.reasons[0]).toContain("Confirmed");
  });

  it("drops a listing to MEDIUM when RERA and broker signals are absent", () => {
    const score = computeTrustScore({
      verification: "SOURCE_REVIEWED",
      mediaRightsConfirmed: true,
      meaningfulUpdatedAt: new Date().toISOString(),
    });
    expect(score.grade).toBe("MEDIUM");
    expect(score.score).toBeGreaterThanOrEqual(TRUST_CONFIG.gradeThresholds.medium);
    expect(score.score).toBeLessThan(TRUST_CONFIG.gradeThresholds.high);
    expect(score.signals.find((signal) => signal.id === "rera_verified")?.met).toBe(false);
  });

  it("ranks an active dispute as LOW and explains the unmet signal", () => {
    const score = computeTrustScore({ ...fullTrust, reraDisputed: true });
    expect(score.grade).toBe("LOW");
    expect(score.signals.find((signal) => signal.id === "no_dispute")?.met).toBe(false);
    expect(score.reasons.join(" ")).toContain("Not yet confirmed");
  });

  it("treats an old listing as not-current within the freshness window", () => {
    const stale = new Date(Date.now() - (TRUST_CONFIG.defaultFreshnessMaxDays + 10) * 24 * 60 * 60 * 1000).toISOString();
    const score = computeTrustScore({ ...fullTrust, meaningfulUpdatedAt: stale });
    expect(score.signals.find((signal) => signal.id === "freshness_current")?.met).toBe(false);
    expect(score.score).toBe(86); // 100 - 14 freshness
  });

  it("derives structured signals from demo badge/status strings", () => {
    const input = badgesToTrustInput("RERA verified", "Updated 2 days ago");
    expect(input.reraVerified).toBe(true);
    expect(input.brokerVerified).toBe(false);
    expect(computeTrustScore(input).grade).toBe("HIGH");
  });

  it("exposes stable labels and grade labels", () => {
    expect(trustGradeLabel("HIGH")).toBe("High trust");
    expect(computeTrustSignals(fullTrust)).toHaveLength(6);
  });
});
