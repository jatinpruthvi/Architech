import { getListingById, getLocalityBySlug } from "@/lib/repositories";
import { assertNoUnverifiedClaims } from "./guardrails";

export type AiExplanation = {
  text: string;
  factsUsed: string[];
  reviewStatus: "safe_deterministic" | "needs_editorial_review";
  warnings: string[];
};

export function explainLocality(localitySlug: string): AiExplanation {
  const locality = getLocalityBySlug(localitySlug);
  if (!locality) return { text: "Locality not found.", factsUsed: [], reviewStatus: "safe_deterministic", warnings: [] };
  const facts = [locality.name, locality.note, locality.coords];
  const text = `${locality.name} is described as ${locality.note.toLowerCase()}. Coordinates are ${locality.coords}. Use this as locality context, not as a guarantee of suitability.`;
  return { text, factsUsed: facts, reviewStatus: "safe_deterministic", warnings: assertNoUnverifiedClaims(text, facts) };
}

export function compareListings(leftId: string, rightId: string): AiExplanation {
  const left = getListingById(leftId);
  const right = getListingById(rightId);
  if (!left || !right) return { text: "One or both listings were not found.", factsUsed: [], reviewStatus: "safe_deterministic", warnings: [] };
  const facts = [left.title, right.title, left.price, right.price, left.locality, right.locality, left.area, right.area];
  const text = `${left.title} in ${left.locality} is listed at ${left.price} with ${left.area}. ${right.title} in ${right.locality} is listed at ${right.price} with ${right.area}. Compare price, area, locality, verification badge, and freshness before deciding.`;
  return { text, factsUsed: facts, reviewStatus: "safe_deterministic", warnings: assertNoUnverifiedClaims(text, facts) };
}
