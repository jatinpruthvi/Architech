/* PIN code resolution.

   India Post PIN codes are a query and resolution dimension, never a URL key:
   canonical URLs stay slug-based (`/buy/{city}/{locality}/`) because slugs are
   stable, readable, and already indexed.

   The relationship is many-to-many in both directions and the model reflects
   that honestly:
     - one locality spans several PINs (Thaltej is 380059 and 380054)
     - one PIN covers several localities (395007 is both Vesu and Piplod)

   Resolution is layered, most precise first:
     1. exact PIN → localities that claim it
     2. PIN prefix (first 3 digits, the postal sorting district) → city
     3. no match → null, never a guess

   PROVENANCE: these PINs are illustrative demo data compiled for the concept
   preview. Before public enablement they must be reconciled against an
   authoritative India Post source and stamped with a retrieval date, exactly
   like RERA records (see `docs/` and the LEG-001 gate). */
import { findCity, liveCities, type City } from "./cities";
import { localities, type Locality } from "./localities";

/** A valid Indian PIN: six digits, and the first digit is never 0. */
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export function isValidPincode(value: string): boolean {
  return PINCODE_PATTERN.test(value.trim());
}

/** Extract a normalized PIN from free text, or null. Tolerates "380 007". */
export function parsePincode(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/[\s-]/g, "");
  const match = compact.match(/(?<![0-9])([1-9][0-9]{5})(?![0-9])/);
  return match ? match[1] : null;
}

/** The postal sorting district: the first three digits of a PIN. */
export function pincodePrefix(pincode: string): string {
  return pincode.slice(0, 3);
}

export type PincodeMatch = {
  pincode: string;
  city: City;
  localities: Locality[];
  /** `locality` = a locality claims this exact PIN; `city` = prefix match only. */
  precision: "locality" | "city";
};

/* Built once at module load: exact PIN → localities. */
const byPincode = new Map<string, Locality[]>();
for (const locality of localities) {
  for (const pincode of locality.pincodes) {
    const bucket = byPincode.get(pincode) ?? [];
    bucket.push(locality);
    byPincode.set(pincode, bucket);
  }
}

/* Prefix → city, for PINs no locality claims yet. */
const byPrefix = new Map<string, City>();
for (const city of liveCities) {
  for (const prefix of city.pincodePrefixes) {
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, city);
  }
}

/** Every PIN the registry knows, sorted — useful for audits and fixtures. */
export function knownPincodes(): string[] {
  return [...byPincode.keys()].sort();
}

/** All localities claiming an exact PIN (may be several, or none). */
export function localitiesForPincode(value: string): Locality[] {
  const pincode = parsePincode(value);
  return pincode ? [...(byPincode.get(pincode) ?? [])] : [];
}

/** PINs served by a city, deduplicated and sorted. */
export function pincodesForCity(citySlug: string): string[] {
  const codes = new Set<string>();
  for (const locality of localities) {
    if (locality.citySlug === citySlug) for (const pincode of locality.pincodes) codes.add(pincode);
  }
  return [...codes].sort();
}

/**
 * Resolve a PIN to a place. Returns `null` rather than guessing when the PIN is
 * malformed or falls outside every covered postal district.
 */
export function resolvePincode(value: string | null | undefined): PincodeMatch | null {
  const pincode = parsePincode(value);
  if (!pincode) return null;

  const matched = byPincode.get(pincode);
  if (matched?.length) {
    const city = findCity(matched[0].citySlug);
    if (city) return { pincode, city, localities: [...matched], precision: "locality" };
  }

  const city = byPrefix.get(pincodePrefix(pincode));
  return city ? { pincode, city, localities: [], precision: "city" } : null;
}

/** True when a listing's locality serves the given PIN. */
export function listingMatchesPincode(localitySlug: string, value: string): boolean {
  const pincode = parsePincode(value);
  if (!pincode) return false;
  return (byPincode.get(pincode) ?? []).some((locality) => locality.slug === localitySlug);
}

/** A short, human-readable provenance line for PIN facts shown in the UI. */
export const PINCODE_PROVENANCE = "PIN codes are illustrative demo data pending India Post verification";
