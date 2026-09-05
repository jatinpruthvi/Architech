import type { ListerType } from "@/lib/listing/lister-type";

export type AuthRole = "BUYER" | "BROKER_MEMBER" | "BROKER_ADMIN" | "MODERATOR" | "ADMIN";

export type AuthOrganization = {
  id: string;
  slug: string;
  name: string;
  verificationStatus: "DEMO" | "SOURCE_REVIEWED" | "VERIFIED_PARTNER" | "RERA_VERIFIED" | "DISPUTED" | "STALE";
  /** Broker business contact only; never an end-customer phone. */
  businessPhoneE164?: string;
  businessPhoneMasked?: string;
};

export type AuthSession = {
  user: {
    id: string;
    name: string;
    email: string;
    role: AuthRole;
    /* Self-declared at sign-up: does this person list as an owner or a broker?
       It defaults the listing form's attribution checkbox and NOTHING else.
       It is not a permission and must never be read as one — broker access
       comes from `role` plus organization membership. See
       lib/listing/lister-type.ts. */
    listerType?: ListerType;
    /* Verified mobile number in E.164, once sign-up captures one.

       Phone-verified sign-up is not built yet, so this is absent today and
       every consumer must treat it as optional. It exists now because the
       requirement form should PREFILL the number the person already verified
       rather than asking them to retype it -- when the field starts being
       populated, that behaviour turns on with no further change here. */
    phoneE164?: string;
  };
  organization?: AuthOrganization;
  permissions: string[];
  source: "better-auth-contract-demo" | "better-auth-live";
};

export const roleRank: Record<AuthRole, number> = {
  BUYER: 0,
  BROKER_MEMBER: 10,
  BROKER_ADMIN: 20,
  MODERATOR: 30,
  ADMIN: 40,
};

export const demoBrokerSession: AuthSession = {
  user: {
    id: "demo-user-broker-admin",
    name: "Nivasa Demo Admin",
    email: "broker-admin@example.com",
    role: "BROKER_ADMIN",
    listerType: "BROKER",
  },
  organization: {
    id: "demo-org-nivasa-partners",
    slug: "nivasa-partners",
    name: "Nivasa Partners",
    verificationStatus: "VERIFIED_PARTNER",
    businessPhoneMasked: "+91-79••••••••",
  },
  permissions: [
    "broker.dashboard.read",
    "listing.draft.create",
    "lead.inbox.read",
    "lead.inbox.write",
    "broker.channel.read",
    "broker.channel.write",
    "organization.profile.read",
    "authority.registry.read",
    "authority.registry.write",
    "moderation.queue.read",
    "moderation.listings.write",
    "listing.review.moderate",
    "media.moderation.write",
    "rera.corrections.write",
    "media.upload.write",
    "saved-search.read",
    "saved-search.write",
    "channel.read",
    "channel.write",
  ],
  source: "better-auth-contract-demo",
};

/* Role → permission grant for live Better Auth sessions. The demo session
   carries a hardcoded list; a live session derives the same semantics from its
   role so guarded APIs behave identically in both modes. */
const ROLE_PERMISSIONS_SOURCE: string[] = [
  "broker.dashboard.read",
  "listing.draft.create",
  "lead.inbox.read",
  /* Writes are not reads: reply/close/delete/consent-revoke on a lead require
     the explicit write grant (second dashboard audit — flagged note). A
     read-only introspection session can now exist without inheriting
     mutation rights by accident. */
  "lead.inbox.write",
  "broker.channel.read",
  "broker.channel.write",
  "organization.profile.read",
  "authority.registry.read",
  "authority.registry.write",
  "media.upload.write",
  "media.moderation.write",
  "moderation.queue.read",
  "moderation.listings.write",
  "listing.review.moderate",
  "rera.corrections.write",
  "saved-search.read",
  "saved-search.write",
  "channel.read",
  "channel.write",
];

const ROLE_PERMISSIONS: Record<AuthRole, string[]> = {
  BUYER: ["saved-search.read", "saved-search.write"],
  BROKER_MEMBER: [
    "broker.dashboard.read",
    "listing.draft.create",
    "lead.inbox.read",
    "lead.inbox.write",
    "broker.channel.read",
    "broker.channel.write",
    "organization.profile.read",
    "authority.registry.read",
    "media.upload.write",
    "saved-search.read",
    "saved-search.write",
    /* Members trade on the channel; publishing is gated on the ORGANIZATION's
       verification, not on the individual's seniority. */
    "channel.read",
    "channel.write",
  ],
  BROKER_ADMIN: [...ROLE_PERMISSIONS_SOURCE],
  MODERATOR: [
    "moderation.queue.read",
    "moderation.listings.write",
    "listing.review.moderate",
    "media.moderation.write",
    "authority.registry.read",
    "authority.registry.write",
    "rera.corrections.write",
  ],
  /* ADMIN bypasses checks via `requirePermission`; the list exists so a
     session introspection shows the role's surface. */
  ADMIN: ["platform.admin"],
};

export function permissionsForRole(role: AuthRole): string[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasRoleAtLeast(role: AuthRole, minimum: AuthRole): boolean {
  return roleRank[role] >= roleRank[minimum];
}

export function canAccessBrokerDashboard(session?: AuthSession | null): boolean {
  if (!session) return false;
  return hasRoleAtLeast(session.user.role, "BROKER_MEMBER") && Boolean(session.organization);
}

export function requirePermission(session: AuthSession | null | undefined, permission: string): boolean {
  return Boolean(session?.permissions.includes(permission) || session?.user.role === "ADMIN");
}
