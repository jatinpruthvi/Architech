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
  /** Stable locality slugs; every value must belong to `citySlug`. */
  localitySlugs: string[];
  role: RequirementRole;
  name: string;
  phone: string;
  consentText: string;
  idempotencyKey?: string;
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

export function requirementIdempotencyKey(input: RequirementInput): string {
  const localitySlugs = normalizedLocalitySlugs(input);
  return input.idempotencyKey?.trim()
    || `${input.intent}:${input.citySlug}:${input.category}:${input.phone.replace(/\D/g, "")}:${localitySlugs.join(",")}`;
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
    localitySlugs,
    role: input.role,
    name: input.name.trim(),
    phoneMasked: maskPhone(input.phone),
    consentText: input.consentText.trim(),
    idempotencyKey,
    status: "NEW",
    createdAt: new Date().toISOString(),
  };
  requirementsByKey.set(idempotencyKey, record);
  return { ok: true, requirement: record, duplicate: false };
}

export function resetRequirementStoreForTests() {
  requirementsByKey.clear();
}
