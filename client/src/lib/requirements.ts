/* Requirement capture contract.

   Location identity is explicit and city-scoped: APIs accept stable slugs, not
   presentation labels. This fixture adapter mirrors the database relationship
   (`RequirementLocality` -> `Locality`) and rejects a locality from another
   city. Slugs are transitional public identifiers; persisted production rows
   resolve them to immutable City/Locality ids before insert. */
import { liveCities } from "@/lib/cities";
import { findLocality } from "@/lib/localities";

/* Four intents, not two. The form previously offered only "buy" and "rent",
   which silently assumed every visitor was demand-side: an owner with a flat
   to sell, or a landlord looking for a tenant, had no honest option and had to
   misfile themselves as a buyer.

   `list_sale` / `list_rent` are supply-side; `buy` / `rent` are demand-side.
   Which pair applies follows from the ROLE, so the role question now comes
   first -- see `intentsForRole`. */
export type RequirementIntent = "buy" | "rent" | "list_sale" | "list_rent";
export type RequirementRole = "buyer" | "owner" | "tenant" | "agent" | "builder";
export type RequirementCategory = "residential" | "commercial" | "pg" | "plot" | "land" | "auction";

export type RequirementInput = {
  intent: RequirementIntent;
  /** Stable city slug resolved to a database id at the write boundary. */
  citySlug: string;
  category: RequirementCategory;
  subtype: string;
  /** Matching-grade property code used by broker-channel demand generation. */
  propertyType?: string;
  bhkMin?: number | null;
  bhkMax?: number | null;
  areaMinSqft?: number | null;
  areaMaxSqft?: number | null;
  budgetMinInr?: number | null;
  budgetMaxInr?: number | null;
  /** Optional owner org when the requirement is captured inside broker workspace. */
  organizationId?: string | null;
  /** Stable locality slugs; every value must belong to `citySlug`. */
  localitySlugs: string[];
  role: RequirementRole;
  name: string;
  phone: string;
  consentText: string;
  idempotencyKey?: string;
  /* Owning account, when a signed-in person submitted the brief.

     Server-assigned ONLY. The API overwrites whatever arrives in the body
     with the id from the verified session, so a caller cannot file a
     requirement against somebody else's dashboard by posting their user id. */
  userId?: string | null;
};

export type RequirementRecord = Omit<RequirementInput, "phone"> & {
  id: string;
  phoneMasked: string;
  status: "NEW";
  createdAt: string;
};

type RequirementResult =
  | { ok: true; requirement: RequirementRecord; duplicate: boolean }
  | { ok: false; status: number; errors: string[] };

const requirementsByKey = new Map<string, RequirementRecord>();

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits.length < 4 ? "••••" : `•••• ••• ${digits.slice(-4)}`;
}

function stableId(key: string) {
  let hash = 0;
  for (const char of key) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return `req_${hash.toString(36)}`;
}

const categories = new Set<RequirementCategory>(["residential", "commercial", "pg", "plot", "land", "auction"]);
const intents = new Set<RequirementIntent>(["buy", "rent", "list_sale", "list_rent"]);
const citySlugs = new Set(liveCities.map((city) => city.slug));
const roles = new Set<RequirementRole>(["buyer", "owner", "tenant", "agent", "builder"]);

/* Which intents make sense for each role.

   A tenant does not sell; an owner posting their own flat is not "buying".
   Agents and builders work both sides, so they keep the full set. This is the
   contract the UI renders from, so the two cannot drift apart. */
const ROLE_INTENTS: Record<RequirementRole, RequirementIntent[]> = {
  buyer: ["buy", "rent"],
  tenant: ["rent"],
  owner: ["list_sale", "list_rent"],
  agent: ["buy", "rent", "list_sale", "list_rent"],
  builder: ["list_sale", "list_rent"],
};

export function intentsForRole(role: RequirementRole): RequirementIntent[] {
  return [...(ROLE_INTENTS[role] ?? ROLE_INTENTS.buyer)];
}

export function isIntentAllowedForRole(role: RequirementRole, intent: RequirementIntent): boolean {
  return (ROLE_INTENTS[role] ?? []).includes(intent);
}

/** Supply-side intents describe a property the person already has. */
export function isSupplyIntent(intent: RequirementIntent): boolean {
  return intent === "list_sale" || intent === "list_rent";
}

const INTENT_LABELS: Record<RequirementIntent, string> = {
  buy: "Buy a place",
  rent: "Rent a place",
  list_sale: "Sell my property",
  list_rent: "Find a tenant",
};

export function intentLabel(intent: RequirementIntent): string {
  return INTENT_LABELS[intent] ?? intent;
}

/* Localities are a PREFERENCE on the demand side and a FACT on the supply
   side. A buyer may reasonably say "any of these six areas"; an owner's flat
   is in exactly one place, and asking them to tick a list invites them to tick
   several, which would make the record untrue. Supply-side requirements
   therefore take exactly one locality. */
export const MAX_PREFERRED_LOCALITIES = 8;

function normalizedLocalitySlugs(input: Partial<RequirementInput>): string[] {
  return (input.localitySlugs ?? []).map((slug) => slug.trim()).filter(Boolean);
}

function toPositiveInteger(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? Math.round(number) : null;
}

export function propertyTypeFromRequirement(input: Partial<RequirementInput>): string {
  const explicit = String(input.propertyType ?? "").trim().toUpperCase().replace(/[^A-Z_]/g, "_");
  if (explicit) return explicit;
  const subtype = String(input.subtype ?? "").toLowerCase();
  if (subtype.includes("villa")) return "VILLA";
  if (subtype.includes("plot")) return "PLOT";
  if (subtype.includes("land")) return "LAND";
  if (subtype.includes("shop")) return "SHOP";
  if (subtype.includes("office")) return "OFFICE";
  return "APARTMENT";
}

export type RequirementLocationValidator = {
  cityExists(citySlug: string): boolean;
  localityBelongs(citySlug: string, localitySlug: string): boolean;
};

const fixtureLocationValidator: RequirementLocationValidator = {
  cityExists: (citySlug) => citySlugs.has(citySlug),
  localityBelongs: (citySlug, localitySlug) => Boolean(findLocality(localitySlug, citySlug)),
};

export function validateRequirementInput(input: Partial<RequirementInput>, locationValidator = fixtureLocationValidator) {
  const errors: string[] = [];
  if (!intents.has(input.intent as RequirementIntent)) errors.push("Choose what you want to do.");
  const cityIsValid = locationValidator.cityExists(input.citySlug ?? "");
  if (!cityIsValid) errors.push("Choose a supported city.");
  if (!categories.has(input.category as RequirementCategory)) errors.push("Choose a property category.");
  if (!input.subtype?.trim()) errors.push("Choose a property subtype.");
  if (!propertyTypeFromRequirement(input)) errors.push("Choose a reviewed property type.");

  const bhkMin = toPositiveInteger(input.bhkMin);
  const bhkMax = toPositiveInteger(input.bhkMax);
  const areaMin = toPositiveInteger(input.areaMinSqft);
  const areaMax = toPositiveInteger(input.areaMaxSqft);
  const budgetMin = toPositiveInteger(input.budgetMinInr);
  const budgetMax = toPositiveInteger(input.budgetMaxInr);
  if (bhkMin !== null && bhkMax !== null && bhkMin > bhkMax) errors.push("BHK minimum cannot exceed BHK maximum.");
  if ((areaMin === null) !== (areaMax === null)) errors.push("Enter both area minimum and maximum for matching.");
  if (areaMin !== null && areaMax !== null && areaMin > areaMax) errors.push("Area minimum cannot exceed area maximum.");
  if ((budgetMin === null) !== (budgetMax === null)) errors.push("Enter both budget minimum and maximum for matching.");
  if (budgetMin !== null && budgetMax !== null && budgetMin > budgetMax) errors.push("Budget minimum cannot exceed budget maximum.");

  const supplySide = isSupplyIntent(input.intent as RequirementIntent);
  const localitySlugs = normalizedLocalitySlugs(input);
  if (!localitySlugs.length) {
    errors.push(supplySide ? "Choose the locality your property is in." : "Choose at least one preferred locality.");
  } else {
    /* A property sits in ONE locality. Accepting several would record a
       address that does not exist, and the listing built from it would be
       wrong in a way nobody downstream could detect. */
    if (supplySide && localitySlugs.length > 1) {
      errors.push("A property can only be in one locality. Choose the one it is in.");
    }
    if (!supplySide && localitySlugs.length > MAX_PREFERRED_LOCALITIES) {
      errors.push(`Choose no more than ${MAX_PREFERRED_LOCALITIES} preferred localities.`);
    }
    if (new Set(localitySlugs).size !== localitySlugs.length) errors.push("Preferred localities must not contain duplicates.");
    if (cityIsValid && localitySlugs.some((slug) => !locationValidator.localityBelongs(input.citySlug!, slug))) {
      errors.push("Every preferred locality must belong to the selected city.");
    }
  }

  const roleIsValid = roles.has(input.role as RequirementRole);
  if (!roleIsValid) errors.push("Choose your role.");
  /* Role and intent must agree. Without this the API would happily record a
     tenant who is selling a flat, which no downstream consumer can interpret. */
  if (roleIsValid && intents.has(input.intent as RequirementIntent)
      && !isIntentAllowedForRole(input.role as RequirementRole, input.intent as RequirementIntent)) {
    errors.push("That option does not match the role you selected.");
  }
  if (!input.name || input.name.trim().length < 2) errors.push("Name must be at least 2 characters.");
  const phoneDigits = input.phone?.replace(/\D/g, "") ?? "";
  if (phoneDigits.length < 8) errors.push("Phone must include at least 8 digits.");
  else if (phoneDigits.length > 15) errors.push("Phone must include no more than 15 digits.");
  if (!input.consentText || input.consentText.trim().length < 12) errors.push("Consent text is required.");
  return errors;
}

/* FNV-1a over the identity tuple.
 *
 * The key is stored in the database and echoed back in the API response, so
 * it must not BE the identity — it must only prove it. The previous format
 * interpolated the raw phone number, which put a plaintext number in a column
 * next to the AES-256-GCM ciphertext that exists precisely to keep it out of
 * the clear, and shipped it to the browser on every submit. Hashing keeps
 * duplicate detection exact while making the key non-identifying. */
function fingerprint(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  /* A second pass over the reversed input widens the output to 64 bits, so
     collisions between two real briefs are not a practical concern. */
  let tail = 0x811c9dc5;
  for (let index = value.length - 1; index >= 0; index -= 1) {
    tail ^= value.charCodeAt(index);
    tail = Math.imul(tail, 0x01000193) >>> 0;
  }
  return `${hash.toString(36)}${tail.toString(36)}`;
}

export function requirementIdempotencyKey(input: RequirementInput): string {
  const localitySlugs = normalizedLocalitySlugs(input);
  if (input.idempotencyKey?.trim()) return input.idempotencyKey.trim();
  /* The account is part of the identity of a brief, not incidental to it.
     Matching-grade fields are included so two distinct demand profiles from
     the same account and phone do not collapse into one broker-channel source. */
  const owner = input.userId ? `u:${input.userId}` : input.organizationId ? `o:${input.organizationId}` : "anon";
  return `rq_${fingerprint(`${owner}:${input.intent}:${input.citySlug}:${input.category}:${propertyTypeFromRequirement(input)}:${input.phone.replace(/\D/g, "")}:${localitySlugs.join(",")}:${input.bhkMin ?? ""}:${input.bhkMax ?? ""}:${input.areaMinSqft ?? ""}:${input.areaMaxSqft ?? ""}:${input.budgetMinInr ?? ""}:${input.budgetMaxInr ?? ""}`)}`;
}

export function createRequirement(input: RequirementInput): RequirementResult {
  const errors = validateRequirementInput(input);
  if (errors.length) return { ok: false, status: 400, errors };
  const localitySlugs = normalizedLocalitySlugs(input);
  const idempotencyKey = requirementIdempotencyKey(input);
  const previous = requirementsByKey.get(idempotencyKey);
  if (previous) return { ok: true, requirement: previous, duplicate: true };
  const record: RequirementRecord = {
    id: stableId(idempotencyKey),
    intent: input.intent,
    citySlug: input.citySlug,
    category: input.category,
    subtype: input.subtype.trim(),
    propertyType: propertyTypeFromRequirement(input),
    bhkMin: toPositiveInteger(input.bhkMin),
    bhkMax: toPositiveInteger(input.bhkMax),
    areaMinSqft: toPositiveInteger(input.areaMinSqft),
    areaMaxSqft: toPositiveInteger(input.areaMaxSqft),
    budgetMinInr: toPositiveInteger(input.budgetMinInr),
    budgetMaxInr: toPositiveInteger(input.budgetMaxInr),
    organizationId: input.organizationId ?? null,
    localitySlugs,
    role: input.role,
    name: input.name.trim(),
    phoneMasked: maskPhone(input.phone),
    consentText: input.consentText.trim(),
    idempotencyKey,
    userId: input.userId ?? null,
    status: "NEW",
    createdAt: new Date().toISOString(),
  };
  requirementsByKey.set(idempotencyKey, record);
  return { ok: true, requirement: record, duplicate: false };
}

/* One person's briefs, newest first.
 *
 * Scoped by `userId` and never by phone number: two different people share a
 * handset more often than product design likes to admit, and a brief is only
 * shown to the account that is provably attached to it. An anonymous brief
 * (`userId === null`) therefore belongs to nobody and is returned to nobody.
 */
export function listRequirementsForUser(userId: string): RequirementRecord[] {
  if (!userId) return [];
  return [...requirementsByKey.values()]
    .filter((record) => record.userId === userId)
    /* Tie-break on id: several briefs can share a createdAt millisecond, and
       an unstable order makes the dashboard reshuffle between renders. */
    .sort((a, b) => (b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id)));
}

export function resetRequirementStoreForTests() {
  requirementsByKey.clear();
}

export function listRequirementsForOrganization(organizationId: string): RequirementRecord[] {
  return [...requirementsByKey.values()]
    .filter((requirement) => requirement.organizationId === organizationId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getRequirementForOrganization(requirementId: string, organizationId: string): RequirementRecord | null {
  return listRequirementsForOrganization(organizationId).find((requirement) => requirement.id === requirementId) ?? null;
}
