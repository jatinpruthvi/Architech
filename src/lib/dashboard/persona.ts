/* Dashboard personas — what a person is SHOWN, never what they may DO.
 *
 * The product speaks of five kinds of people: buyer, owner, tenant,
 * broker/agent, builder. The auth model has five roles too, but they are not
 * the same five and must not be conflated:
 *
 *     AuthRole:        BUYER BROKER_MEMBER BROKER_ADMIN MODERATOR ADMIN
 *     DashboardPersona: buyer owner tenant broker builder
 *
 * `AuthRole` is an authority ladder — `roleRank` orders it, and
 * `authorizeRequest` enforces it server-side. Owner, tenant and builder have
 * no place on that ladder: a tenant is not "more privileged" than a buyer,
 * and letting a self-service sign-up pick "Builder" would be precisely the
 * escalation hole that `register/route.ts` (which hardcodes `role: "BUYER"`)
 * and `lister-type.ts` were written to prevent.
 *
 * So persona is a PRESENTATION dimension, exactly like `listerType`:
 *
 *   - It selects which panels a dashboard renders and in what order.
 *   - It grants nothing. Every panel still reads from an API that performs
 *     its own `authorizeRequest` check, so a forged persona changes the
 *     furniture and not the data.
 *   - The broker persona is only OFFERED to a session that already satisfies
 *     `canAccessBrokerDashboard()`. `personasForSession` is where that is
 *     decided, and `isPersonaAvailable` is the assertion the UI and the
 *     route both call, so the two cannot drift.
 *
 * Persona is deliberately switchable. Real people are several of these at
 * once — the classic Indian case is an owner who is also hunting for a bigger
 * flat, i.e. supply and demand in one household. Forcing a single persona per
 * account would make the product lie about one of them.
 */
import { canAccessBrokerDashboard, type AuthSession } from "@/lib/auth/roles";
import type { ListerType } from "@/lib/listing/lister-type";
import type { RequirementRole } from "@/lib/requirements";

export const DASHBOARD_PERSONAS = ["buyer", "owner", "tenant", "broker", "builder"] as const;
export type DashboardPersona = (typeof DASHBOARD_PERSONAS)[number];

export const DEFAULT_PERSONA: DashboardPersona = "buyer";

const PERSONA_SET = new Set<string>(DASHBOARD_PERSONAS);

export function isDashboardPersona(value: unknown): value is DashboardPersona {
  return typeof value === "string" && PERSONA_SET.has(value);
}

export type PersonaMeta = {
  persona: DashboardPersona;
  label: string;
  /** One line, second person, describing whose desk this is. */
  tagline: string;
  /** Demand-side personas are looking for property; supply-side have it. */
  side: "demand" | "supply" | "both";
};

export const PERSONA_META: Record<DashboardPersona, PersonaMeta> = {
  buyer: {
    persona: "buyer",
    label: "Buyer",
    tagline: "Track what you are looking for, what you saved, and who has replied.",
    side: "demand",
  },
  tenant: {
    persona: "tenant",
    label: "Tenant",
    tagline: "Follow your rental search, your shortlist, and your landlord conversations.",
    side: "demand",
  },
  owner: {
    persona: "owner",
    label: "Owner",
    tagline: "Your property, who has enquired about it, and what it needs before it can go live.",
    side: "supply",
  },
  builder: {
    persona: "builder",
    label: "Builder",
    tagline: "Your inventory across projects, enquiry volume, and RERA evidence.",
    side: "supply",
  },
  broker: {
    persona: "broker",
    label: "Broker / agent",
    tagline: "Both sides of the desk: listings, leads, and the partner channel.",
    side: "both",
  },
};

/* Persona -> the requirement role it files intent under. The requirement
   contract already models these five words (`RequirementRole`), so the
   dashboard reuses them rather than inventing a parallel vocabulary that
   would have to be mapped at every boundary. */
const PERSONA_REQUIREMENT_ROLE: Record<DashboardPersona, RequirementRole> = {
  buyer: "buyer",
  owner: "owner",
  tenant: "tenant",
  broker: "agent",
  builder: "builder",
};

export function requirementRoleForPersona(persona: DashboardPersona): RequirementRole {
  return PERSONA_REQUIREMENT_ROLE[persona];
}

/** The reverse: which dashboard a requirement belongs on. */
export function personaForRequirementRole(role: RequirementRole): DashboardPersona {
  return role === "agent" ? "broker" : role;
}

/* Which personas a given session may present as.
 *
 * Broker is gated on the REAL authority check, not on a declaration: a
 * signed-in buyer who declared `listerType: "BROKER"` at sign-up still cannot
 * select the broker persona, because `canAccessBrokerDashboard` requires a
 * broker role AND an organization membership.
 *
 * The other four are always available. That is safe because they gate
 * nothing, and it is necessary because a single account is routinely more
 * than one of them.
 */
export function personasForSession(session: AuthSession | null | undefined): DashboardPersona[] {
  const available: DashboardPersona[] = ["buyer", "owner", "tenant", "builder"];
  if (canAccessBrokerDashboard(session)) available.unshift("broker");
  return available;
}

export function isPersonaAvailable(session: AuthSession | null | undefined, persona: DashboardPersona): boolean {
  return personasForSession(session).includes(persona);
}

/* The persona to open on when the person has not chosen one.
 *
 * Order matters and encodes intent:
 *   1. A verified broker lands on their working desk.
 *   2. Otherwise the sign-up declaration is the best evidence available —
 *      someone who said "I own the property I intend to list" should not be
 *      shown a buyer's search dashboard first.
 *   3. Failing both, buyer: the least presumptuous default, and the only one
 *      that is true of essentially every visitor.
 */
export function defaultPersonaForSession(session: AuthSession | null | undefined): DashboardPersona {
  if (canAccessBrokerDashboard(session)) return "broker";
  const declared: ListerType | undefined = session?.user.listerType;
  if (declared === "OWNER") return "owner";
  return DEFAULT_PERSONA;
}

/** Coerce an untrusted persona (query string, cookie) to one this session may
    actually use. Never throws and never widens access — an unknown or
    unavailable value falls back to the session's default. */
export function resolvePersona(session: AuthSession | null | undefined, requested: unknown): DashboardPersona {
  if (isDashboardPersona(requested) && isPersonaAvailable(session, requested)) return requested;
  return defaultPersonaForSession(session);
}
