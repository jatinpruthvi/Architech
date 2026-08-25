import { describe, expect, it } from "vitest";
import { validateAuthorityAsset, validateOutreach, type AuthorityAsset } from "./authority";

const goodAsset: AuthorityAsset = {
  id: "asset-guide-rera",
  type: "guide",
  title: "How we verify against Gujarat RERA",
  isNofollow: true,
  paidForLink: false,
  disclosure: "declared",
};

describe("authority & outreach governance", () => {
  it("accepts a compliant owned guidance asset", () => {
    expect(validateAuthorityAsset(goodAsset).ok).toBe(true);
  });

  it("rejects paid links and undisclosed external links", () => {
    expect(validateAuthorityAsset({ ...goodAsset, paidForLink: true }).reasons).toContain("Paid links are not allowed in Phase 1 authority work.");
    expect(validateAuthorityAsset({ ...goodAsset, type: "field-note", isNofollow: false, disclosure: "n-a" }).ok).toBe(false);
  });

  it("requires a reviewed asset for accepted outreach", () => {
    expect(validateOutreach({ id: "o1", date: "2026-08-24", target: "example.com", outcome: "accepted" }).ok).toBe(false);
    const decision = validateOutreach({ id: "o1", date: "2026-08-24", target: "example.com", outcome: "accepted", assetId: "asset-guide-rera", reviewedBy: "SEO Lead" }, [goodAsset]);
    expect(decision.ok).toBe(true);
  });

  it("flags accepted outreach that references a missing asset", () => {
    const decision = validateOutreach({ id: "o2", date: "2026-08-24", target: "example.com", outcome: "accepted", assetId: "does-not-exist", reviewedBy: "SEO Lead" }, [goodAsset]);
    expect(decision.reasons.some((reason) => reason.includes("not found"))).toBe(true);
  });
});
