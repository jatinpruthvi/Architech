/* Requirement capture contract: buyer/renter intent is not tied to a single listing. */

export type RequirementIntent = "buy" | "rent";
export type RequirementRole = "buyer" | "owner" | "tenant" | "agent" | "builder";
export type RequirementCategory = "residential" | "commercial" | "pg" | "plot" | "land" | "auction";

export type RequirementInput = {
  intent: RequirementIntent;
  city: "ahmedabad" | "gandhinagar";
  category: RequirementCategory;
  subtype: string;
  localities: string[];
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
const cities = new Set(["ahmedabad", "gandhinagar"]);
const roles = new Set<RequirementRole>(["buyer", "owner", "tenant", "agent", "builder"]);

export function validateRequirementInput(input: Partial<RequirementInput>) {
  const errors: string[] = [];
  if (!intents.has(input.intent as RequirementIntent)) errors.push("Choose whether you want to buy or rent.");
  if (!cities.has(input.city ?? "")) errors.push("Choose a supported city.");
  if (!categories.has(input.category as RequirementCategory)) errors.push("Choose a property category.");
  if (!input.subtype?.trim()) errors.push("Choose a property subtype.");
  if (!input.localities?.length) errors.push("Choose at least one preferred locality.");
  if (!roles.has(input.role as RequirementRole)) errors.push("Choose your role.");
  if (!input.name || input.name.trim().length < 2) errors.push("Name must be at least 2 characters.");
  if (!input.phone || input.phone.replace(/\D/g, "").length < 8) errors.push("Phone must include at least 8 digits.");
  if (!input.consentText || input.consentText.trim().length < 12) errors.push("Consent text is required.");
  return errors;
}

export function createRequirement(input: RequirementInput): RequirementResult {
  const errors = validateRequirementInput(input);
  if (errors.length) return { ok: false, status: 400, errors };
  const idempotencyKey = input.idempotencyKey?.trim() || `${input.intent}:${input.city}:${input.category}:${input.phone.replace(/\D/g, "")}:${input.localities.join(",")}`;
  const previous = requirementsByKey.get(idempotencyKey);
  if (previous) return { ok: true, requirement: previous, duplicate: true };
  const record: RequirementRecord = {
    id: stableId(idempotencyKey),
    intent: input.intent,
    city: input.city,
    category: input.category,
    subtype: input.subtype.trim(),
    localities: input.localities.map((locality) => locality.trim()).filter(Boolean).slice(0, 8),
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
