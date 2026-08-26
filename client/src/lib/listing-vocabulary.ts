export const PROPERTY_TYPE_OPTIONS = [
  { value: "APARTMENT", label: "Apartment / flat", slug: "apartment" },
  { value: "ROWHOUSE", label: "Rowhouse", slug: "rowhouse" },
  { value: "VILLA", label: "Villa", slug: "villa" },
  { value: "PENTHOUSE", label: "Penthouse", slug: "penthouse" },
  { value: "PLOT", label: "Plot", slug: "plot" },
] as const;

export type PropertyTypeCode = (typeof PROPERTY_TYPE_OPTIONS)[number]["value"];

export const AVAILABILITY_OPTIONS = [
  { value: "READY_TO_MOVE", label: "Ready to move", slug: "ready-to-move" },
  { value: "UNDER_CONSTRUCTION", label: "Under construction", slug: "under-construction" },
  { value: "NEW_LAUNCH", label: "New launch", slug: "new-launch" },
  { value: "RESALE", label: "Resale", slug: "resale" },
  { value: "PRE_LAUNCH", label: "Pre-launch", slug: "pre-launch" },
] as const;

export type AvailabilityCode = (typeof AVAILABILITY_OPTIONS)[number]["value"];

const PROPERTY_TYPE_CODES = new Set<PropertyTypeCode>(PROPERTY_TYPE_OPTIONS.map((option) => option.value));
const AVAILABILITY_CODES = new Set<AvailabilityCode>(AVAILABILITY_OPTIONS.map((option) => option.value));

const AVAILABILITY_ALIASES: Record<string, AvailabilityCode> = {
  "ready to move": "READY_TO_MOVE",
  ready_to_move: "READY_TO_MOVE",
  under_construction: "UNDER_CONSTRUCTION",
  "under construction": "UNDER_CONSTRUCTION",
  "new launch": "NEW_LAUNCH",
  new_launch: "NEW_LAUNCH",
  resale: "RESALE",
  pre_launch: "PRE_LAUNCH",
  "pre-launch": "PRE_LAUNCH",
  "pre launch": "PRE_LAUNCH",
};

export function isPropertyTypeCode(value: unknown): value is PropertyTypeCode {
  return typeof value === "string" && PROPERTY_TYPE_CODES.has(value as PropertyTypeCode);
}

export function isAvailabilityCode(value: unknown): value is AvailabilityCode {
  return typeof value === "string" && AVAILABILITY_CODES.has(value as AvailabilityCode);
}

/** Converts legacy display labels to the reviewed storage code without inventing a value. */
export function normalizeAvailability(value: unknown): AvailabilityCode | undefined {
  if (isAvailabilityCode(value)) return value;
  if (typeof value !== "string") return undefined;
  return AVAILABILITY_ALIASES[value.trim().toLowerCase()];
}

export function labelForPropertyType(value: PropertyTypeCode): string {
  return PROPERTY_TYPE_OPTIONS.find((option) => option.value === value)?.label ?? value;
}

export function labelForAvailability(value: AvailabilityCode): string {
  return AVAILABILITY_OPTIONS.find((option) => option.value === value)?.label ?? value;
}
