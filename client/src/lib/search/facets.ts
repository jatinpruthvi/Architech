/* ARCHITECH — Facet engine (v1 of the filter rebuild).
 *
 * Replaces the flat, mutually-AND'd chip list in `lib/filters.ts` with grouped
 * facets. The rule that fixes the old bug class:
 *
 *     WITHIN a group  → OR   (2 BHK or 3 BHK is a sensible question)
 *     ACROSS groups   → AND  (3 BHK AND Thaltej is a narrower place)
 *
 * Previously every chip was an independent AND predicate, so selecting
 * "2 BHK" + "3 BHK +" was unsatisfiable and returned an empty page.
 *
 * Three properties make this usable for both audiences rather than two
 * parallel implementations:
 *  1. Groups carry a `projection`. The consumer surface sees 5–6 groups, the
 *     desk ledger sees every group, from ONE schema.
 *  2. Values for open-ended dimensions (locality) are derived from the scoped
 *     inventory, never hardcoded — so an option cannot exist without data.
 *  3. Counts are computed with the counted group's own predicate REMOVED, which
 *     is what lets the UI say "(0)" honestly instead of hiding options.
 *
 * Pure and dependency-light: no React, no fetch, no `server-only`. Both the
 * fixture search path and the Postgres path consume the same predicates.
 */

import type { Property } from "@/lib/properties";
import type { PropertyTypeCode, AvailabilityCode } from "@/lib/listing-vocabulary";
import { FURNISHING_OPTIONS, type FurnishingCode } from "@/lib/listing-details";

export type FacetGroupProjection = "consumer" | "desk";
export type FacetGroupKind = "multi" | "toggle" | "range";

export type FacetValue = {
  id: string;
  label: string;
  /** Optional Devanagari label; falls back to `label`. */
  labelHi?: string;
  /** Test one listing against this value. */
  match: (property: Property) => boolean;
};

/** A derived option (locality) can carry its inventory volume for ordering. */
export type DerivedFacetValue = FacetValue & { count?: number };

export type FacetRange = {
  /** Lowest value the control can express, in the unit below. */
  min: number;
  /** Highest value the control can express. */
  max: number;
  /** Control granularity. */
  step: number;
  /** Rounding applied to a derived histogram's bucket width. */
  bucketRounding: number;
  unit: "inr" | "sqft";
  /** Compact display for a raw value, e.g. ₹1.4 Cr / 1,250 sq ft. */
  format: (value: number) => string;
  match: (property: Property, from: number, to: number) => boolean;
};

export type FacetGroup = {
  id: string;
  label: string;
  labelHi: string;
  kind: FacetGroupKind;
  projection: FacetGroupProjection[];
  /** Default state in the consumer surface (currently: nothing pre-selected). */
  collapsedByDefault?: boolean;
  values?: FacetValue[];
  range?: FacetRange;
  /** True when values come from the scoped inventory instead of a fixed list. */
  derive?: "localities";
};

/* ---------- Value formatting ----------
   Indian units only. A budget control that says "₹14,000,000" is a demo
   artifact; `Intl` with `en-IN` + `compact` gives ₹1.4 Cr, and lakh-scale
   values need the L form, which Intl's short notation does not produce. */

export function formatIndianRupees(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  const crore = value / 10_000_000;
  if (crore >= 1) {
    const rounded = Math.round(crore * 100) / 100;
    return `₹${rounded.toLocaleString("en-IN", { maximumFractionDigits: 2 })} Cr`;
  }
  const lakh = value / 100_000;
  const rounded = Math.round(lakh * 10) / 10;
  return `₹${rounded.toLocaleString("en-IN", { maximumFractionDigits: 1 })} L`;
}

export function formatSqft(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  return `${Math.round(value).toLocaleString("en-IN")} sq ft`;
}

const inrRange = (intent: "buy" | "rent"): FacetRange => ({
  // Rent scales in ₹/month, buy scales in total crore — one axis for both would
  // put every rental in the first bucket, which is the classic mistake.
  min: intent === "rent" ? 5_000 : 1_000_000,
  max: intent === "rent" ? 300_000 : 60_000_000,
  step: intent === "rent" ? 1_000 : 500_000,
  bucketRounding: intent === "rent" ? 5_000 : 1_000_000,
  // `min`/`max` are CONTROL limits (what the slider can express), deliberately
  // NOT data limits: a ₹12 L plot is real inventory and a crore floor would
  // make it unfindable. The derived histogram supplies the data limits.
  unit: "inr",
  format: formatIndianRupees,
  match: (property, from, to) => property.priceNum >= from && property.priceNum <= to,
});

/* ---------- Group registry ----------
   `trust` is a toggle rather than a chip: verification is the brand promise, so
   it gets its own affordance and can state what it hides. `size` (baths,
   parking, furnishing) stays desk-only BY DESIGN: the `detailsJson` column
   now exists (see lib/listing-details-contract.ts) and every value reaches the
   UI validated, but coverage is still fanned-in from feeds and legacy rows —
   surfacing a facet whose counts silently exclude unscaped rows would train
   buyers to distrust the filter bar. The moment feed import lands structured
   details at volume, this note flips to a chip group. */

export function facetGroups(options: { intent: "buy" | "rent" }): FacetGroup[] {
  const types: Array<{ code: PropertyTypeCode; label: string; labelHi: string }> = [
    { code: "APARTMENT", label: "Apartment / flat", labelHi: "फ़्लैट / अपार्टमेंट" },
    { code: "ROWHOUSE", label: "Rowhouse", labelHi: "रोहहाउस" },
    { code: "VILLA", label: "Villa", labelHi: "विला" },
    { code: "PENTHOUSE", label: "Penthouse", labelHi: "पेंटहाउस" },
    { code: "PLOT", label: "Plot", labelHi: "प्लॉट" },
  ];
  const availability: Array<{ code: AvailabilityCode; label: string; labelHi: string }> = [
    { code: "READY_TO_MOVE", label: "Ready to move", labelHi: "रहने के लिए तैयार" },
    { code: "NEW_LAUNCH", label: "New launch", labelHi: "नया लॉन्च" },
    { code: "PRE_LAUNCH", label: "Pre-launch", labelHi: "प्री-लॉन्च" },
    { code: "UNDER_CONSTRUCTION", label: "Under construction", labelHi: "निर्माणाधीन" },
    { code: "RESALE", label: "Resale", labelHi: "रीसेल" },
  ];
  // `status` is a human freshness label ("Updated 2 days ago"), not a
  // timestamp, so recency is only expressible as far as that label admits.
  // Anything unparseable is treated as NOT recent rather than silently
  // included — a "new this week" filter must not over-report.
  const ageInDays = (property: Property): number | null => {
    const match = /updated\s+today|(\d+)\s+(day|week)s?\s+ago/i.exec(property.status ?? "");
    if (!match) return null;
    if (match[0].toLowerCase().includes("today")) return 0;
    const magnitude = Number.parseInt(match[1], 10);
    if (!Number.isFinite(magnitude)) return null;
    return match[2].toLowerCase() === "week" ? magnitude * 7 : magnitude;
  };
  const within = (days: number) => (property: Property) => {
    const age = ageInDays(property);
    return age !== null && age <= days;
  };

  return [
    {
      id: "place",
      label: "Locality",
      labelHi: "इलाक़ा",
      kind: "multi",
      projection: ["consumer", "desk"],
      derive: "localities",
    },
    {
      id: "price",
      label: options.intent === "rent" ? "Monthly budget" : "Budget",
      labelHi: options.intent === "rent" ? "मासिक बजट" : "बजट",
      kind: "range",
      projection: ["consumer", "desk"],
      range: inrRange(options.intent),
    },
    {
      id: "bhk",
      label: "Bedrooms",
      labelHi: "बेडरूम",
      kind: "multi",
      projection: ["consumer", "desk"],
      values: [
        { id: "1", label: "1 RK / 1 BHK", labelHi: "1 RK / 1 BHK", match: (p) => p.bhk === 1 },
        { id: "2", label: "2 BHK", labelHi: "2 BHK", match: (p) => p.bhk === 2 },
        { id: "3", label: "3 BHK", labelHi: "3 BHK", match: (p) => p.bhk === 3 },
        { id: "4", label: "4 BHK", labelHi: "4 BHK", match: (p) => p.bhk === 4 },
        { id: "5+", label: "5 BHK +", labelHi: "5 BHK +", match: (p) => p.bhk >= 5 },
      ],
    },
    {
      id: "type",
      label: "Property type",
      labelHi: "प्रॉपर्टी प्रकार",
      kind: "multi",
      projection: ["consumer", "desk"],
      values: types.map(({ code, label, labelHi }) => ({
        id: code.toLowerCase(),
        label,
        labelHi,
        match: (p: Property) => p.propertyType === code,
      })),
    },
    {
      id: "status",
      label: "Status",
      labelHi: "स्थिति",
      kind: "multi",
      projection: ["consumer", "desk"],
      values: availability.map(({ code, label, labelHi }) => ({
        id: code.toLowerCase(),
        label,
        labelHi,
        match: (p: Property) => p.availability === code,
      })),
    },
    {
      id: "media",
      label: "Photographs",
      labelHi: "फ़ोटो",
      kind: "multi",
      projection: ["consumer", "desk"],
      values: [
        {
          id: "has-photos",
          label: "Has photographs",
          labelHi: "फ़ोटो के साथ",
          // A gallery of one is still a photograph; what buyers want excluded is
          // the listing with nothing to look at.
          match: (p) => Boolean(p.image) || (p.gallery?.length ?? 0) > 0,
        },
        {
          id: "multi-photo",
          label: "5+ photos",
          labelHi: "5+ फ़ोटो",
          match: (p) => 1 + (p.gallery?.length ?? 0) >= 5,
        },
      ],
    },
    {
      id: "trust",
      label: "Verified only",
      labelHi: "केवल सत्यापित",
      kind: "toggle",
      projection: ["consumer", "desk"],
      values: [
        {
          id: "rera",
          label: "RERA verified",
          labelHi: "RERA सत्यापित",
          // `badge` is the only verification signal the Property shape carries.
          match: (p) => p.badge === "RERA verified",
        },
      ],
    },
    {
      id: "fresh",
      label: "Listed within",
      labelHi: "कितने दिनों में",
      kind: "multi",
      projection: ["consumer", "desk"],
      values: [
        { id: "1d", label: "Last 24 hours", labelHi: "पिछले 24 घंटे", match: within(1) },
        { id: "7d", label: "Last 7 days", labelHi: "पिछले 7 दिन", match: within(7) },
        { id: "30d", label: "Last 30 days", labelHi: "पिछले 30 दिन", match: within(30) },
      ],
    },
    {
      id: "furnishing",
      label: "Furnishing",
      labelHi: "फ़र्निशिंग",
      kind: "multi",
      // Desk-only until `furnishing` is a typed column (see note above).
      projection: ["desk"],
      values: FURNISHING_OPTIONS.map((option) => ({
        id: option.value.toLowerCase(),
        label: option.label,
        labelHi: option.label,
        match: (p: Property) => p.details.furnishing === (option.value as FurnishingCode),
      })),
    },
    {
      id: "area",
      label: "Carpet area",
      labelHi: "कारपेट एरिया",
      kind: "range",
      projection: ["desk"],
      range: {
        min: 250,
        max: 6_000,
        step: 50,
        bucketRounding: 250,
        unit: "sqft",
        format: formatSqft,
        match: (p, from, to) => p.areaNum >= from && p.areaNum <= to,
      },
    },
  ];
}

export function groupsForProjection(groups: FacetGroup[], projection: FacetGroupProjection): FacetGroup[] {
  return groups.filter((group) => group.projection.includes(projection));
}

/* ---------- State ----------
   `group:value` tokens live in the SAME `?filters=` parameter the app already
   uses, so every link shared before this change keeps working (a bare `2bhk`
   token is mapped to `bhk:2` on read) while sharing stays one-parameter simple. */

export type FacetState = {
  multi: Record<string, string[]>;
  ranges: Record<string, { from: number; to: number }>;
};

export const emptyFacetState = (): FacetState => ({ multi: {}, ranges: {} });

export function isFacetStateEmpty(state: FacetState): boolean {
  return Object.values(state.multi).every((v) => !v?.length) && Object.values(state.ranges).every((r) => !r);
}

export function activeFacetCount(state: FacetState): number {
  return (
    Object.values(state.multi).reduce((sum, values) => sum + (values?.length ?? 0), 0) +
    Object.keys(state.ranges).length
  );
}

/** Legacy chip ids from `makeFilters()`, mapped onto the grouped vocabulary. */
const LEGACY_TOKENS: Record<string, string> = {
  "2bhk": "bhk:2",
  "3bhk": "bhk:3,bhk:4,bhk:5+",
  under15: "price:0-15000000",
  rera: "trust:rera",
  // Option ids are lowercase (see `facetGroups`); mapping the legacy chip's raw
  // enum name would silently resolve to "no such value" and drop the filter.
  "type-apartment": "type:apartment",
  "type-villa": "type:villa",
  "type-rowhouse": "type:rowhouse",
  "availability-ready": "status:ready_to_move",
  "availability-new": "status:new_launch",
  "availability-resale": "status:resale",
};

export function parseFacetState(raw: string | null | undefined, groups: FacetGroup[]): FacetState {
  const state = emptyFacetState();
  if (!raw) return state;
  const byGroup = new Map(groups.map((group) => [group.id, group]));

  const tokens = raw
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean)
    .flatMap((token) => LEGACY_TOKENS[token]?.split(",") ?? [token]);

  for (const token of tokens) {
    const separator = token.indexOf(":");
    if (separator < 0) continue; // unknown legacy id with no mapping → dropped
    const group = byGroup.get(token.slice(0, separator));
    const value = token.slice(separator + 1);
    if (!group || !value) continue;
    if (group.kind === "range") {
      const [fromRaw, toRaw] = value.split("-");
      const min = group.range?.min ?? 0;
      const max = group.range?.max ?? Number.MAX_SAFE_INTEGER;
      const parsedFrom = Number.parseInt(fromRaw, 10);
      const parsedTo = Number.parseInt(toRaw, 10);
      // Clamp each end INTO the control domain — a value above the ceiling
      // clamps down to the ceiling and a value below the floor clamps up to the
      // floor. Clamping `from` to `max(min, …)` instead would push an
      // out-of-domain ₹10 L rent budget up to the ₹3 Cr ceiling and silently
      // widen it into "no constraint at all", matching every listing.
      const clamp = (value: number) => Math.min(max, Math.max(min, value));
      const from = Number.isFinite(parsedFrom) ? clamp(parsedFrom) : min;
      const to = Number.isFinite(parsedTo) ? clamp(parsedTo) : max;
      // Clamping can invert a range — e.g. a BUY budget pasted into a RENT
      // search clamps `to` to the rent ceiling and leaves from > to. Dropping it
      // is the only honest outcome: keeping it would filter out every listing
      // while rendering a confident-looking chip, which is a far worse failure
      // than the constraint silently not applying.
      const inverted = from > to;
      // A range only counts as active when it actually narrows the domain.
      if (!inverted && (from > min || to < max)) state.ranges[group.id] = { from, to };
      continue;
    }
    const known = group.values?.some((option) => option.id === value);
    // `derive`d groups (localities) have no fixed list — any value is valid and
    // will simply show (0) if the inventory disagrees.
    if (!known && !group.derive) continue;
    const current = state.multi[group.id] ?? [];
    if (!current.includes(value)) state.multi[group.id] = [...current, value];
  }

  // A toggle is binary: any value present means "on".
  for (const group of groups) {
    if (group.kind === "toggle" && state.multi[group.id]?.length) state.multi[group.id] = [group.values?.[0]?.id ?? ""];
  }
  return state;
}

export function serializeFacetState(state: FacetState): string {
  const tokens: string[] = [];
  for (const [groupId, values] of Object.entries(state.multi)) {
    for (const value of values ?? []) tokens.push(`${groupId}:${value}`);
  }
  for (const [groupId, range] of Object.entries(state.ranges)) {
    if (!range) continue;
    tokens.push(`${groupId}:${range.from}-${range.to}`);
  }
  return tokens.join(",");
}

/* ---------- Derived values ----------
   Locality options come from the scoped inventory so an option can never be
   offered without matching data. Names come from `Property.locality` (the
   display name carried by both the fixtures and the Prisma mapper), so the
   value id survives without a second registry lookup at render time. */

export function derivedLocalityValues(listings: Property[]): FacetValue[] {
  const counts = new Map<string, { label: string; n: number }>();
  for (const listing of listings) {
    const id = listing.localitySlug;
    if (!id) continue;
    const existing = counts.get(id);
    if (existing) existing.n += 1;
    else counts.set(id, { label: listing.locality || id, n: 1 });
  }
  return [...counts.entries()]
    .map<DerivedFacetValue>(([id, { label, n }]) => ({
      id,
      label,
      count: n,
      // `count` is only used to ORDER the options. The number the UI shows is
      // always recomputed against the active state, so it can never disagree
      // with what clicking the option returns.
      match: (p: Property) => p.localitySlug === id,
    }))
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.label.localeCompare(b.label));
}

/**
 * Resolve every group's displayable values for the current scope.
 * The wider return type is deliberate: derived options carry their inventory
 * `count` for ordering, fixed ones don't — callers must not assume either.
 */
export function resolveValues(group: FacetGroup, listings: Property[]): DerivedFacetValue[] {
  if (group.derive === "localities") return derivedLocalityValues(listings);
  return group.values ?? [];
}

/* ---------- Predicates ---------- */

/** Predicate per group, resolved once per call rather than per listing — a
 *  derived group resolves its option list from the pool, so resolving inside
 *  the filter callback would be O(n²) over the inventory. */
function groupPredicates(state: FacetState, groups: FacetGroup[], listings: Property[]): Array<(listing: Property) => boolean> {
  const predicates: Array<(listing: Property) => boolean> = [];
  for (const group of groups) {
    if (group.kind === "range") {
      const range = state.ranges[group.id];
      if (!range || !group.range) continue;
      predicates.push((listing) => group.range!.match(listing, range.from, range.to));
      continue;
    }
    const selected = state.multi[group.id];
    if (!selected?.length) continue;
    const values = resolveValues(group, listings);
    const matches = selected.map((id) => values.find((value) => value.id === id)?.match).filter((match): match is (p: Property) => boolean => Boolean(match));
    // A selected id with no resolvable value constrains nothing.
    if (!matches.length) continue;
    predicates.push((listing) => matches.some((match) => match(listing)));
  }
  return predicates;
}

/** Listings matching every ACTIVE group; within a group the values are OR'd. */
export function applyFacetState(listings: Property[], state: FacetState, groups: FacetGroup[]): Property[] {
  const predicates = groupPredicates(state, groups, listings);
  if (!predicates.length) return listings;
  return listings.filter((listing) => predicates.every((predicate) => predicate(listing)));
}

/** Same as `applyFacetState` but with ONE group's predicate omitted — the
 *  basis for honest per-option counts and for "(0)" disabled states. */
export function applyFacetStateExcluding(listings: Property[], state: FacetState, groups: FacetGroup[], excludeGroupId: string): Property[] {
  return applyFacetState(listings, state, groups.filter((group) => group.id !== excludeGroupId));
}

/* ---------- Counts ---------- */

export type FacetOptionCount = { id: string; label: string; count: number; selected: boolean };
export type FacetGroupCount = {
  id: string;
  label: string;
  labelHi: string;
  kind: FacetGroupKind;
  options: FacetOptionCount[];
  /** For ranges: the shape of the available inventory, for the histogram. */
  histogram?: Histogram;
  total: number;
};
export type FacetCounts = Record<string, FacetGroupCount>;

export type HistogramBucket = { from: number; to: number; count: number };
export type Histogram = {
  field: string;
  /** Inclusive lower bound of the plotted domain (rounded). */
  floor: number;
  /** Exclusive upper bound of the plotted domain (rounded). */
  ceil: number;
  bucketWidth: number;
  buckets: HistogramBucket[];
  /** 5th–95th percentile of the observed values: the domain the control uses. */
  p5: number;
  p95: number;
  total: number;
  max: number;
};

const percentile = (sorted: number[], q: number): number => {
  if (!sorted.length) return 0;
  const position = (sorted.length - 1) * q;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
};

/** Round up to a "nice" currency/area multiple so bucket labels read as
 *  ₹25 L rather than ₹23,47,611. */
export function roundUpTo(value: number, rounding: number): number {
  if (!Number.isFinite(value) || value <= 0 || rounding <= 0) return 0;
  return Math.ceil(value / rounding) * rounding;
}

export function buildHistogram(values: number[], range: FacetRange, cap = 20): Histogram {
  const sorted = [...values].filter((v) => Number.isFinite(v) && v > 0).sort((a, b) => a - b);
  const p5 = percentile(sorted, 0.05);
  const p95 = percentile(sorted, 0.95);
  // Both bounds come from the percentiles, never from min/max: raw max squashes
  // 95% of a property market into the leftmost bucket, and a single ₹58 Cr
  // penthouse would stretch the axis until every bar looks empty. Values above
  // the plotted ceiling are reachable by typing them, and the control labels
  // them as `₹43 Cr+` rather than pretending the market ends there.
  const floor = Math.max(range.min, Math.floor((p5 || range.min) / range.bucketRounding) * range.bucketRounding);
  const ceilTarget = Math.max(p95, range.min + range.bucketRounding);
  const ceil = Math.min(range.max, Math.max(floor + range.bucketRounding, roundUpTo(ceilTarget, range.bucketRounding)));
  let bucketWidth = Math.max(range.bucketRounding, roundUpTo((ceil - floor) / 10, range.bucketRounding));
  let bucketCount = Math.max(1, Math.ceil((ceil - floor) / bucketWidth));
  if (bucketCount > cap) {
    bucketWidth = roundUpTo((ceil - floor) / cap, range.bucketRounding) || range.bucketRounding;
    bucketCount = Math.max(1, Math.ceil((ceil - floor) / bucketWidth));
  }
  const buckets: HistogramBucket[] = Array.from({ length: bucketCount }, (_, index) => ({
    from: floor + index * bucketWidth,
    to: floor + (index + 1) * bucketWidth,
    count: 0,
  }));
  for (const value of sorted) {
    const index = Math.min(buckets.length - 1, Math.max(0, Math.floor((value - floor) / bucketWidth)));
    buckets[index].count += 1;
  }
  return {
    field: range.unit,
    floor,
    ceil: floor + buckets.length * bucketWidth,
    bucketWidth,
    buckets,
    p5,
    p95,
    total: sorted.length,
    max: Math.max(1, ...buckets.map((bucket) => bucket.count)),
  };
}

export function computeFacetCounts(listings: Property[], state: FacetState, groups: FacetGroup[]): FacetCounts {
  const counts: FacetCounts = {};
  for (const group of groups) {
    // Everything except this group, so an option's count answers: "if I click
    // this, how many homes will I get?"
    const pool = applyFacetStateExcluding(listings, state, groups, group.id);
    if (group.kind === "range" && group.range) {
      const range = group.range;
      const histogram = buildHistogram(pool.map((listing) => (range.unit === "sqft" ? listing.areaNum : listing.priceNum)), range);
      counts[group.id] = {
        id: group.id,
        label: group.label,
        labelHi: group.labelHi,
        kind: "range",
        histogram,
        total: pool.length,
        options: [],
      };
      continue;
    }
    const values = resolveValues(group, pool);
    const selected = state.multi[group.id] ?? [];
    counts[group.id] = {
      id: group.id,
      label: group.label,
      labelHi: group.labelHi,
      kind: group.kind,
      total: pool.length,
      options: values.map((value) => ({
        id: value.id,
        label: value.label,
        count: pool.filter(value.match).length,
        selected: selected.includes(value.id),
      })),
    };
  }
  return counts;
}

/* ---------- Zero-result ladder ----------
   For a product monetised by leads, an empty page is lost revenue. The ladder
   relaxes the single constraint that costs the most results, so the suggestion
   is quantified rather than apologetic. */

export type Relaxation = { groupId: string; groupLabel: string; label: string; gain: number; state: FacetState };

export function computeRelaxations(listings: Property[], state: FacetState, groups: FacetGroup[], cap = 3): Relaxation[] {
  const baseline = applyFacetState(listings, state, groups).length;
  const relaxations: Relaxation[] = [];
  for (const group of groups) {
    if (group.kind === "range") {
      if (!state.ranges[group.id]) continue;
      const next = { multi: state.multi, ranges: { ...state.ranges } };
      delete next.ranges[group.id];
      relaxations.push({
        groupId: group.id,
        groupLabel: group.label,
        label: `Remove ${group.label.toLowerCase()}`,
        gain: applyFacetState(listings, next, groups).length - baseline,
        state: next,
      });
      continue;
    }
    const selected = state.multi[group.id];
    if (!selected?.length) continue;
    const next = { multi: { ...state.multi }, ranges: state.ranges };
    delete next.multi[group.id];
    relaxations.push({
      groupId: group.id,
      groupLabel: group.label,
      label: `Remove ${group.label.toLowerCase()} (${selected.length})`,
      gain: applyFacetState(listings, next, groups).length - baseline,
      state: next,
    });
  }
  return relaxations
    .filter((relaxation) => relaxation.gain > 0)
    .sort((a, b) => b.gain - a.gain)
    .slice(0, cap);
}

/** Nearest localities by inventory volume — the widening rung. */
export function wideningSuggestions(listings: Property[], state: FacetState, groups: FacetGroup[], cap = 3): DerivedFacetValue[] {
  const placeGroup: FacetGroup = { id: "place", label: "Locality", labelHi: "इलाक़ा", kind: "multi", projection: ["consumer", "desk"], derive: "localities" };
  const active = state.multi.place ?? [];
  return resolveValues(placeGroup, listings)
    .filter((value) => !active.includes(value.id))
    .map<DerivedFacetValue>((value) => ({
      ...value,
      count: applyFacetState(listings, { multi: { ...state.multi, place: [value.id] }, ranges: state.ranges }, groups).length,
    }))
    .filter((value) => (value.count ?? 0) > 0)
    .sort((a, b) => (b.count ?? 0) - (a.count ?? 0))
    .slice(0, cap);
}
