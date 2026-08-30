/* ARCHITECH — the single contract for structured listing details.
 *
 * WHY THIS FILE EXISTS
 * `bathrooms`, `parkingSpaces`, `furnishing`, `floor`, `facing`, `amenities`
 * have no column of their own on `Listing`. The only place they can live is
 * `sourceSummary String?`, and that same column is a PROSE note in every other
 * writer: `prisma/seed.mjs` puts a human sentence in it, and external feed
 * import is expected to do the same. One field, two incompatible meanings.
 *
 * That produced two bugs at once, and the second is the worse one:
 *
 * 1. SILENT LOSS. `JSON.parse("Seeded from the August 2026 … fixtures.")`
 *    throws, the catch returned `{}`, and Baths / Parking / Furnishing vanished
 *    from the card, the quick view and the dossier with no signal anywhere. This
 *    is also exactly why the `size` facet cannot be surfaced to buyers: the
 *    data is not indexable, it is scraped.
 * 2. UNVALIDATED JSON INTO THE UI. When `sourceSummary` DID hold JSON — the
 *    broker path writes `JSON.stringify(draft.details)` — it was `as
 *    PropertyDetails` and forwarded. A feed row containing
 *    `{"bathrooms":"see brochure","amenities":null}` yielded `NaN`, `null.map`,
 *    or a number outside the vocabulary the rest of the app assumes. The UI
 *    rendered whatever the string said.
 *
 * So this is a validation boundary, not a parser. Structured input is coerced or
 * DROPPED field by field against the same option lists the broker form offers
 * (`BATHROOM_OPTIONS`, `PARKING_OPTIONS`, the furnishing/facing vocabularies),
 * which means: a value the product can also *filter* on is a value we will
 * *display*. Anything else is a missing value, not a guess.
 *
 * WHAT STILL NEEDS THE SCHEMA (deliberately not done here)
 * A `Listing` column — `detailsJson JSONB`, or typed `bathrooms Int?` /
 * `parkingSpaces Int?` / `furnishing …?` — is the only way to make these
 * filterable in SQL rather than in JS after the read. That change is
 * intentionally not in this commit: `prisma validate`/`generate` cannot run in
 * this environment (its engine download is blocked), so committing a schema
 * edit here would ship a migration nobody has checked compiles. The read path
 * below already prefers such a column when one exists.
 */
import { logger } from "@/lib/observability/logger";
import {
  AMENITY_OPTIONS,
  BATHROOM_OPTIONS,
  FACING_OPTIONS,
  FURNISHING_OPTIONS,
  PARKING_OPTIONS,
  type PropertyDetails,
} from "./listing-details";

/** True when a payload carries at least one usable fact. Guards the fallback
    chain: `{}` from a stored column must NOT suppress a prose scrape, and
    `Object.keys(x).length` alone would let `{ bathrooms: "abc" }` count. */
export function hasAnyListingDetail(input: unknown): boolean {
  return Object.keys(normalizeListingDetails(input)).length > 0;
}

/** The empty details object, once, instead of ten fresh `{}` literals. */
export const EMPTY_DETAILS: PropertyDetails = {};

const FURNISHING_CODES: Set<string> = new Set(FURNISHING_OPTIONS.map((option) => option.value));
const FACING_CODES: Set<string> = new Set(FACING_OPTIONS.map((option) => option.value));
const BATHROOM_VALUES = new Set<number>(BATHROOM_OPTIONS);
const PARKING_VALUES = new Set<number>(PARKING_OPTIONS);
const AMENITY_VALUES = new Set<string>(AMENITY_OPTIONS as readonly string[]);

/**
 * A small positive integer, or `undefined`. Accepts `"4"` because feeds are
 * strings; rejects 4.5, `0` for bathrooms, and `null`.
 * `zeroIsAllowed` exists only for parking, where 0 is a fact ("no parking")
 * and dropping it would silently turn an honest listing into a vague one.
 */
function count(value: unknown, allowed?: Set<number>, zeroIsAllowed = false): number | undefined {
  const parsed = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  if (!Number.isFinite(parsed) || !Number.isInteger(parsed)) return undefined;
  if (parsed < (zeroIsAllowed ? 0 : 1) || parsed > 99) return undefined;
  // Out-of-vocabulary counts are dropped rather than clamped: a 7-bathroom row
  // is a data error worth hiding, not a licence to invent a filter option.
  if (allowed && !allowed.has(parsed)) return undefined;
  return parsed;
}

/**
 * Normalise an already-parsed object (feed payload, stored JSON column, broker
 * draft) into `PropertyDetails`. Never throws, never invents.
 */
export function normalizeListingDetails(input: unknown): PropertyDetails {
  if (!input || typeof input !== "object" || Array.isArray(input)) return EMPTY_DETAILS;
  const raw = input as Record<string, unknown>;
  const details: PropertyDetails = {};

  const bathrooms = count(raw.bathrooms, BATHROOM_VALUES);
  if (bathrooms !== undefined) details.bathrooms = bathrooms;

  const parking = count(raw.parkingSpaces, PARKING_VALUES, true);
  if (parking !== undefined) details.parkingSpaces = parking;

  const furnishing = raw.furnishing;
  if (typeof furnishing === "string" && FURNISHING_CODES.has(furnishing.trim().toUpperCase().replace(/[\s-]+/g, "_"))) {
    details.furnishing = furnishing.trim().toUpperCase().replace(/[\s-]+/g, "_") as PropertyDetails["furnishing"];
  }

  const floor = count(raw.floorNumber);
  if (floor !== undefined) details.floorNumber = floor;
  const totalFloors = count(raw.totalFloors);
  if (totalFloors !== undefined) details.totalFloors = totalFloors;
  // A floor above the building is impossible, and rendering "Floor 9 of 4"
  // teaches the reader that nothing here is checked.
  if (details.floorNumber && details.totalFloors && details.floorNumber > details.totalFloors) {
    delete details.floorNumber;
  }

  const facing = raw.facing;
  if (typeof facing === "string" && FACING_CODES.has(facing.trim().toUpperCase().replace(/[\s-]+/g, "_"))) {
    details.facing = facing.trim().toUpperCase().replace(/[\s-]+/g, "_") as PropertyDetails["facing"];
  }

  if (typeof raw.possessionLabel === "string" && raw.possessionLabel.trim()) {
    details.possessionLabel = raw.possessionLabel.trim().slice(0, 48);
  }

  if (Array.isArray(raw.amenities)) {
    const known = raw.amenities
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim())
      // Free text that the rest of the UI treats as a chip: keep the ones in
      // the shared vocabulary so a chip row cannot become a junk drawer.
      .filter((item) => AMENITY_VALUES.has(item));
    const unique = [...new Set(known)];
    if (unique.length) details.amenities = unique;
  }

  return details;
}

/**
 * The ONLY sanctioned read of `sourceSummary` as detail data.
 *
 * Prose returns `EMPTY_DETAILS` — quietly, because prose in this column is the
 * documented normal case (seed + feed), not an error. But a value that LOOKS
 * structured and does not survive is a real feed defect, so that one case is
 * reported once per process instead of being thrown away: `"{\"bath\"" is the
 * signature of a truncated or double-encoded payload, and it is precisely the
 * case a parser cannot recover from.
 */
let warnedUnstructured = false;
export function listingDetailsFromSourceSummary(value?: string | null): PropertyDetails {
  const text = value?.trim();
  if (!text) return EMPTY_DETAILS;
  if (text[0] !== "{" && text[0] !== "[") return EMPTY_DETAILS;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    if (!warnedUnstructured) {
      warnedUnstructured = true;
      /* B-23: the only non-test console usage was invisible in production
         logging. Route it through the structured pino logger with an event
         name so operations can actually find the offending rows. */
      logger.warn(
        { event: "listing.details.source_summary_unparsable", severity: "warn" },
        "sourceSummary looks like JSON but did not parse — listing details will be missing for affected rows. This is the feed contract problem, not a parse problem: the column holds prose in some writers and JSON in others.",
      );
    }
    return EMPTY_DETAILS;
  }
  return normalizeListingDetails(parsed);
}
