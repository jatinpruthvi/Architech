/* Agent / broker-professional profile & reviews (P1-AGENT-001).
   Represents the listing partner (broker organization) as a reviewable entity:
   an agent profile carries a name/org, verification status, and a set of reviews
   from which a mean rating is derived. Server-safe, deterministic, memory-backed
   by default (a durable per-identity store arrives with live auth + DB).

   Reviews are shown honestly: sample/reviewed ratings are labelled and only
   aggregate into a displayed rating when present, so we never invent a score. */

import type { AuthSession } from "@/lib/auth/roles";

export type AgentReviewSource = "verified-buyer" | "sample";

export type AgentReview = {
  id: string;
  buyerName: string;
  role: string; // e.g. "Bought in Paldi"
  rating: number; // 1..5
  comment: string;
  source: AgentReviewSource;
  date: string;
};

export type AgentProfile = {
  id: string;
  slug: string;
  name: string;
  verificationStatus: string;
  phoneMasked?: string;
  email?: string;
  badge: string;
  reviews: AgentReview[];
  /** Derived, not stored: mean rating across verified reviews, 0 if none. */
  rating: number;
  reviewCount: number;
};

export const REVIEW_SCALE = { min: 1, max: 5 } as const;

export function meanRating(reviews: AgentReview[]): number {
  const verified = reviews.filter((review) => review.source === "verified-buyer");
  if (verified.length === 0) return 0;
  const sum = verified.reduce((total, review) => total + review.rating, 0);
  return Math.round((sum / verified.length) * 10) / 10;
}

function stableId(prefix: string, key: string): string {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `${prefix}_${hash.toString(36)}`;
}

/** Build an agent profile from a broker session (demo default) + its reviews. */
export function buildAgentProfile(
  session?: AuthSession,
  reviews: AgentReview[] = [],
): AgentProfile {
  const org = session?.organization;
  const id = org?.id ?? "demo-org-nivasa-partners";
  const slug = org?.slug ?? "nivasa-partners";
  const name = org?.name ?? "Nivasa Partners";
  const verification = org?.verificationStatus ?? "VERIFIED_PARTNER";
  return {
    id,
    slug,
    name,
    verificationStatus: verification,
    email: session?.user?.email,
    badge: badgeFromVerification(verification),
    reviews,
    rating: meanRating(reviews),
    reviewCount: reviews.filter((review) => review.source === "verified-buyer").length,
  };
}

function badgeFromVerification(verification: string): string {
  const normalized = verification.toUpperCase();
  if (normalized === "RERA_VERIFIED") return "RERA verified";
  if (normalized === "VERIFIED_PARTNER") return "Verified partner";
  if (normalized === "SOURCE_REVIEWED") return "Source reviewed";
  return "Source reviewed";
}

/** A stable set of sample reviews used to demonstrate the rating surface.
    All are labelled source: "sample" and never invent real buyer claims. */
const SAMPLE_REVIEWS: AgentReview[] = [
  { id: "review_sample_1", buyerName: "Kinjal S.", role: "Bought in Paldi", rating: 5, comment: "Masked contact worked — no spam calls, and the source trail was clear.", source: "sample", date: "2026-08-12" },
  { id: "review_sample_2", buyerName: "Rohan M.", role: "Bought in Thaltej", rating: 4, comment: "Transactions were transparent and the RERA number was on the page.", source: "sample", date: "2026-08-15" },
];

export const SAMPLE_AGENT_REVIEWS: AgentReview[] = SAMPLE_REVIEWS.map((review) => ({ ...review, id: stableId("review", review.id) }));

export const isRatingWithinScale = (rating: number): boolean => rating >= REVIEW_SCALE.min && rating <= REVIEW_SCALE.max;

export function buildAgentJsonLd(profile: AgentProfile) {
  return {
    "@type": "RealEstateAgent",
    name: profile.name,
    identifier: profile.slug,
    url: "/guide/",
    description: `Verified broker organization: ${profile.verificationStatus.replaceAll("_", " ").toLowerCase()}.`,
    aggregateRating: profile.rating > 0
      ? { "@type": "AggregateRating", ratingValue: profile.rating, reviewCount: profile.reviewCount }
      : undefined,
  };
}
