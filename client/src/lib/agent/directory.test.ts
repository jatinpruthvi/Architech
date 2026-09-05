import { describe, expect, it } from "vitest";
import {
  dbOrganizationToPublicAgent,
  demoDirectoryAgents,
  isAgentIndexable,
  isPublicVerification,
} from "./directory";

describe("public agent directory", () => {
  it("fixture mode lists the demo organization with a real listing count", () => {
    const agents = demoDirectoryAgents();
    expect(agents).toHaveLength(1);
    expect(agents[0].slug).toBe("nivasa-partners");
    expect(agents[0].listingCount).toBeGreaterThan(100);
    expect(agents[0].citySlug).toBe("ahmedabad");
  });

  it("verification tier decides indexability and publication", () => {
    expect(isAgentIndexable("VERIFIED_PARTNER")).toBe(true);
    expect(isAgentIndexable("RERA_VERIFIED")).toBe(true);
    expect(isAgentIndexable("SOURCE_REVIEWED")).toBe(false);
    expect(isPublicVerification("SOURCE_REVIEWED")).toBe(true);
    expect(isPublicVerification("UNVERIFIED")).toBe(false);
    expect(isPublicVerification("random-junk")).toBe(false);
  });

  it("DB rows map to the same public shape, listing count included", () => {
    const agent = dbOrganizationToPublicAgent({
      slug: "acme-homes",
      name: "Acme Homes",
      citySlug: "mumbai",
      cityName: "Mumbai",
      verificationStatus: "RERA_VERIFIED",
      reraNumber: "A51900000001",
      website: "https://example.invalid",
      listingCount: 7,
      publicListings: 7,
    });
    expect(agent.slug).toBe("acme-homes");
    expect(agent.listingCount).toBe(7);
    expect(agent.profile.badge).toBe("RERA verified");
    expect(agent.profile.slug).toBe("acme-homes");
  });

  it("profiles keep sample reviews labelled as samples (never verified)", () => {
    const [agent] = demoDirectoryAgents();
    expect(agent.profile.reviewCount).toBe(0); // zero VERIFIED reviews by construction
    expect(agent.profile.reviews.length).toBeGreaterThan(0);
    for (const review of agent.profile.reviews) expect(review.source).toBe("sample");
  });
});
