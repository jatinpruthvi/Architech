/* Requirement capture contract.

   Location identity is explicit and city-scoped: APIs accept stable slugs, not
   presentation labels. This fixture adapter mirrors the database relationship
   (`RequirementLocality` -> `Locality`) and rejects a locality from another
   city. Slugs are transitional public identifiers; persisted production rows
   resolve them to immutable City/Locality ids before insert. */
import { liveCities } from "@/lib/cities";
import { findLocality } from "@/lib/localities";

export type RequirementIntent = "buy" | "rent";
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
const intents = new Set<RequirementIntent>(["buy", "rent"]);
const citySlugs = new Set(liveCities.map((city) => city.slug));
const roles = new Set<RequirementRole>(["buyer", "owner", "tenant", "agent", "builder"]);

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
  if (!intents.has(input.intent as RequirementIntent)) errors.push("Choose whether you want to buy or rent.");
  const cityIsValid = locationValidator.cityExists(input.citySlug ?? "");
  if (!cityIsValid) errors.push("Choose a supported city.");
  if (!categories.has(input.category as RequirementCategory)) errors.push("Choose a property category.");
  if (!input.subtype?.trim()) errors.push("Choose a property subtype.");

  const localitySlugs = normalizedLocalitySlugs(input);
  if (!localitySlugs.length) {
    errors.push("Choose at least one preferred locality.");
  } else {
    if (localitySlugs.length > 8) errors.push("Choose no more than 8 preferred localities.");
    if (new Set(localitySlugs).size !== localitySlugs.length) errors.push("Preferred localities must not contain duplicates.");
    if (cityIsValid && localitySlugs.some((slug) => !locationValidator.localityBelongs(input.citySlug!, slug))) {
      errors.push("Every preferred locality must belong to the selected city.");
    }
  }

  if (!roles.has(input.role as RequirementRole)) errors.push("Choose your role.");
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
