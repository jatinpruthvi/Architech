/* Buyer-lead ↔ crawled-listing matching. Pure and dependency-free so the
   scoring stays trivially unit-testable; the repository feeds it plain rows
   and the matches page renders its output. Weights (approved design):
   BHK 40 · budget 35 · area 20 · furniture 5 — scored WITH tolerance:
   a 3BHK can serve a 2BHK buyer (half credit), a slightly-over-budget
   listing stays visible with the overage called out, and a partial area
   hit ("Thaltej" ≈ "Thaltej East") still counts. */

export type DealKind = "RENT" | "SELL";

const RENT_CATEGORIES = new Set(["RESIDENTIAL_RENT", "COMMERCIAL_RENT"]);
const SELL_CATEGORIES = new Set(["RESIDENTIAL_SELL", "COMMERCIAL_SELL"]);

export interface BuyerLeadInput {
  dealType: DealKind;
  /** 1–4, where 4 means "4+"; null = no preference. */
  bhk: number | null;
  /** INR — per month for RENT, total for SELL; null = no stated budget. */
  budgetValue: number | null;
  area: string | null;
  /** "Furnished" | "Semi-furnished" | "Unfurnished" | "Any" | null. */
  furniture: string | null;
}

export interface MatchableListingInput {
  id: string;
  /** TechnoCategory enum value as a string. */
  category: string;
  keyInfo: string | null;
  availabilityRaw: string | null;
  area: string | null;
  rentPriceValue: bigint | null;
  furnitureRaw: string | null;
  active: boolean;
  isRentedOut: boolean;
  soldOut: boolean;
}

export type MatchTier = "strong" | "good" | "possible" | "low";

export interface MatchReason {
  text: string;
  /** true = the criterion is satisfied (green chip), false = a tolerance/
   *  miss (amber chip). */
  ok: boolean;
}

export interface BuyerMatchResult {
  listingId: string;
  score: number;
  tier: MatchTier;
  reasons: MatchReason[];
}

/* "2BHK High Rise Apartment" → 2. Scans keyInfo first, then availability —
   the crawler puts the BHK tag in keyInfo, availability is the fallback. */
export function parseBhk(keyInfo: string | null, availabilityRaw: string | null): number | null {
  for (const raw of [keyInfo, availabilityRaw]) {
    if (!raw) continue;
    const m = /\b([1-9])\s*BHK\b/i.exec(raw);
    if (m) return Number(m[1]);
  }
  return null;
}

function normalizeArea(raw: string | null): string {
  return (raw ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

type FurnitureKind = "furnished" | "semi" | "unfurnished" | "unknown";

/* "Semi-Furnished" / "semi furnished" → semi. Order matters: test the
   negative and the modifier before the plain word, or "unfurnished" would
   match "furnished". */
export function furnitureKind(raw: string | null): FurnitureKind {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return "unknown";
  if (v.includes("semi")) return "semi";
  if (v.includes("unfurnish") || v.startsWith("un")) return "unfurnished";
  if (v.includes("furnish") || v.includes("fully")) return "furnished";
  return "unknown";
}

function wantFurnitureKind(want: string | null): FurnitureKind | null {
  switch ((want ?? "").trim().toLowerCase()) {
    case "furnished":
      return "furnished";
    case "semi-furnished":
    case "semi furnished":
    case "semi":
      return "semi";
    case "unfurnished":
      return "unfurnished";
    case "any":
    case "":
      return null;
    default:
      return null;
  }
}

function inr(value: number, perMonth: boolean): string {
  return `₹${value.toLocaleString("en-IN")}${perMonth ? "/mo" : ""}`;
}

/* Weighted components — each returns [points, reason | null]. Null reason =
   neutral. A buyer who stated NO preference scores half the weight on that
   component (neutral totals 50 → "possible"), so a bare name-and-number
   lead never makes every listing look like a "Strong" match. */
function bhkScore(lead: BuyerLeadInput, listingBhk: number | null): [number, MatchReason | null] {
  if (lead.bhk == null) return [20, null];
  if (listingBhk == null) return [15, { text: "BHK not listed", ok: false }];
  if (listingBhk === lead.bhk) return [40, { text: `${lead.bhk}BHK ✓`, ok: true }];
  if (listingBhk === lead.bhk + 1)
    return [20, { text: `${listingBhk}BHK — one up`, ok: false }];
  if (listingBhk < lead.bhk)
    return [0, { text: `${listingBhk}BHK — smaller`, ok: false }];
  return [0, { text: `${listingBhk}BHK — larger`, ok: false }];
}

function budgetScore(lead: BuyerLeadInput, listing: MatchableListingInput): [number, MatchReason | null] {
  if (lead.budgetValue == null) return [18, null];
  if (listing.rentPriceValue == null) return [15, { text: "Price not listed", ok: false }];
  const price = Number(listing.rentPriceValue);
  const perMonth = lead.dealType === "RENT";
  if (price <= lead.budgetValue)
    return [35, { text: `${inr(price, perMonth)} ✓`, ok: true }];
  const over = price - lead.budgetValue;
  const ratio = over / lead.budgetValue;
  const text =
    ratio > 0.25
      ? `${Math.round(ratio * 100)}% over budget`
      : `${inr(over, perMonth)} over budget`;
  if (ratio <= 0.1) return [25, { text, ok: false }];
  if (ratio <= 0.25) return [15, { text, ok: false }];
  return [5, { text, ok: false }];
}

function areaScore(lead: BuyerLeadInput, listing: MatchableListingInput): [number, MatchReason | null] {
  const want = normalizeArea(lead.area);
  if (!want) return [10, null];
  const have = normalizeArea(listing.area);
  if (!have) return [5, { text: "Area not listed", ok: false }];
  if (have === want) return [20, { text: `${lead.area} ✓`, ok: true }];
  const shorter = want.length < have.length ? want : have;
  const longer = want.length < have.length ? have : want;
  /* Partial hit needs a minimum length so "va" doesn't match "Vasna". */
  if (shorter.length >= 4 && longer.includes(shorter))
    return [15, { text: `${listing.area} — nearby`, ok: true }];
  return [0, { text: `${listing.area} (wants ${lead.area})`, ok: false }];
}

function furnitureScore(lead: BuyerLeadInput, listing: MatchableListingInput): [number, MatchReason | null] {
  const want = wantFurnitureKind(lead.furniture);
  if (want == null) return [2, null];
  const have = furnitureKind(listing.furnitureRaw);
  if (have === "unknown") return [2, { text: "Furnishing not listed", ok: false }];
  if (have === want)
    return [5, { text: `${lead.furniture} ✓`, ok: true }];
  return [0, { text: `${listing.furnitureRaw} (wants ${lead.furniture})`, ok: false }];
}

export function tierFor(score: number): MatchTier {
  if (score >= 80) return "strong";
  if (score >= 60) return "good";
  if (score >= 40) return "possible";
  return "low";
}

/**
 * Score one listing for one buyer. Returns null when the listing can never
 * serve the buyer (wrong deal kind, inactive, already rented/sold).
 */
export function scoreBuyerMatch(
  lead: BuyerLeadInput,
  listing: MatchableListingInput,
): BuyerMatchResult | null {
  const categories = lead.dealType === "RENT" ? RENT_CATEGORIES : SELL_CATEGORIES;
  if (!categories.has(listing.category)) return null;
  if (!listing.active) return null;
  /* Rented-out or sold listings are stale for every deal kind. */
  if (listing.isRentedOut || listing.soldOut) return null;

  const [bhkPts, bhkReason] = bhkScore(lead, parseBhk(listing.keyInfo, listing.availabilityRaw));
  const [budgetPts, budgetReason] = budgetScore(lead, listing);
  const [areaPts, areaReason] = areaScore(lead, listing);
  const [furnPts, furnReason] = furnitureScore(lead, listing);

  const score = bhkPts + budgetPts + areaPts + furnPts;
  const reasons = [bhkReason, budgetReason, areaReason, furnReason].filter(
    (r): r is MatchReason => r !== null,
  );
  return { listingId: listing.id, score, tier: tierFor(score), reasons };
}

/** Rank a candidate pool for one buyer: hard exclusions drop, "low" tier
 *  hides, the rest sort by score (ties → caller's original order). */
export function rankMatches(
  lead: BuyerLeadInput,
  listings: MatchableListingInput[],
  cap = 24,
): BuyerMatchResult[] {
  const results = listings
    .map((l) => scoreBuyerMatch(lead, l))
    .filter((r): r is BuyerMatchResult => r !== null && r.tier !== "low");
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, cap);
}
