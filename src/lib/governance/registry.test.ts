import { beforeEach, describe, expect, it } from "vitest";
import { listOutreach, listRegistryAssets, recordOutreach, registerAuthorityAsset, resetAuthorityRegistryForTests } from "./registry";
import { getAuthorityStorageMode } from "./source";

const validAsset = {
  type: "guide" as const,
  title: "How we verify against Gujarat RERA",
  isNofollow: true,
  paidForLink: false,
  disclosure: "declared" as const,
};

describe("authority asset & outreach registry", () => {
  beforeEach(() => resetAuthorityRegistryForTests());

  it("registers an auditable authority asset idempotently", () => {
    const first = registerAuthorityAsset(validAsset);
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    expect(first.value.id).toMatch(/^asset_/);
    expect(first.duplicate).toBe(false);

    const second = registerAuthorityAsset(validAsset);
    expect(second.ok && second.duplicate).toBe(true);
    expect(listRegistryAssets()).toHaveLength(1);
  });

  it("rejects a paid-for-link asset per the disclosure policy", () => {
    const result = registerAuthorityAsset({ ...validAsset, paidForLink: true, disclosure: "n-a" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.status).toBe(400);
  });

  it("records and lists accepted outreach with a named reviewer", () => {
    registerAuthorityAsset(validAsset);
    const asset = listRegistryAssets()[0];
    const result = recordOutreach({ date: "2026-08-25", target: "example.com", assetId: asset.id, outcome: "accepted", reviewedBy: "SEO Lead" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.reviewedBy).toBe("SEO Lead");
    expect(listOutreach()).toHaveLength(1);
  });

  it("rejects accepted outreach without an asset or reviewer", () => {
    const result = recordOutreach({ date: "2026-08-25", target: "example.com", outcome: "accepted", reviewedBy: "" });
    expect(result.ok).toBe(false);
  });

  it("defaults storage to memory unless configured for prisma", () => {
    expect(getAuthorityStorageMode(undefined)).toBe("memory");
    expect(getAuthorityStorageMode("prisma")).toBe("prisma");
  });
});
