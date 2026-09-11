import { describe, expect, it } from "vitest";
import { assertAiInputWithinLimits, estimateCostInr, runAiAdapter } from "./adapter";

const deterministic = (input: string) => `det:${input}`;

describe("optional AI adapter contract", () => {
  it("uses the deterministic provider by default (no external configured)", async () => {
    const result = await runAiAdapter("hello", { deterministic });
    expect(result.provider).toBe("deterministic");
    expect(result.fallbackUsed).toBe(false);
    expect(result.data).toBe("det:hello");
    expect(result.usage.latencyMs).toBeGreaterThanOrEqual(0);
    /* Deterministic compute has no provider bill; 0 is the true cost here. */
    expect(result.usage.estimatedCostInr).toBe(0);
  });

  it("reports external-provider cost as untracked (null), never as 0 (I-2)", async () => {
    const result = await runAiAdapter("hello", { deterministic, external: async (value) => `six-pro:${value}`, provider: "external" });
    expect(result.fallbackUsed).toBe(false);
    expect(result.provider).toBe("external");
    /* A metered-by-someone-else call reporting ₹0 would silence the very
       budget alarm this column exists to feed. */
    expect(result.usage.estimatedCostInr).toBeNull();
    expect(result.warnings.some((warning) => warning.includes("unmetered"))).toBe(true);
  });

  it("falls back to deterministic when the external provider is absent", async () => {
    const result = await runAiAdapter("hello", { deterministic, provider: "external" });
    expect(result.fallbackUsed).toBe(true);
    expect(result.provider).toBe("deterministic");
    expect(result.warnings.some((warning) => warning.includes("deterministic"))).toBe(true);
  });

  it("falls back to deterministic when the external provider throws", async () => {
    const result = await runAiAdapter("hello", {
      deterministic,
      provider: "external",
      external: async () => {
        throw new Error("upstream 429");
      },
    });
    expect(result.fallbackUsed).toBe(true);
    expect(result.data).toBe("det:hello");
    expect(result.warnings.some((warning) => warning.includes("429"))).toBe(true);
  });

  it("reports an external provider result", async () => {
    const result = await runAiAdapter("hello", {
      deterministic,
      provider: "external",
      external: async (input) => `ext:${input}`,
    });
    expect(result.provider).toBe("external");
    expect(result.fallbackUsed).toBe(false);
    expect(result.data).toBe("ext:hello");
  });

  it("warns when AI input exceeds the safe length limit", () => {
    expect(assertAiInputWithinLimits("x".repeat(9_000))[0]).toContain("exceeds");
    expect(assertAiInputWithinLimits("short")).toEqual([]);
  });

  it("projects cost from token counts", () => {
    // 1M input + 1M output at 20/30 INR per M = 50 INR
    expect(estimateCostInr(1_000_000, 1_000_000, 20, 30)).toBe(50);
  });
});
