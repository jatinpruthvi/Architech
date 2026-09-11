import { describe, expect, it } from "vitest";
import { getRelatedListings } from "./listings";
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
    // Static params carry the city segment for /buy/:city/:locality/.
    expect(getLocalityStaticParams()).toContainEqual({ city: "ahmedabad", locality: "paldi" });
    expect(getLocalityStaticParams()).toContainEqual({ city: "mumbai", locality: "bandra-west" });
    // City scoping keeps one city's localities out of another's hub.
    expect(getLocalities("ahmedabad").every((locality) => locality.citySlug === "ahmedabad")).toBe(true);
    expect(getLocalityBySlug("bandra-west", "ahmedabad")).toBeUndefined();
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

/* Sibling links, and the order they come back in.

   Authority routing is mostly about which links a page spends. A listing's
   strongest internal links are the ones that share its query, and a query is
   dominated by its locality — so a Paldi listing linking to another Paldi
   listing spends a link on the same question, while linking to a Bandra one
   because both are in the country spends it on a different one.

   The ordering test is guarded rather than assumed: it only asserts when the
   fixture inventory actually contains a locality with siblings. Asserting
   locality-first against an inventory where no locality has two listings
   would pass vacuously and then break the moment real data arrived. */
describe("getRelatedListings", () => {
  it("puts same-locality siblings first when any exist", () => {
    const subject = getListings().find((property) =>
      getListings().some(
        (other) =>
          other.id !== property.id &&
          other.localitySlug === property.localitySlug &&
          other.citySlug === property.citySlug,
      ),
    );
    if (!subject) return;

    const related = getRelatedListings(subject.id, 3);
    expect(related[0].localitySlug).toBe(subject.localitySlug);
  });

  it("never returns the listing itself", () => {
    for (const listing of getListings().slice(0, 5)) {
      const related = getRelatedListings(listing.id, 3);
      expect(related.map((other) => other.id)).not.toContain(listing.id);
    }
  });

  it("respects the limit", () => {
    expect(getRelatedListings("garden-courtyard", 1)).toHaveLength(1);
    expect(getRelatedListings("garden-courtyard", 2).length).toBeLessThanOrEqual(2);
  });

  it("degrades to an empty result for an unknown listing rather than throwing", () => {
    expect(() => getRelatedListings("does-not-exist", 3)).not.toThrow();
  });
});
