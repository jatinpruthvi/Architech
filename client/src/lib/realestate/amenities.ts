/* Hyper-local amenity categories (StudyArena round-12, contestant B §1).

   B's competitive argument is that a new domain beats a legacy portal on
   hyper-specificity: "create a database of hyper-local amenities, tech parks,
   schools, and transit stations". The database part is the right instinct —
   the *generation* part is not, and this module is deliberately only half of
   B's recommendation. Arbitrarily intersecting amenity × configuration
   ("pet-friendly 2 BHK near ITPL") is the doorway-page pattern the project's
   own decision register rejects. What is genuinely defensible is knowing, as
   data, what kind of place each nearby landmark is.

   That distinction is why category is *declared* rather than inferred.

   The previous implementation guessed the category from the place name:
   `place.includes("park")` → green. Measured against the 30 distinct places
   in the registry, 11 were wrong, and the label is user-visible on the
   locality page. "EON IT Park" rendered as *Green*; "IIT Bombay" rendered as
   *Landmark* while "IIM Ahmedabad" rendered as *Schools & learning*, because
   the rule listed `iim` and not `iit`; "Bandra Terminus" was not transit.

   So the shape is:
     · data carries an explicit category — the author states what the place is
     · inference survives only as a fallback for legacy rows already in the
       database that predate the field, where a guess is better than a crash
     · a test asserts every shipped fixture declares one, so a newly added
       landmark cannot silently acquire a guessed label

   Server-safe and deterministic. */

/** What kind of place a nearby landmark is. `landmark` is the honest bucket
    for a place with no better category — not a dumping ground for names the
    inference failed to recognise. */
export type AmenityCategory =
  | "transit"
  | "work"
  | "learning"
  | "health"
  | "green"
  | "culture"
  | "retail"
  | "sports"
  | "landmark";

export const AMENITY_CATEGORIES: readonly AmenityCategory[] = [
  "transit",
  "work",
  "learning",
  "health",
  "green",
  "culture",
  "retail",
  "sports",
  "landmark",
];

export const AMENITY_LABELS: Record<AmenityCategory, string> = {
  transit: "Transit",
  work: "Employment hub",
  learning: "Schools & learning",
  health: "Health",
  green: "Parks & waterfront",
  culture: "Culture",
  retail: "Retail",
  sports: "Sports",
  landmark: "Landmark",
};

export function isAmenityCategory(value: unknown): value is AmenityCategory {
  return typeof value === "string" && (AMENITY_CATEGORIES as readonly string[]).includes(value);
}

/* Ordered inference rules for legacy rows that carry no category.

   Order is load-bearing: an employment rule must run before the green rule or
   "EON IT Park" matches `park` and becomes a park. Each rule is a set of
   lowercase substrings tested against the place name. */
const INFERENCE_RULES: readonly { category: AmenityCategory; tokens: readonly string[] }[] = [
  {
    category: "work",
    tokens: ["it park", "tech park", "technopark", "infopark", "itpl", "business park", "financial district", "sez", "software", "office park"],
  },
  {
    category: "transit",
    tokens: ["airport", "station", "terminus", "metro", "brts", "railway", "sea link", "flyover", "expressway", "highway", "road", "bus stand", "depot"],
  },
  {
    category: "health",
    tokens: ["hospital", "clinic", "nursing", "medical", "dispensary"],
  },
  {
    category: "learning",
    tokens: ["school", "college", "university", "institute", "academy", "iim", "iit", "campus"],
  },
  {
    category: "sports",
    tokens: ["stadium", "sports", "arena", "golf"],
  },
  {
    category: "retail",
    tokens: ["mall", "market", "bazaar", "citywalk", "shopping"],
  },
  {
    category: "culture",
    tokens: ["hall", "museum", "gallery", "temple", "monument", "fort", "minar", "church", "mosque"],
  },
  {
    category: "green",
    tokens: ["garden", "park", "lake", "riverfront", "beach", "estuary", "promenade", "bandstand", "zoo"],
  },
];

/** Best-effort category from a place name. Used only for legacy rows that
    carry no declared category — see the module note. A name matching nothing
    returns `landmark`, which is a claim that the place is not any of the
    specific kinds, *not* a claim that inference succeeded. */
export function inferAmenityCategory(name: string): AmenityCategory {
  const lowered = name.toLowerCase();
  for (const rule of INFERENCE_RULES) {
    if (rule.tokens.some((token) => lowered.includes(token))) return rule.category;
  }
  return "landmark";
}

/** Resolve an amenity's category: an explicitly declared value always wins.

    `declared` is untrusted (it arrives as JSON from the database), so an
    unrecognised value falls through to inference rather than being emitted as
    a category that no consumer can label. */
export function categorizeAmenity(name: string, declared?: unknown): AmenityCategory {
  return isAmenityCategory(declared) ? declared : inferAmenityCategory(name);
}

export type LocalityAmenity = {
  name: string;
  /** Human-readable distance as authored, e.g. `≈ 1.4 km`. */
  distance: string;
  category: AmenityCategory;
};

/** A landmark row as authored in the registry and stored by the database.
    The third element is optional so existing rows keep working. */
export type AmenityRow = [string, string, AmenityCategory?];

/** Validate raw landmark rows without changing their shape.

    This is what a database read uses: the record keeps storing
    `[name, distance, category?]`, so a row that survives validation is handed
    back as a row. Tolerant by design — the column predates the category field,
    so a malformed row is dropped rather than throwing, because a corrupt
    amenity must never take a locality page down. Returns `undefined` when
    nothing usable survives, which callers treat as "no landmarks". */
export function normalizeAmenityRows(raw: unknown): AmenityRow[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const rows: AmenityRow[] = [];
  for (const row of raw) {
    if (!Array.isArray(row)) continue;
    const [name, distance, declared] = row as AmenityRow;
    if (typeof name !== "string" || name.trim() === "") continue;
    if (typeof distance !== "string" || distance.trim() === "") continue;
    rows.push(isAmenityCategory(declared) ? [name.trim(), distance.trim(), declared] : [name.trim(), distance.trim()]);
  }
  return rows.length ? rows : undefined;
}

/** Normalise raw landmark rows into typed amenities for rendering.

    Where an entry carries no category this resolves one by inference, so a
    legacy row still lands in a sensible bucket — see the module note on why
    that fallback exists and why the shipped corpus does not use it. */
export function normalizeAmenities(raw: unknown): LocalityAmenity[] | undefined {
  const rows = normalizeAmenityRows(raw);
  if (!rows) return undefined;
  return rows.map(([name, distance, declared]) => ({
    name,
    distance,
    category: categorizeAmenity(name, declared),
  }));
}
