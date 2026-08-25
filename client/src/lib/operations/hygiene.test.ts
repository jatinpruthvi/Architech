import { describe, expect, it } from "vitest";
import { detectSecretInString, rollbackReadiness, validateEnvCatalog, validateRemoteUrl } from "./hygiene";

describe("secret & operational hygiene", () => {
  it("detects common secret shapes in source/URL strings", () => {
    expect(detectSecretInString("token ghp_abc123", "source")[0]).toContain("ghp_");
    expect(detectSecretInString("const key = 'AKIA999'", "source")[0]).toContain("AKIA");
    expect(detectSecretInString("clean string", "source")).toEqual([]);
  });

  it("rejects a git remote that embeds credentials", () => {
    const bad = validateRemoteUrl("https://x-access-token:ghp_abc@github.com/jatinpruthvi/Architech.git");
    expect(bad.ok).toBe(false);
    expect(bad.issues.some((issue) => issue.includes("credentials"))).toBe(true);
  });

  it("accepts a clean git remote", () => {
    expect(validateRemoteUrl("https://github.com/jatinpruthvi/Architech.git").ok).toBe(true);
  });

  it("flags unknown env keys against the allow-list", () => {
    const result = validateEnvCatalog({ DATABASE_URL: "postgres://db", AWS_SECRET_ACCESS_KEY: "x" });
    expect(result.ok).toBe(false);
    expect(result.issues.some((issue) => issue.includes("AWS_SECRET_ACCESS_KEY"))).toBe(true);
  });

  it("reports rollback not ready when gates are missing", () => {
    const check = rollbackReadiness({ gated: false, backupCrisp: false, healthEndpoint: "", lastGoodCommit: "" });
    expect(check.ok).toBe(false);
    expect(check.reasons.length).toBeGreaterThanOrEqual(4);
  });
});
