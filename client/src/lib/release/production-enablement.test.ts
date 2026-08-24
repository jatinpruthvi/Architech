import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const plan = JSON.parse(readFileSync("governance/release/production-enablement-plan.json", "utf8"));

describe("production enablement plan", () => {
  it("keeps production blocked until evidence gates pass", () => {
    expect(plan.decision).toBe("do_not_enable_production_until_all_required_gates_are_evidenced");
    expect(plan.blockedUntil.join(" ")).toContain("legal gates");
  });

  it("defines preview, staging and production environments", () => {
    expect(plan.environments.map((env: { name: string }) => env.name)).toEqual(expect.arrayContaining(["preview", "staging", "production"]));
  });

  it("tracks required adapter switches", () => {
    expect(plan.adapterSwitches.map((item: { id: string }) => item.id)).toEqual(expect.arrayContaining(["repositories", "search", "leads", "auth", "media", "rera", "observability"]));
  });
});
