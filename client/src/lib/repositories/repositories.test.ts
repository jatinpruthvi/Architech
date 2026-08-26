import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { getGuides, getListingById, getListings, getListingsByLocality, getListingStaticParams, getLocalities, getLocalityBySlug, getLocalityStaticParams } from ".";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const file = join(dir, entry);
    if (statSync(file).isDirectory()) return sourceFiles(file);
    return /\.(ts|tsx)$/.test(file) ? [file] : [];
  });
}

describe("fixture-backed repositories", () => {
  it("exposes listing lookup and static params", () => {
    // Count is driven by curated demo fixtures (buy + rent) — assert > 0 and deterministic id.
    expect(getListings().length).toBeGreaterThan(0);
    expect(getListings().filter((p) => p.transaction === "rent").length).toBeGreaterThan(0);
    expect(getListingById("garden-courtyard")?.price).toBe("₹1.85 Cr");
    expect(getListingsByLocality("paldi").map((p) => p.id)).toContain("garden-courtyard");
    expect(getListingStaticParams()).toContainEqual({ id: "garden-courtyard" });
  });

  it("exposes locality lookup and static params", () => {
    expect(getLocalities().length).toBeGreaterThanOrEqual(6);
    expect(getLocalityBySlug("paldi")?.hindi).toBe("पालडी");
    expect(getLocalityStaticParams()).toContainEqual({ locality: "paldi" });
  });

  it("exposes guide fixtures for the content repository contract", () => {
    const guides = getGuides();
    expect(guides.map((guide) => guide.slug)).toContain("how-we-verify-rera");
    expect(guides.every((guide) => guide.path.startsWith("/guide/"))).toBe(true);
    expect(guides.every((guide) => guide.author && guide.reviewer && guide.sources.length > 0)).toBe(true);
  });

  it("keeps pages and components behind repository facades instead of fixture arrays", () => {
    const checkedFiles = [
      ...sourceFiles("app"),
      ...sourceFiles("client/src/pages"),
      ...sourceFiles("client/src/components/architech"),
    ];
    const offenders = checkedFiles.filter((file) => {
      const source = readFileSync(file, "utf8");
      return source.includes("@/lib/properties") || source.includes("@/lib/localities");
    });
    expect(offenders).toEqual([]);
  });
});
