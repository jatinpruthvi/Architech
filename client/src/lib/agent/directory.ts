import { getListings } from "@/lib/repositories/listings";
import { demoBrokerSession } from "@/lib/auth/roles";
import { buildAgentProfile, SAMPLE_AGENT_REVIEWS, type AgentProfile } from "./profile";

/* Public agent directory (P1-AGENT-001 public slice).

   What exists before this module: agent/broker profiles and reviews as a DATA
   model (profile.ts), surfaced only inside trust flows. What did not exist
   was a public, crawlable surface — the gap-analysis "agent directory":
   people cannot evaluate a broker they cannot find.

   Honesty rules the rest of the product already lives by apply here:
   - never invent agents — the directory lists real organization records
     (fixture/demo in fixture mode, `BrokerOrganization` rows in prisma mode),
     and an empty directory shows the honest "become a verified partner"
     state rather than padding itself;
   - reviews are labelled by source, and sample reviews never claim to be
     verified buyers (profile.ts enforces this in JSON-LD too);
   - a profile's indexability follows the org's verification status, the same
     gate the trust badge uses. */

export type PublicAgentOrganization = {
  slug: string;
  name: string;
  citySlug: string;
  cityName: string;
  verificationStatus: string;
  reraNumber?: string;
  website?: string;
  listingCount: number;
  profile: AgentProfile;
};

export type PublicAgentOrganizationInput = {
  slug: string;
  name: string;
  citySlug: string;
  cityName: string;
  verificationStatus: string;
  reraNumber?: string | null;
  website?: string | null;
  listingCount?: number;
};

/** The AuthSession union for organization verification tiers. */
const VERIFICATION_TIERS = new Set(["DEMO", "SOURCE_REVIEWED", "VERIFIED_PARTNER", "RERA_VERIFIED", "DISPUTED", "STALE"]);

/** Every verification tier that is allowed a public profile page. */
const PUBLIC_VERIFICATION_STATUSES = new Set(["RERA_VERIFIED", "VERIFIED_PARTNER", "SOURCE_REVIEWED"]);

/** DB rows carry verificationStatus as an unconstrained string; the session
    contract wants the union. Unknown values fall back to the most cautious
    tier, matching the badge vocabulary's own fallback. */
function normalizeVerificationTier(value: string): "DEMO" | "SOURCE_REVIEWED" | "VERIFIED_PARTNER" | "RERA_VERIFIED" | "DISPUTED" | "STALE" {
  const normalized = value.toUpperCase();
  return (VERIFICATION_TIERS.has(normalized) ? normalized : "SOURCE_REVIEWED") as ReturnType<typeof normalizeVerificationTier>;
}

/** Verified tiers additionally earn indexability; source-reviewed orgs render but stay noindex. */
export function isAgentIndexable(verificationStatus: string): boolean {
  const normalized = verificationStatus.toUpperCase();
  return normalized === "RERA_VERIFIED" || normalized === "VERIFIED_PARTNER";
}

function toPublicAgent(input: PublicAgentOrganizationInput, listingCount: number): PublicAgentOrganization {
  /* The profile is rebuilt through profile.ts so the demo copy of an org and
     the seeded DB copy render identically — one formatting path, one badge
     vocabulary. */
  const profile = buildAgentProfile(
    {
      ...demoBrokerSession,
      organization: {
        ...(demoBrokerSession.organization as NonNullable<typeof demoBrokerSession.organization>),
        id: `org:${input.slug}`,
        slug: input.slug,
        name: input.name,
        verificationStatus: normalizeVerificationTier(input.verificationStatus),
      },
    },
    SAMPLE_AGENT_REVIEWS,
  );
  return {
    slug: input.slug,
    name: input.name,
    citySlug: input.citySlug,
    cityName: input.cityName,
    verificationStatus: normalizeVerificationTier(input.verificationStatus),
    reraNumber: input.reraNumber ?? undefined,
    website: input.website ?? undefined,
    listingCount,
    profile,
  };
}

/** Fixture/demo directory. Fixture listings are attributed to the demo
    organization everywhere else in the product (see the lead module), so the
    count is honest by the same convention. */
export function demoDirectoryAgents(): PublicAgentOrganization[] {
  const demo = demoBrokerSession.organization;
  const listingCount = getListings().length;
  return [
    toPublicAgent(
      {
        slug: demo?.slug ?? "nivasa-partners",
        name: demo?.name ?? "Nivasa Partners",
        citySlug: "ahmedabad",
        cityName: "Ahmedabad",
        verificationStatus: demo?.verificationStatus ?? "VERIFIED_PARTNER",
      },
      listingCount,
    ),
  ];
}

/** Prisma-row → public shape. Kept here so the server adapter stays a thin
    query and the vocabulary lives in one place. */
export function dbOrganizationToPublicAgent(
  row: PublicAgentOrganizationInput & { publicListings?: number },
): PublicAgentOrganization {
  return toPublicAgent(row, row.publicListings ?? row.listingCount ?? 0);
}

export function isPublicVerification(verificationStatus: string): boolean {
  return PUBLIC_VERIFICATION_STATUSES.has(verificationStatus.toUpperCase());
}
