import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const environments = JSON.parse(readFileSync("governance/environments/phase-1-environments.json", "utf8"));
const secrets = JSON.parse(readFileSync("governance/secrets/phase-1-secret-inventory.json", "utf8"));

describe("production environment provisioning plan", () => {
  it("defines preview, staging, and production", () => {
    expect(environments.environments.map((env: { name: string }) => env.name)).toEqual(["preview", "staging", "production"]);
  });

  it("keeps environments blocked on external account access", () => {
    expect(environments.environments.every((env: { provisioningStatus: string }) => env.provisioningStatus === "blocked_external_account_access")).toBe(true);
  });

  it("tracks secret ownership and rotation", () => {
    expect(secrets.policy).toBe("names_only_no_secret_values_in_source_control");
    expect(secrets.secrets.map((secret: { name: string }) => secret.name)).toContain("DATABASE_URL");
    expect(secrets.secrets.every((secret: { owner: string; rotationDays: number }) => secret.owner && secret.rotationDays > 0)).toBe(true);
  });
});
