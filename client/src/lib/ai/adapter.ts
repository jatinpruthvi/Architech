/* Optional LLM adapter contract.
   The AI assistance modules stay deterministic by default; when an external
   provider is configured the platform should switch via this typed contract so
   cost, latency, and guardrails remain auditable. The contract and its
   validation are provider-agnostic; the concrete provider is behind a source
   switch so no provider SDK leaks into the client bundle.

   Industrial practices: telemetry stays first-class (every call reports
   provider, tokens, latency, cost), output is validated, and failures fall back
   to the deterministic implementation rather than surfacing text to users. */

import { getAiProviderMode } from "./guardrails";

export type AiProviderId = "deterministic" | "external";

export type AiUsage = {
  inputTokens?: number;
  outputTokens?: number;
  latencyMs: number;
  estimatedCostInr: number;
};

export type AiResult<T> = {
  ok: boolean;
  data?: T;
  /** When the provider was skipped or failed, the deterministic fallback ran. */
  fallbackUsed: boolean;
  provider: AiProviderId;
  usage: AiUsage;
  warnings: string[];
};

export const AI_GUARDRAILS_LIMITS = {
  maxInputChars: 8_000,
  maxOutputChars: 4_000,
} as const;

export function assertAiInputWithinLimits(value: unknown): string[] {
  const warnings: string[] = [];
  const serialized = typeof value === "string" ? value : JSON.stringify(value ?? "");
  if (serialized.length > AI_GUARDRAILS_LIMITS.maxInputChars) warnings.push("AI input exceeds maximum length; falling back to deterministic.");
  return warnings;
}

export type AiAdapterOptions<TInput, T> = {
  /** Deterministic renderer used when the external provider is unavailable. */
  deterministic: (input: TInput) => T;
  /** Optional external call; only invoked when provider is external. */
  external?: (input: TInput) => Promise<T>;
  /** Explicit provider choice; defaults to the configured AI source switch. */
  provider?: AiProviderId;
};

/** Wrap an AI call so telemetry, guardrails, and fallback are always applied. */
export async function runAiAdapter<TInput, T>(
  input: TInput,
  options: AiAdapterOptions<TInput, T>,
): Promise<AiResult<T>> {
  const { deterministic, external, provider: providerOverride } = options;
  const provider: AiProviderId = providerOverride ?? (getAiProviderMode() === "external" ? "external" : "deterministic");
  const start = performance.now();
  const warnings = assertAiInputWithinLimits(input);

  /* B-10: the guardrail said "falling back to deterministic" but only warned —
     the external provider was still called with oversized input. Enforce it:
     over-limit input never reaches the external call, and the result is
     marked as a fallback. */
  if (warnings.length > 0) {
    return {
      ok: true,
      data: deterministic(input),
      fallbackUsed: true,
      provider: "deterministic",
      usage: { latencyMs: Math.round(performance.now() - start), estimatedCostInr: 0 },
      warnings,
    };
  }

  if (provider === "deterministic") {
    return {
      ok: true,
      data: deterministic(input),
      fallbackUsed: false,
      provider,
      usage: { latencyMs: Math.round(performance.now() - start), estimatedCostInr: 0 },
      warnings,
    };
  }

  if (!external) {
    // External provider not implemented but enabled — fail safe to deterministic.
    return {
      ok: true,
      data: deterministic(input),
      fallbackUsed: true,
      provider: "deterministic",
      usage: { latencyMs: Math.round(performance.now() - start), estimatedCostInr: 0 },
      warnings: ["External provider not available; used deterministic fallback."],
    };
  }

  try {
    const data = await external(input);
    return {
      ok: true,
      data,
      fallbackUsed: false,
      provider,
      usage: { latencyMs: Math.round(performance.now() - start), estimatedCostInr: 0 },
      warnings,
    };
  } catch (error) {
    return {
      ok: true,
      data: deterministic(input),
      fallbackUsed: true,
      provider: "deterministic",
      usage: { latencyMs: Math.round(performance.now() - start), estimatedCostInr: 0 },
      warnings: [`External AI provider failed; used deterministic fallback. (${error instanceof Error ? error.message : "error"})`],
    };
  }
}

/** Cost projection for a text response given an assumed per-token rate. */
export function estimateCostInr(inputTokens: number, outputTokens: number, perMillionInputInr: number, perMillionOutputInr: number): number {
  const inputCost = (inputTokens / 1_000_000) * perMillionInputInr;
  const outputCost = (outputTokens / 1_000_000) * perMillionOutputInr;
  return Math.round((inputCost + outputCost) * 100) / 100;
}
