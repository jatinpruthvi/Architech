/* Who is listing the property: the owner, or a broker acting for them.
 *
 * This is a DECLARATION, not a permission.
 *
 * It is captured at sign-up and stored on the user so the listing form can
 * default itself sensibly, and it is stored again per-listing because the two
 * genuinely differ: a broker may own the flat next door, and an owner may later
 * appoint an agent. The listing-level value is what a buyer is told, so it is
 * the one that must be right — the account-level value only chooses which
 * checkbox starts ticked.
 *
 * SECURITY — read before wiring this to anything that grants access.
 * `BROKER` here means "this person said they are a broker at sign-up". It is
 * self-asserted, unverified, and MUST NOT influence authorisation. Broker
 * permissions come exclusively from an `AuthRole` plus a `BrokerUser`
 * membership row, granted through onboarding (see
 * docs/auth/phase-1-better-auth-organizations.md). Keeping the two apart is why
 * `POST /api/auth/register/` can accept a lister type at all without becoming a
 * privilege-escalation hole: the declared type is written to a profile field,
 * never to `role`.
 *
 * For a buyer reading a dossier the distinction is material — "listed by owner"
 * and "listed by agent" carry different expectations about negotiation and fees
 * — which is exactly why an unverified claim must be labelled as declared and
 * not rendered as though the platform had checked it.
 */

export const LISTER_TYPE_OPTIONS = [
  {
    value: "OWNER",
    label: "Owner",
    slug: "owner",
    /** Shown at sign-up. */
    description: "I own the property I intend to list.",
  },
  {
    value: "BROKER",
    label: "Broker / agent",
    slug: "broker",
    description: "I list property on behalf of owners.",
  },
] as const;

export type ListerType = (typeof LISTER_TYPE_OPTIONS)[number]["value"];

/** The safer default: an unverified account is assumed to be an owner, because
    claiming to be an agent is the claim that carries professional weight. */
export const DEFAULT_LISTER_TYPE: ListerType = "OWNER";

const LISTER_TYPE_CODES = new Set<ListerType>(LISTER_TYPE_OPTIONS.map((option) => option.value));

/* Legacy/loose spellings accepted on input. The requirement capture form has
   used lowercase "owner"/"agent" since Phase 1, so those must map rather than
   be rejected and silently become the default. */
const LISTER_TYPE_ALIASES: Record<string, ListerType> = {
  owner: "OWNER",
  broker: "BROKER",
  agent: "BROKER",
  "broker/agent": "BROKER",
  "broker / agent": "BROKER",
  builder: "BROKER",
};

export function isListerType(value: unknown): value is ListerType {
  return typeof value === "string" && LISTER_TYPE_CODES.has(value as ListerType);
}

/** Coerce untrusted input to a reviewed code, or `undefined` if unrecognised.
    Returns `undefined` rather than the default so a caller can tell "absent"
    from "explicitly owner" — a validator needs that difference. */
export function normalizeListerType(value: unknown): ListerType | undefined {
  if (isListerType(value)) return value;
  if (typeof value !== "string") return undefined;
  return LISTER_TYPE_ALIASES[value.trim().toLowerCase()];
}

export function labelForListerType(value: ListerType): string {
  return LISTER_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

/** Buyer-facing attribution. Deliberately says "declared" — the platform has
    not verified ownership, and implying otherwise is the fabricated trust
    signal the architecture's trust rules exist to prevent. */
export function attributionLabel(value: ListerType): string {
  return value === "OWNER" ? "Listed by owner (declared)" : "Listed by broker (declared)";
}

/** The checkbox default for a new listing, given the account's declaration.
    Falls back to OWNER when the account predates this field. */
export function defaultListerTypeForAccount(declared?: ListerType | null): ListerType {
  return declared ?? DEFAULT_LISTER_TYPE;
}
