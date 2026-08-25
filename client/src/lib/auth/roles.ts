export type AuthRole = "BUYER" | "BROKER_MEMBER" | "BROKER_ADMIN" | "MODERATOR" | "ADMIN";

export type AuthOrganization = {
  id: string;
  slug: string;
  name: string;
  verificationStatus: "DEMO" | "SOURCE_REVIEWED" | "VERIFIED_PARTNER" | "RERA_VERIFIED" | "DISPUTED" | "STALE";
};

export type AuthSession = {
  user: {
    id: string;
    name: string;
    email: string;
    role: AuthRole;
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
  },
  organization: {
    id: "demo-org-nivasa-partners",
    slug: "nivasa-partners",
    name: "Nivasa Partners",
    verificationStatus: "VERIFIED_PARTNER",
  },
  permissions: [
    "broker.dashboard.read",
    "listing.draft.create",
    "lead.inbox.read",
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
  ],
  source: "better-auth-contract-demo",
};

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
