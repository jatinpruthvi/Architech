import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const evidence = JSON.parse(readFileSync("governance/release/phase-1-release-evidence.json", "utf8"));
const report = readFileSync("docs/release/phase-1-release-report.md", "utf8");

describe("Phase 1 release report", () => {
  it("records a non-production release decision", () => {
    expect(evidence.decision).toBe("validated_prototype_foundation_not_production_enabled");
    expect(report).toContain("Do **not** market it as a live verified marketplace");
  });

  it("requires the expected validation commands", () => {
    expect(evidence.requiredCommands).toEqual(expect.arrayContaining(["pnpm check", "pnpm test", "pnpm build", "pnpm test:a11y", "pnpm security:audit", "pnpm ops:audit"]));
  });

  it("tracks production blockers", () => {
    expect(evidence.productionBlockers).toEqual(expect.arrayContaining(["legal-gate-approvals", "database-migration-on-real-postgres", "live-auth-sessions"]));
  });
});
