/* PIN code resolution.

   A Postal Index Number is a delivery-routing identifier, not a locality id and
   not a precise coordinate. The relationship is many-to-many:
     - one locality can span several PINs;
     - one PIN can serve several localities (and sometimes municipalities).

   Canonical locality URLs therefore remain city + locality slug. PIN is a
   query/filter dimension and an address-validation signal. Resolution below is
   deliberately exact: a shared three-digit sorting prefix is not evidence that
   an arbitrary six-digit PIN belongs to a city. Production resolution is backed
   by `PostalCode`, `PostOffice`, and `LocalityPostalCode` in Prisma; this module
   is the fixture adapter used while that database is populated. */
import { findCity, type City } from "./cities";
import { localities, type Locality } from "./localities";

/** A syntactically valid Indian PIN: six digits, first digit 1–9. */
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export function isValidPincode(value: string): boolean {
  return PINCODE_PATTERN.test(value.trim());
}

/** Extract one normalized PIN from free text, or null. Tolerates "380 007". */
export function parsePincode(value: string | null | undefined): string | null {
  if (!value) return null;
  const compact = value.replace(/[\s-]/g, "");
  const match = compact.match(/(?<![0-9])([1-9][0-9]{5})(?![0-9])/);
  return match ? match[1] : null;
}

/** Postal sorting district (first three digits). Useful for display/audits only. */
export function pincodePrefix(pincode: string): string {
  return pincode.slice(0, 3);
}

export type PincodeMatch = {
  pincode: string;
  /** Every city represented by the exact locality mappings. */
  cities: City[];
  /** Present only when all exact matches belong to one city. */
  city: City | null;
  /** All product localities linked to the exact PIN; zero is never inferred. */
  localities: Locality[];
  precision: "postal-area";
  /** PIN alone does not identify one product locality when this is true. */
  ambiguous: boolean;
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

/** Every exact PIN the fixture registry knows, sorted — useful for audits. */
export function knownPincodes(): string[] {
  return [...byPincode.keys()].sort();
}

/** All localities linked to an exact PIN (may be several, or none). */
export function localitiesForPincode(value: string): Locality[] {
  const pincode = parsePincode(value);
  return pincode ? [...(byPincode.get(pincode) ?? [])] : [];
}

/** Exact PINs linked to a city, deduplicated and sorted. */
export function pincodesForCity(citySlug: string): string[] {
  const codes = new Set<string>();
  for (const locality of localities) {
    if (locality.citySlug === citySlug) for (const pincode of locality.pincodes) codes.add(pincode);
  }
  return [...codes].sort();
}

/**
 * Resolve only an exact PIN represented by a locality mapping. Unknown PINs
 * return null. In particular, this never turns a three-digit sorting prefix
 * into a city guess.
 */
export function resolvePincode(value: string | null | undefined): PincodeMatch | null {
  const pincode = parsePincode(value);
  if (!pincode) return null;
  const matched = byPincode.get(pincode);
  if (!matched?.length) return null;

  const cityMap = new Map<string, City>();
  for (const locality of matched) {
    const city = findCity(locality.citySlug);
    if (city) cityMap.set(city.slug, city);
  }
  const cities = [...cityMap.values()];
  return {
    pincode,
    cities,
    city: cities.length === 1 ? cities[0] : null,
    localities: [...matched],
    precision: "postal-area",
    ambiguous: matched.length !== 1 || cities.length !== 1,
  };
}

/** True when a locality is explicitly linked to the exact PIN. */
export function listingMatchesPincode(localitySlug: string, value: string, citySlug?: string): boolean {
  const pincode = parsePincode(value);
  if (!pincode) return false;
  return (byPincode.get(pincode) ?? []).some(
    (locality) => locality.slug === localitySlug && (!citySlug || locality.citySlug === citySlug),
  );
}

/** Fixture disclosure; database records carry source and retrieval metadata. */
export const PINCODE_PROVENANCE = "Fixture mapping · production data requires India Post source review";
