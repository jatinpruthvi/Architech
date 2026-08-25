import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const config = JSON.parse(readFileSync("governance/operations/phase-1-operational-readiness.json", "utf8"));

describe("operational readiness registry", () => {
  it("declares RPO/RTO and backup retention", () => {
    expect(config.rpoHours).toBeGreaterThan(0);
    expect(config.rtoHours).toBeGreaterThan(0);
    expect(config.backupRetentionDays).toBeGreaterThanOrEqual(30);
  });

  it("assigns owner, restore plan, and budget to each service", () => {
    for (const service of config.services) {
      expect(service.owner).toBeTruthy();
      expect(service.backup).toBeTruthy();
      expect(service.restore).toBeTruthy();
      expect(service.monthlyBudgetInr).toBeGreaterThan(0);
      expect(service.alertAtPercent).toBeGreaterThan(0);
    }
  });

  it("covers database and media restore scenarios", () => {
    expect(config.services.map((service: { id: string }) => service.id)).toEqual(expect.arrayContaining(["postgres-postgis", "media-r2-stream"]));
    expect(config.restoreDrillChecklist.join(" ")).toContain("database backup");
    expect(config.restoreDrillChecklist.join(" ")).toContain("media");
  });
});
