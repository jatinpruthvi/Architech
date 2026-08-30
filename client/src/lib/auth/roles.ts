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

/* Role → permission grant for live Better Auth sessions. The demo session
   carries a hardcoded list; a live session derives the same semantics from its
   role so guarded APIs behave identically in both modes. */
const ROLE_PERMISSIONS_SOURCE: string[] = [
  "broker.dashboard.read",
  "listing.draft.create",
  "lead.inbox.read",
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
];

const ROLE_PERMISSIONS: Record<AuthRole, string[]> = {
  BUYER: ["saved-search.read", "saved-search.write"],
  BROKER_MEMBER: [
    "broker.dashboard.read",
    "listing.draft.create",
    "lead.inbox.read",
    "organization.profile.read",
    "authority.registry.read",
    "media.upload.write",
    "saved-search.read",
    "saved-search.write",
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
