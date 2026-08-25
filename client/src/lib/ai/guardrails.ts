export type AiProviderMode = "disabled" | "deterministic" | "external";

export const AI_GUARDRAILS = [
  "AI may assist search and summarization but must not invent property, price, RERA, legal, or availability facts.",
  "AI output must be derived from visible structured facts or explicitly marked as a draft requiring review.",
  "AI must not create indexable Hindi/SEO content without editorial review.",
  "Broker moderation AI is advisory only and must never auto-approve listings or media.",
] as const;

export function getAiProviderMode(value = process.env.ARCHITECH_AI_PROVIDER): AiProviderMode {
  if (value === "external") return "external";
  if (value === "deterministic") return "deterministic";
  return "disabled";
}

export function assertNoUnverifiedClaims(text: string, allowedFacts: string[]): string[] {
  const normalized = text.toLowerCase();
  const problems: string[] = [];
  for (const risky of ["guaranteed", "officially endorsed", "government approved", "best investment", "assured return"] as const) {
    if (normalized.includes(risky)) problems.push(`Risky unverified claim: ${risky}`);
  }
  if (allowedFacts.length > 0) {
    const hasAnyFact = allowedFacts.some((fact) => normalized.includes(fact.toLowerCase()));
    if (!hasAnyFact) problems.push("AI output does not reference any allowed structured fact.");
  }
  return problems;
}
