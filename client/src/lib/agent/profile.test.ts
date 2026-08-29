import { describe, expect, it } from "vitest";
import { buildAgentJsonLd, buildAgentProfile, isRatingWithinScale, meanRating, SAMPLE_AGENT_REVIEWS, type AgentProfile } from "./profile";
import { demoBrokerSession } from "@/lib/auth/roles";

describe("agent profile & reviews", () => {
  it("builds an agent profile from a broker session", () => {
    const profile = buildAgentProfile(demoBrokerSession);
    expect(profile.slug).toBe("nivasa-partners");
    expect(profile.name).toBe("Nivasa Partners");
    expect(profile.badge).toBe("Verified partner");
  });

  it("derives mean rating only from verified-buyer reviews", () => {
    const reviews = [
      { id: "r1", buyerName: "A", role: "Bought", rating: 5, comment: "", source: "verified-buyer" as const, date: "2026-08-12" },
      { id: "r2", buyerName: "B", role: "Bought", rating: 4, comment: "", source: "verified-buyer" as const, date: "2026-08-12" },
    ];
    expect(meanRating(reviews)).toBe(4.5);
    expect(meanRating(SAMPLE_AGENT_REVIEWS)).toBe(0); // sample reviews don't aggregate
  });

  it("gives an agent with no verified reviews a zero rating", () => {
    const profile = buildAgentProfile(demoBrokerSession, SAMPLE_AGENT_REVIEWS);
    expect(profile.rating).toBe(0);
    expect(profile.reviewCount).toBe(0);
  });

  it("emits RealEstateAgent JSON-LD with aggregate rating only when present", () => {
    const noRating = buildAgentJsonLd(buildAgentProfile(demoBrokerSession, []));
    expect(noRating.aggregateRating).toBeUndefined();

    const withRating = buildAgentJsonLd(buildAgentProfile(demoBrokerSession, [{ id: "r", buyerName: "A", role: "Bought", rating: 5, comment: "", source: "verified-buyer", date: "2026-08-12" }]));
    expect((withRating.aggregateRating as { ratingValue: number }).ratingValue).toBe(5);
  });

  it("validates the rating scale", () => {
    expect(isRatingWithinScale(3)).toBe(true);
    expect(isRatingWithinScale(6)).toBe(false);
    expect(isRatingWithinScale(0)).toBe(false);
  });
});

describe("review markup is tied to genuine reviews", () => {
  const profileWith = (overrides: Partial<AgentProfile>): AgentProfile => ({
    id: "org", slug: "org", name: "Org", verificationStatus: "VERIFIED_PARTNER", badge: "Verified partner",
    reviews: [], rating: 0, reviewCount: 0, ...overrides,
  });

  it("omits AggregateRating when there are no verified reviews", () => {
    expect(buildAgentJsonLd(profileWith({})).aggregateRating).toBeUndefined();
  });

  it("never emits AggregateRating with a zero review count", () => {
    // The failure mode this closes: rating is derived from verified-buyer
    // reviews only, so a rating with a zero count should be unreachable — but
    // it is constructible, and an AggregateRating with reviewCount 0 is
    // invalid markup. The builder asserts the invariant itself.
    const jsonLd = buildAgentJsonLd(profileWith({ rating: 4.5, reviewCount: 0 }));
    expect(jsonLd.aggregateRating).toBeUndefined();
  });

  it("emits AggregateRating when genuine reviews back it", () => {
    const jsonLd = buildAgentJsonLd(profileWith({ rating: 4.5, reviewCount: 12 }));
    expect(jsonLd.aggregateRating).toEqual({ "@type": "AggregateRating", ratingValue: 4.5, reviewCount: 12 });
  });

  it("still omits rating markup for sample-only review sets", () => {
    // Contestant E: "AggregateRating/Review (genuine ones)". Sample reviews are
    // labelled sample and must never reach markup as if they were real.
    const profile = buildAgentProfile(demoBrokerSession, SAMPLE_AGENT_REVIEWS);
    expect(profile.rating).toBe(0);
    expect(buildAgentJsonLd(profile).aggregateRating).toBeUndefined();
  });
});
