/* Deterministic matching between broker demand and supply.

   WHY THE SCORE IS TRUSTWORTHY HERE

   Supply is anchored to a real ACTIVE Listing, so price, BHK and area come from
   verified inventory that a buyer can also see on the public site. A score is
   therefore a statement about real property, not about numbers a broker typed
   into a form. That is the whole reason the channel requires a listing first.

   DETERMINISM

   Same inputs must always give the same score, or brokers cannot trust the
   ranking and we cannot write fixtures. Two consequences:

     - `now` is injected, never read from the clock inside scoring.
     - No randomness, no locale-dependent comparison, no floating-point
       accumulation beyond a final round.

   The weights below sum to 100 so a score reads as a percentage. */

export type MatchIntent = "BUY" | "RENT";

/** Buyer-side criteria. No customer identity: this describes what, never who. */
export type DemandCriteria = {
  requestId: string;
  organizationId: string;
  intent: MatchIntent;
  cityId: string;
  localityId?: string | null;
  propertyType: string;
  budgetMinInr?: number | null;
  budgetMaxInr?: number | null;
  bhkMin?: number | null;
  bhkMax?: number | null;
  areaMinSqft?: number | null;
  areaMaxSqft?: number | null;
  createdAt: Date;
};

/** Supply-side facts, read from the anchored Listing. */
export type SupplyCandidate = {
  requestId: string;
  organizationId: string;
  listingId: string;
  intent: MatchIntent;
  cityId: string;
  localityId?: string | null;
  propertyType: string;
  /** From Listing.priceInr. Authoritative. */
  priceInr: number;
  bhk?: number | null;
  areaSqft?: number | null;
  createdAt: Date;
  /** Signals that make verified inventory rank above unverified. */
  verification?: string | null;
  mediaCount?: number;
};

export type MatchReason = {
  factor: string;
  weight: number;
  points: number;
  note: string;
};

export type MatchResult = {
  score: number;
  reasons: MatchReason[];
  band: "STRONG" | "GOOD" | "POSSIBLE" | "WEAK";
};

export type RejectionReason =
  | "CITY_MISMATCH"
  | "INTENT_MISMATCH"
  | "PROPERTY_TYPE_MISMATCH"
  | "LOCALITY_MISMATCH"
  | "BHK_OUT_OF_RANGE"
  | "PRICE_OVER_BUDGET"
  | "SAME_ORGANIZATION";

/* Weights. Locality dominates because in Indian residential search the
   neighbourhood is usually non-negotiable in a way that budget is not: a buyer
   will stretch 10% on price far sooner than move to a different part of town.

   listingQuality is small but deliberate. It is what makes the listing anchor
   pay off -- a verified listing with photos outranks a bare one at the same
   price, which rewards brokers for putting real inventory on the site. */
export const WEIGHTS = {
  locality: 30,
  propertyType: 20,
  budgetFit: 25,
  sizeFit: 15,
  listingQuality: 10,
} as const;

/** Supply may exceed the stated budget by this much and still be shown. */
export const BUDGET_TOLERANCE = 1.1;

const clamp01 = (n: number) => (n < 0 ? 0 : n > 1 ? 1 : n);

/* Hard filters. A pair failing any of these is not a weak match, it is not a
   match: showing it would waste both brokers' attention. */
export function rejectionFor(demand: DemandCriteria, supply: SupplyCandidate): RejectionReason | null {
  if (demand.organizationId === supply.organizationId) return "SAME_ORGANIZATION";
  if (demand.cityId !== supply.cityId) return "CITY_MISMATCH";
  if (demand.intent !== supply.intent) return "INTENT_MISMATCH";
  if (demand.propertyType !== supply.propertyType) return "PROPERTY_TYPE_MISMATCH";

  /* Locality is only a hard filter when BOTH sides name one. A demand with no
     locality is city-wide by choice and should see everything in the city. */
  if (demand.localityId && supply.localityId && demand.localityId !== supply.localityId) {
    return "LOCALITY_MISMATCH";
  }

  if (supply.bhk != null) {
    if (demand.bhkMin != null && supply.bhk < demand.bhkMin) return "BHK_OUT_OF_RANGE";
    if (demand.bhkMax != null && supply.bhk > demand.bhkMax) return "BHK_OUT_OF_RANGE";
  }

  if (demand.budgetMaxInr != null && supply.priceInr > Math.round(demand.budgetMaxInr * BUDGET_TOLERANCE)) {
    return "PRICE_OVER_BUDGET";
  }

  return null;
}

/* Score a pair that has already passed the hard filters.

   `now` is a parameter so the recency-free scoring stays deterministic and
   fixtures do not rot. */
export function scoreMatch(
  demand: DemandCriteria,
  supply: SupplyCandidate,
  now: Date = new Date(),
): MatchResult {
  const reasons: MatchReason[] = [];
  const add = (factor: string, weight: number, ratio: number, note: string) => {
    const points = Math.round(weight * clamp01(ratio));
    reasons.push({ factor, weight, points, note });
  };

  // --- Locality ------------------------------------------------------------
  if (demand.localityId && supply.localityId && demand.localityId === supply.localityId) {
    add("locality", WEIGHTS.locality, 1, "Exact locality match");
  } else if (!demand.localityId) {
    // Buyer is open to the whole city; no penalty for a specific supply.
    add("locality", WEIGHTS.locality, 0.8, "Buyer open to any locality in this city");
  } else {
    add("locality", WEIGHTS.locality, 0.5, "Same city, different locality");
  }

  // --- Property type -------------------------------------------------------
  // Guaranteed equal by the hard filter; scored so the breakdown is complete
  // and the weights visibly sum to 100.
  add("propertyType", WEIGHTS.propertyType, 1, `Both ${supply.propertyType.toLowerCase()}`);

  // --- Budget fit ----------------------------------------------------------
  if (demand.budgetMaxInr == null) {
    add("budgetFit", WEIGHTS.budgetFit, 0.6, "No budget stated");
  } else if (supply.priceInr <= demand.budgetMaxInr) {
    /* Inside budget. Closer to the top of the range scores higher: a buyer
       willing to spend 1 crore is usually better served by a 95L flat than a
       60L one, which is likely a different segment entirely. */
    const floor = demand.budgetMinInr ?? Math.round(demand.budgetMaxInr * 0.6);
    const span = Math.max(1, demand.budgetMaxInr - floor);
    const position = clamp01((supply.priceInr - floor) / span);
    add("budgetFit", WEIGHTS.budgetFit, 0.75 + 0.25 * position, "Within budget");
  } else {
    // Over budget but inside tolerance: degrade smoothly toward the ceiling.
    const over = supply.priceInr - demand.budgetMaxInr;
    const allowed = Math.max(1, Math.round(demand.budgetMaxInr * (BUDGET_TOLERANCE - 1)));
    const overshoot = clamp01(over / allowed);
    const pct = Math.round((over / demand.budgetMaxInr) * 100);
    add("budgetFit", WEIGHTS.budgetFit, 0.5 * (1 - overshoot), `${pct}% over budget`);
  }

  // --- Size fit ------------------------------------------------------------
  const bhkRatio = scoreBhk(demand, supply);
  const areaRatio = scoreArea(demand, supply);
  const parts = [bhkRatio, areaRatio].filter((r): r is number => r !== null);
  const sizeRatio = parts.length ? parts.reduce((a, b) => a + b, 0) / parts.length : 0.5;
  add("sizeFit", WEIGHTS.sizeFit, sizeRatio, sizeNote(demand, supply, parts.length));

  // --- Listing quality -----------------------------------------------------
  /* The listing anchor made visible in the ranking: verified inventory with
     photos outranks a bare listing at the same price. */
  const verified = supply.verification === "RERA_VERIFIED" || supply.verification === "VERIFIED_PARTNER";
  const hasPhotos = (supply.mediaCount ?? 0) > 0;
  const manyPhotos = (supply.mediaCount ?? 0) >= 3;
  const qualityRatio = (verified ? 0.5 : 0) + (hasPhotos ? 0.25 : 0) + (manyPhotos ? 0.25 : 0);
  add(
    "listingQuality",
    WEIGHTS.listingQuality,
    qualityRatio,
    [verified ? "Verified listing" : "Unverified listing", hasPhotos ? `${supply.mediaCount} photos` : "No photos"].join(", "),
  );

  void now; // Recency is not scored: see the note in the test suite.

  const score = reasons.reduce((total, r) => total + r.points, 0);
  return { score, reasons, band: bandFor(score) };
}

function scoreBhk(demand: DemandCriteria, supply: SupplyCandidate): number | null {
  if (supply.bhk == null) return null;
  if (demand.bhkMin == null && demand.bhkMax == null) return null;
  const min = demand.bhkMin ?? supply.bhk;
  const max = demand.bhkMax ?? supply.bhk;
  if (supply.bhk >= min && supply.bhk <= max) return 1;
  const distance = supply.bhk < min ? min - supply.bhk : supply.bhk - max;
  return clamp01(1 - distance * 0.5);
}

function scoreArea(demand: DemandCriteria, supply: SupplyCandidate): number | null {
  if (supply.areaSqft == null) return null;
  if (demand.areaMinSqft == null && demand.areaMaxSqft == null) return null;
  const min = demand.areaMinSqft ?? 0;
  const max = demand.areaMaxSqft ?? Number.MAX_SAFE_INTEGER;
  if (supply.areaSqft >= min && supply.areaSqft <= max) return 1;
  const target = supply.areaSqft < min ? min : max;
  if (target === 0) return 0;
  return clamp01(1 - Math.abs(supply.areaSqft - target) / target);
}

function sizeNote(demand: DemandCriteria, supply: SupplyCandidate, parts: number): string {
  if (parts === 0) return "No size criteria stated";
  const bits: string[] = [];
  if (supply.bhk != null && (demand.bhkMin != null || demand.bhkMax != null)) bits.push(`${supply.bhk} BHK`);
  if (supply.areaSqft != null && (demand.areaMinSqft != null || demand.areaMaxSqft != null)) {
    bits.push(`${supply.areaSqft} sq ft`);
  }
  return bits.join(", ");
}

export function bandFor(score: number): MatchResult["band"] {
  if (score >= 80) return "STRONG";
  if (score >= 60) return "GOOD";
  if (score >= 40) return "POSSIBLE";
  return "WEAK";
}

/** Below this a pair is not surfaced: noise costs more than a missed lead. */
export const MIN_SURFACED_SCORE = 40;

export type ScoredMatch = MatchResult & {
  demandRequestId: string;
  supplyRequestId: string;
  demandOrganizationId: string;
  supplyOrganizationId: string;
};

/* Score one demand against many candidates, keeping only what is worth showing.

   Ties break on requestId so ordering is total and stable -- otherwise two
   equally-scored matches could swap places between page loads. */
export function matchDemandAgainstSupply(
  demand: DemandCriteria,
  candidates: SupplyCandidate[],
  now: Date = new Date(),
): ScoredMatch[] {
  const matches: ScoredMatch[] = [];
  for (const candidate of candidates) {
    if (rejectionFor(demand, candidate)) continue;
    const result = scoreMatch(demand, candidate, now);
    if (result.score < MIN_SURFACED_SCORE) continue;
    matches.push({
      ...result,
      demandRequestId: demand.requestId,
      supplyRequestId: candidate.requestId,
      demandOrganizationId: demand.organizationId,
      supplyOrganizationId: candidate.organizationId,
    });
  }
  return matches.sort((a, b) =>
    b.score !== a.score ? b.score - a.score : a.supplyRequestId < b.supplyRequestId ? -1 : 1,
  );
}
