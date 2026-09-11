import { makeFilters } from "@/lib/filters";
import { getListings, getLocalities } from "@/lib/repositories";

export type SearchAssistResponse = {
  query: string;
  structured: {
    q: string;
    filters: string[];
    localitySlug?: string;
    bhk?: number;
    maxPriceInr?: number;
  };
  confidence: number;
  source: "deterministic-ai-safe" | "disabled";
  notes: string[];
};

export function assistSearchQuery(query: string): SearchAssistResponse {
  const q = query.trim();
  const lower = q.toLowerCase();
  const filters: string[] = [];
  const notes: string[] = [];
  const locality = getLocalities().find((item) => lower.includes(item.name.toLowerCase()) || lower.includes(item.hindi));
  const bhkMatch = lower.match(/(\d+)\s*bhk/);
  const underMatch = lower.match(/under\s*₹?\s*([\d.]+)\s*(cr|crore|l|lakh)/);

  if (bhkMatch) {
    const bhk = Number.parseInt(bhkMatch[1], 10);
    if (bhk === 2) filters.push("2bhk");
    if (bhk >= 3) filters.push("3bhk");
  }
  if (underMatch) {
    const n = Number.parseFloat(underMatch[1]);
    const maxPriceInr = underMatch[2].startsWith("l") ? n * 100_000 : n * 10_000_000;
    if (maxPriceInr <= 15_000_000) filters.push("under15");
  }
  if (lower.includes("rera") || lower.includes("verified")) filters.push("rera");

  const validFilters = new Set(makeFilters().map((filter) => filter.id));
  const deduped = [...new Set(filters)].filter((filter) => validFilters.has(filter));
  if (locality) notes.push(`Matched locality: ${locality.name}`);
  if (deduped.length) notes.push(`Suggested filters: ${deduped.join(", ")}`);
  if (getListings().some((listing) => lower.includes(listing.title.toLowerCase()))) notes.push("Matched a known listing title.");

  return {
    query: q,
    structured: {
      q,
      filters: deduped,
      localitySlug: locality?.slug,
      bhk: bhkMatch ? Number.parseInt(bhkMatch[1], 10) : undefined,
      maxPriceInr: underMatch ? (underMatch[2].startsWith("l") ? Number.parseFloat(underMatch[1]) * 100_000 : Number.parseFloat(underMatch[1]) * 10_000_000) : undefined,
    },
    confidence: Math.min(0.95, 0.45 + (locality ? 0.2 : 0) + (bhkMatch ? 0.15 : 0) + (deduped.length ? 0.15 : 0)),
    source: "deterministic-ai-safe",
    notes: notes.length ? notes : ["No strong structured intent detected; pass query to normal search."],
  };
}
