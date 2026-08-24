import { describe, expect, it } from "vitest";
import { GET as searchAssistRoute } from "../../../../app/api/ai/search-assist/route";
import { GET as compareRoute } from "../../../../app/api/ai/compare/route";
import { POST as moderationRoute } from "../../../../app/api/ai/moderation-assist/route";
import { assistSearchQuery } from "./search-assist";
import { compareListings, explainLocality } from "./explain";
import { reviewListingDraft } from "./moderation";
import { assertNoUnverifiedClaims, getAiProviderMode } from "./guardrails";

describe("safe AI assistance contracts", () => {
  it("keeps external AI disabled unless explicitly configured", () => {
    expect(getAiProviderMode(undefined)).toBe("disabled");
    expect(getAiProviderMode("deterministic")).toBe("deterministic");
  });

  it("assists search with deterministic structured hints", () => {
    const result = assistSearchQuery("3 BHK Paldi RERA under 2 cr");
    expect(result.structured.localitySlug).toBe("paldi");
    expect(result.structured.filters).toContain("3bhk");
    expect(result.structured.filters).toContain("rera");
  });

  it("creates fact-grounded locality and comparison explanations", () => {
    expect(explainLocality("paldi").text).toContain("Paldi");
    const comparison = compareListings("garden-courtyard", "thaltej-dusk-house");
    expect(comparison.text).toContain("₹1.85 Cr");
    expect(comparison.warnings).toEqual([]);
  });

  it("flags risky broker draft claims without auto-approval", () => {
    const review = reviewListingDraft({ title: "Guaranteed return villa", description: "Risk free and government endorsed deal", priceInr: 0, mediaRightsConfirmed: false });
    expect(review.autoApprovalAllowed).toBe(false);
    expect(review.flags.map((flag) => flag.code)).toEqual(expect.arrayContaining(["media_rights_missing", "price_missing", "unsupported_claim"]));
  });

  it("detects unverified risky language", () => {
    expect(assertNoUnverifiedClaims("This is a guaranteed return", ["return"])[0]).toContain("guaranteed");
  });

  it("exposes route contracts", async () => {
    const search = await (await searchAssistRoute(new Request("http://example.com/api/ai/search-assist?q=Paldi%203%20BHK"))).json();
    expect(search.structured.localitySlug).toBe("paldi");
    const compare = await (await compareRoute(new Request("http://example.com/api/ai/compare?left=garden-courtyard&right=thaltej-dusk-house"))).json();
    expect(compare.text).toContain("garden courtyard");
    const moderation = await (await moderationRoute(new Request("http://example.com/api/ai/moderation-assist", { method: "POST", body: JSON.stringify({ title: "Draft", description: "short", priceInr: 1, mediaRightsConfirmed: false }) }))).json();
    expect(moderation.autoApprovalAllowed).toBe(false);
  });
});
